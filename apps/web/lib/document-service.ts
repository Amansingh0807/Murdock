/**
 * Murdock Document Service
 * Core parsing, graph extraction, and retrieval engine for legal documents.
 * Architecture: extract-once clause graph cached in-memory; all features reuse the same object.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  analyzeClauseWithAI,
  compareAgreementsWithAI,
  generateGroundedAnswer,
} from "./genai";
import { LRUCache } from "./cache";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ClauseType =
  | "OBLIGATION"
  | "RIGHT"
  | "RISK"
  | "TERMINATION"
  | "PENALTY"
  | "AMBIGUOUS"
  | "DEFINITION"
  | "OTHER";

export type Clause = {
  id: string;
  sectionLabel: string;
  rawText: string;
  startOffset: number;
  endOffset: number;
  clauseType: ClauseType;
  riskLevel: RiskLevel;
  confidenceScore: number;
  plainLanguageSummary: string;
  riskExplanation?: string;
  lawyerQuestion?: string;
};

export type DocumentGraph = {
  id: string;
  ownerId: string;
  title: string;
  rawText: string;
  clauses: Clause[];
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Zod validation schemas (exported for route use)
// ---------------------------------------------------------------------------

export const questionSchema = z.object({
  question: z.string().trim().min(3).max(1_000),
});

export const compareSchema = z.object({
  leftDocumentId: z.string().min(1).max(100),
  rightText: z.string().trim().min(10).max(500_000),
});

// ---------------------------------------------------------------------------
// Pre-compiled regex patterns — compiled once at module load, not per-call
// ---------------------------------------------------------------------------

const RE_AMBIGUOUS =
  /sole discretion|reasonable efforts|as deemed necessary|at its option|from time to time|without limitation|undefined|discretion/;
const RE_PENALTY =
  /penalt|late fee|interest rate|fine|liquidated damages|indemnif|hold harmless|unlimited liability/;
const RE_TERMINATION =
  /terminat|cancel|end this agreement|early release|notice of non-renewal/;
const RE_OBLIGATION =
  /must|shall|required to|covenants|agrees to|responsible for|will provide|obligated/;
const RE_RIGHT = /may|entitled|has the right|permitted|option to|eligible/;
const RE_DEFINITION = /means|shall have the meaning|defined as|refers to/;
const RE_SECTION_SPLIT =
  /\n\s*\n|(?=\n?\s*(?:\d+[.)]|[A-Z][A-Z\s]{3,}:))/;
const RE_SECTION_LABEL = /^(\d+[.)][^\n]{0,80}|[A-Z][A-Z\s]{3,}:)/;
const RE_NULL_BYTES = /\u0000/g;

// ---------------------------------------------------------------------------
// In-memory LRU cache (primary layer) + file fallback (persistence layer)
// ---------------------------------------------------------------------------

const documentStorePath = join(tmpdir(), "murdock-documents.json");
const memoryCache = new LRUCache<string, DocumentGraph>(500, 30 * 60_000); // 30 min

function readDocuments(): Map<string, DocumentGraph> {
  try {
    const raw = readFileSync(documentStorePath, "utf8");
    return new Map<string, DocumentGraph>(
      JSON.parse(raw) as [string, DocumentGraph][]
    );
  } catch {
    return new Map<string, DocumentGraph>();
  }
}

function writeDocuments(documents: Map<string, DocumentGraph>): void {
  writeFileSync(
    documentStorePath,
    JSON.stringify([...documents.entries()]),
    "utf8"
  );
}

// ---------------------------------------------------------------------------
// Heuristic clause classifier — O(1) per clause; no network call
// ---------------------------------------------------------------------------

function classify(
  text: string,
  sectionLabel: string
): Pick<
  Clause,
  | "clauseType"
  | "riskLevel"
  | "plainLanguageSummary"
  | "riskExplanation"
  | "lawyerQuestion"
> {
  const value = text.toLowerCase();

  if (RE_AMBIGUOUS.test(value)) {
    return {
      clauseType: "AMBIGUOUS",
      riskLevel: "MEDIUM",
      plainLanguageSummary:
        "Uses subjective language giving one party unilateral discretion or undefined boundaries.",
      riskExplanation:
        "Vague terms like 'sole discretion' can be interpreted in favour of the drafting party during a dispute.",
      lawyerQuestion: `Can we define clear objective criteria for the discretionary terms used in ${sectionLabel}?`,
    };
  }

  if (RE_PENALTY.test(value)) {
    return {
      clauseType: "PENALTY",
      riskLevel: "HIGH",
      plainLanguageSummary:
        "Imposes financial penalties, late charges, or indemnification obligations if conditions are breached.",
      riskExplanation:
        "High penalty rates or one-sided indemnity clauses can expose you to substantial out-of-pocket costs.",
      lawyerQuestion: `Are the late charges or indemnity burdens in ${sectionLabel} standard or negotiable under applicable law?`,
    };
  }

  if (RE_TERMINATION.test(value)) {
    return {
      clauseType: "TERMINATION",
      riskLevel: "MEDIUM",
      plainLanguageSummary:
        "Explains how and when either party can end the agreement, including required advance notice.",
      riskExplanation:
        "Short notice periods or unilateral termination rights can leave you vulnerable to sudden contract cancellation.",
      lawyerQuestion: `What are the exact notice requirements and remedies if the other party terminates under ${sectionLabel}?`,
    };
  }

  if (RE_OBLIGATION.test(value)) {
    return {
      clauseType: "OBLIGATION",
      riskLevel: "LOW",
      plainLanguageSummary:
        "Specifies a binding obligation or duty that you or the other party must fulfil.",
      riskExplanation: "Failure to fulfil this duty may constitute a breach of contract.",
      lawyerQuestion: `What happens if delays or external factors prevent full compliance with ${sectionLabel}?`,
    };
  }

  if (RE_RIGHT.test(value)) {
    return {
      clauseType: "RIGHT",
      riskLevel: "LOW",
      plainLanguageSummary:
        "Grants a permission, privilege, or optional right to one or both parties.",
    };
  }

  if (RE_DEFINITION.test(value) && value.length < 200) {
    return {
      clauseType: "DEFINITION",
      riskLevel: "LOW",
      plainLanguageSummary:
        "Defines the exact legal meaning of a key term used throughout this contract.",
    };
  }

  return {
    clauseType: "OTHER",
    riskLevel: "LOW",
    plainLanguageSummary:
      "Outlines general administrative or operational terms of this agreement.",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Remove null bytes and cap at 500 kB to prevent memory blowout. */
