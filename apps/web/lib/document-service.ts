import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  analyzeClauseWithAI,
  compareAgreementsWithAI,
  generateGroundedAnswer,
} from "./genai";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type ClauseType = "OBLIGATION" | "RIGHT" | "RISK" | "TERMINATION" | "PENALTY" | "AMBIGUOUS" | "DEFINITION" | "OTHER";
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

const documentStorePath = join(tmpdir(), "murdock-documents.json");
function readDocuments() {
  try {
    return new Map<string, DocumentGraph>(JSON.parse(readFileSync(documentStorePath, "utf8")) as [string, DocumentGraph][]);
  } catch {
    return new Map<string, DocumentGraph>();
  }
}
function writeDocuments(documents: Map<string, DocumentGraph>) {
  writeFileSync(documentStorePath, JSON.stringify([...documents.entries()]), "utf8");
}
export const questionSchema = z.object({ question: z.string().trim().min(3).max(1000) });
export const compareSchema = z.object({ leftDocumentId: z.string().min(1).max(100), rightText: z.string().trim().min(10).max(500_000) });

export function cleanText(value: string) { return value.replace(/\u0000/g, "").slice(0, 500_000); }
export function ownedDocument(id: string, ownerId: string) { const document = readDocuments().get(id); return document?.ownerId === ownerId ? document : undefined; }
export function getDocument(id: string, ownerId: string) { return ownedDocument(id, ownerId); }

function classify(text: string, sectionLabel: string): Pick<Clause, "clauseType" | "riskLevel" | "plainLanguageSummary" | "riskExplanation" | "lawyerQuestion"> {
  const value = text.toLowerCase();
  if (/sole discretion|reasonable efforts|as deemed necessary|at its option|from time to time|without limitation|undefined|discretion/.test(value)) {
    return {
      clauseType: "AMBIGUOUS",
      riskLevel: "MEDIUM",
      plainLanguageSummary: "Uses subjective language that may be open to broad or conflicting interpretations.",
      riskExplanation: "Discretionary wording leaves room for one party to enforce terms unilaterally.",
      lawyerQuestion: `Can we introduce objective standards or limits to replace subjective terms in ${sectionLabel}?`,
    };
  }
  if (/penalt|late fee|interest|fine|liquidated damages|indemnif|hold harmless/.test(value)) {
    return {
      clauseType: "PENALTY",
      riskLevel: "HIGH",
      plainLanguageSummary: "Imposes an extra payment, indemnification, or financial consequence if terms are not met.",
      riskExplanation: "Financial penalties and broad indemnity obligations can create unexpected, un-capped liabilities.",
      lawyerQuestion: `Are the penalty charges or indemnity liabilities in ${sectionLabel} standard or negotiable under local law?`,
    };
  }
  if (/terminat|cancel|end this agreement|early release|notice of non-renewal/.test(value)) {
    return {
      clauseType: "TERMINATION",
      riskLevel: "MEDIUM",
      plainLanguageSummary: "Sets out how and when either party can end the agreement and what notice is required.",
      riskExplanation: "Notice periods and termination conditions affect how quickly either side can exit without penalty.",
      lawyerQuestion: `What are the exact notice timelines and cure periods if either party terminates under ${sectionLabel}?`,
    };
  }
  if (/must|shall|required to|responsible for|agrees to|covenants/.test(value)) {
    return {
      clauseType: "OBLIGATION",
      riskLevel: "LOW",
      plainLanguageSummary: "Outlines a mandatory obligation or task that a party is legally required to complete.",
      lawyerQuestion: `What are the consequences if operational delays impact our ability to meet ${sectionLabel}?`,
    };
  }
  if (/may|entitled|right to|permitted|option to/.test(value)) {
    return {
      clauseType: "RIGHT",
      riskLevel: "LOW",
      plainLanguageSummary: "Specifies an option, privilege, or discretionary right available to a party.",
    };
  }
  return {
    clauseType: "OTHER",
    riskLevel: "LOW",
    plainLanguageSummary: "Outlines standard administrative, governing law, or operational terms of this agreement.",
  };
}

export function extractGraph(ownerId: string, title: string, rawText: string): DocumentGraph {
  const text = cleanText(rawText);
  const units = text.split(/\n\s*\n|(?=\n?\s*(?:\d+[.)]|[A-Z][A-Z\s]{3,}:))/).map((value) => value.trim()).filter(Boolean).slice(0, 250);
  let cursor = 0;
  const clauses = units.map((raw, index) => {
    const start = text.indexOf(raw, cursor);
    cursor = start + raw.length;
    const sectionLabel = raw.match(/^(\d+[.)][^\n]{0,80}|[A-Z][A-Z\s]{3,}:)/)?.[1] ?? `Section ${index + 1}`;
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
  return { id: `doc_${crypto.randomUUID()}`, ownerId, title: title.slice(0, 180), rawText: text, clauses, createdAt: new Date().toISOString() };
}

export function saveDocument(document: DocumentGraph) { const documents = readDocuments(); documents.set(document.id, document); writeDocuments(documents); return document; }
export function sampleText() { return `1. TERM\nThis agreement begins on 1 January 2026 and continues for 12 months.\n\n2. TERMINATION\nEither party may terminate this agreement with 30 days written notice.\n\n3. LATE PAYMENT\nA late fee of 2% per month applies to unpaid amounts.\n\n4. MAINTENANCE\nThe tenant must promptly report any damage to the landlord.`; }

export async function referencedAnswer(document: DocumentGraph, question: string) {
  const result = await generateGroundedAnswer(document.title, document.clauses, question);
  return result.answer;
}

export { analyzeClauseWithAI, compareAgreementsWithAI, generateGroundedAnswer };

function isPlainText(buffer: Buffer) { try { new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch { return false; } const sample = buffer.subarray(0, 4096); const controls = [...sample].filter((byte) => byte < 9 || (byte > 13 && byte < 32)).length; return controls / Math.max(sample.length, 1) < 0.01; }
export async function fileText(file: File) {
  if (file.size === 0) throw new Error("The uploaded file is empty.");
  if (file.size > 12 * 1024 * 1024) throw new Error("File is too large. Please upload a file smaller than 12 MB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const isPdf = extension === "pdf" || buffer.subarray(0, 4).equals(Buffer.from("%PDF"));
  const isDocx = extension === "docx" || (buffer[0] === 0x50 && buffer[1] === 0x4b);
  if (isPdf) {
    try {
      const pdfModule = await import("pdf-parse") as any;
      if (typeof pdfModule.PDFParse === "function") {
        const parser = new pdfModule.PDFParse({ data: buffer });
        try {
          const result = await parser.getText();
          return result.text;
        } finally {
          await parser.destroy();
        }
      }
      const parseFn = typeof pdfModule.default === "function" ? pdfModule.default : pdfModule;
      if (typeof parseFn === "function") {
        const result = await parseFn(buffer);
        return result.text;
      }
      throw new Error("PDF parser initialization failed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown PDF parsing error";
      throw new Error(`This PDF could not be read. It may be damaged, encrypted, or use an unsupported structure. (${message})`);
    }
  }
  if (isDocx) {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer })).value;
  }
  if (extension === "txt" || isPlainText(buffer)) return buffer.toString("utf8");
  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}