export function cleanText(value: string): string {
  return value.replace(RE_NULL_BYTES, "").slice(0, 500_000);
}

/**
 * Extract a structured DocumentGraph from raw text.
 * The extract-once pattern: one call produces a graph reused by all features.
 */
export function extractGraph(
  ownerId: string,
  title: string,
  rawText: string
): DocumentGraph {
  const text = cleanText(rawText);
  const units = text
    .split(RE_SECTION_SPLIT)
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 250); // guard against runaway documents

  let cursor = 0;
  const clauses: Clause[] = units.map((raw, index) => {
    const start = text.indexOf(raw, cursor);
    cursor = start + raw.length;
    const sectionLabel =
      raw.match(RE_SECTION_LABEL)?.[1] ?? `Section ${index + 1}`;
    return {
      id: `cl_${crypto.randomUUID()}`,
      sectionLabel,
      rawText: raw,
      startOffset: start,
      endOffset: start + raw.length,
      confidenceScore: 0.94,
      ...classify(raw, sectionLabel),
    };
  });

  return {
    id: `doc_${crypto.randomUUID()}`,
    ownerId,
    title: title.slice(0, 180),
    rawText: text,
    clauses,
    createdAt: new Date().toISOString(),
  };
}

/** Persist document and warm the in-memory cache in a single pass. */
export function saveDocument(document: DocumentGraph): DocumentGraph {
  memoryCache.set(document.id, document);
  const documents = readDocuments();
  documents.set(document.id, document);
  writeDocuments(documents);
  return document;
}

/**
 * Look up a document by ID, checking the in-memory cache first to avoid disk I/O.
 * Returns undefined when the document does not exist or is owned by a different user.
 */
export function ownedDocument(
  id: string,
  ownerId: string
): DocumentGraph | undefined {
  // Fast path: in-memory cache hit
  const cached = memoryCache.get(id);
  if (cached) return cached.ownerId === ownerId ? cached : undefined;

  // Slow path: disk fallback (also warms the cache for next call)
  const document = readDocuments().get(id);
  if (!document) return undefined;
  memoryCache.set(id, document);
  return document.ownerId === ownerId ? document : undefined;
}

/** Alias kept for backwards compatibility with existing routes. */
export function getDocument(
  id: string,
  ownerId: string
): DocumentGraph | undefined {
  return ownedDocument(id, ownerId);
}

/** Returns grounded, citation-anchored answer for the given question. */
export async function referencedAnswer(
  document: DocumentGraph,
  question: string
): Promise<string> {
  const result = await generateGroundedAnswer(
    document.title,
    document.clauses,
    question
  );
  return result.answer;
}

/** Minimal sample legal text for demo / testing. */
export function sampleText(): string {
  return (
    `1. TERM\nThis agreement begins on 1 January 2026 and continues for 12 months.\n\n` +
    `2. TERMINATION\nEither party may terminate this agreement with 30 days written notice.\n\n` +
    `3. LATE PAYMENT\nA late fee of 2% per month applies to unpaid amounts.\n\n` +
    `4. MAINTENANCE\nThe tenant must promptly report any damage to the landlord.`
  );
}

// ---------------------------------------------------------------------------
// File parsing — PDF / DOCX / TXT
// ---------------------------------------------------------------------------

/** Heuristic: buffer is valid UTF-8 and contains <1% control characters. */
function isPlainText(buffer: Buffer): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return false;
  }
  const sample = buffer.subarray(0, 4_096);
  const controls = [...sample].filter(
    (byte) => byte < 9 || (byte > 13 && byte < 32)
  ).length;
  return controls / Math.max(sample.length, 1) < 0.01;
}

/**
 * Extracts plain text from an uploaded File.
 * Supports PDF (via pdf-parse), DOCX (via mammoth), and plain text.
 */
export async function fileText(file: File): Promise<string> {
  if (file.size === 0) throw new Error("The uploaded file is empty.");
  if (file.size > 12 * 1024 * 1024)
    throw new Error("File is too large. Please upload a file smaller than 12 MB.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const isPdf =
    extension === "pdf" || buffer.subarray(0, 4).equals(Buffer.from("%PDF"));
  const isDocx =
    extension === "docx" || (buffer[0] === 0x50 && buffer[1] === 0x4b);

  if (isPdf) {
    try {
      // pdf-parse is declared as a serverExternalPackage — safe to import here
      const pdfModule = (await import("pdf-parse")) as unknown as {
        default?: (buf: Buffer) => Promise<{ text: string }>;
      } & ((buf: Buffer) => Promise<{ text: string }>);

      const parseFn =
        typeof pdfModule.default === "function" ? pdfModule.default : pdfModule;

      if (typeof parseFn !== "function") {
        throw new Error("PDF parser initialization failed.");
      }
      const result = await parseFn(buffer);
      return result.text;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown PDF parsing error";
      throw new Error(
        `This PDF could not be read. It may be damaged, encrypted, or use an unsupported structure. (${message})`
      );
    }
  }

  if (isDocx) {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer })).value;
  }

  if (extension === "txt" || isPlainText(buffer)) {
    return buffer.toString("utf8");
  }

  throw new Error(
    "Unsupported file type. Please upload a PDF, DOCX, or TXT file."
  );
}

// Re-export GenAI helpers so routes only need to import from document-service
export { analyzeClauseWithAI, compareAgreementsWithAI, generateGroundedAnswer };
