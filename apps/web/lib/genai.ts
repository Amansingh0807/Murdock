/**
 * Murdock GenAI Legal Intelligence Engine
 * Grounded Legal Literacy, Clause Analysis, and Q&A System.
 * Powered by Google Gemini 1.5 Flash with deterministic offline fallback.
 *
 * Performance optimisations:
 *  - AI responses cached in an LRU cache (5 min TTL) to deduplicate identical requests.
 *  - Network calls time-out after 8 s via AbortSignal to prevent route hangs.
 *  - Pre-compiled regex patterns (see document-service) reused where possible.
 */

import { aiResponseCache } from "./cache";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface GenAIClauseAnalysis {
  clauseType:
    | "OBLIGATION"
    | "RIGHT"
    | "RISK"
    | "TERMINATION"
    | "PENALTY"
    | "AMBIGUOUS"
    | "DEFINITION"
    | "OTHER";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  plainLanguageSummary: string;
  riskExplanation?: string;
  lawyerQuestion?: string;
  confidenceScore: number;
}

export interface GenAIComparisonResult {
  summary: string;
  keyDifferences: string[];
  riskShifts: string[];
  recommendationsForLawyer: string[];
}

export interface GenAIAnswerResult {
  answer: string;
  citedClauses: string[];
  isLegalAdviceRefused: boolean;
}

// ---------------------------------------------------------------------------
// System prompt — defined once, referenced by every request
// ---------------------------------------------------------------------------

const SYSTEM_LEGAL_PROMPT = `You are Murdock, an expert legal literacy AI assistant designed for the "AI for Legal Assistance & Access" challenge.
Your core mandate:
1. Grounding: All explanations must be strictly derived from the provided document text.
2. Plain Language: Demystify complex legal jargon into clear, accessible language (approx. 8th-grade reading level).
3. Risk Highlighting: Identify unilateral rights, hidden penalties, strict termination terms, and ambiguous phrasing.
4. Non-Advisory Guardrail: You provide legal information and literacy, NOT formal legal advice. Never instruct a user to sign or sue. Always provide actionable questions they can bring to a licensed attorney.
5. Verifiable Citations: Always cite the exact section or clause identifier in brackets like [Section 2.1].`;

// ---------------------------------------------------------------------------
// Pre-compiled patterns for the advice-guard check
// ---------------------------------------------------------------------------
const RE_ADVICE_REQUEST =
  /should i\s*(sign|agree|accept|sue|cancel)|is it legal|can they sue me|am i liable/;

// ---------------------------------------------------------------------------
// Gemini network helper — with caching and timeout
// ---------------------------------------------------------------------------

/**
 * Calls Gemini 1.5 Flash if GEMINI_API_KEY is configured.
 * Results are cached per-prompt to avoid duplicate network calls.
 * Returns null on any failure so callers can fall back gracefully.
 */
async function callGemini(
  prompt: string,
  jsonMode = false
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "<your_api_key>") {
    return null;
  }

  // Cache key incorporates json mode flag
  const cacheKey = `${jsonMode ? "j:" : "t:"}${prompt}`;
  const cached = aiResponseCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          { parts: [{ text: `${SYSTEM_LEGAL_PROMPT}\n\nTask:\n${prompt}` }] },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2_048,
          responseMimeType: jsonMode ? "application/json" : "text/plain",
        },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

    if (text) aiResponseCache.set(cacheKey, text);
    return text;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public GenAI functions
// ---------------------------------------------------------------------------

/**
 * Classifies a legal clause using Gemini with a deterministic heuristic fallback.
 * @param sectionLabel - The section heading (e.g. "Section 4.2")
 * @param rawText      - The raw clause text
 */
export async function analyzeClauseWithAI(
  sectionLabel: string,
  rawText: string
): Promise<GenAIClauseAnalysis> {
  const prompt = `Analyze this legal clause from section "${sectionLabel}":
"""${rawText}"""

Output valid JSON matching:
{
  "clauseType": "OBLIGATION" | "RIGHT" | "RISK" | "TERMINATION" | "PENALTY" | "AMBIGUOUS" | "DEFINITION" | "OTHER",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "plainLanguageSummary": "A clear 1-2 sentence explanation in plain English",
  "riskExplanation": "Why this matters to the user or what risk it poses",
  "lawyerQuestion": "A specific question the user should ask a lawyer regarding this term",
  "confidenceScore": 0.95
}`;

  const aiResponse = await callGemini(prompt, true);
  if (aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse) as Partial<GenAIClauseAnalysis>;
      if (parsed.clauseType && parsed.plainLanguageSummary) {
        return {
          clauseType: parsed.clauseType,
          riskLevel: parsed.riskLevel ?? "LOW",
          plainLanguageSummary: parsed.plainLanguageSummary,
          riskExplanation: parsed.riskExplanation,
          lawyerQuestion: parsed.lawyerQuestion,
          confidenceScore:
            typeof parsed.confidenceScore === "number"
              ? parsed.confidenceScore
              : 0.95,
        };
      }
    } catch {
      // Fall through to deterministic engine
    }
  }

  return fallbackClassifyClause(rawText, sectionLabel);
}

/**
 * Answers a user question grounded strictly in the document clauses.
 * Cites every source and refuses formal legal advice.
 */
export async function generateGroundedAnswer(
  documentTitle: string,
  clauses: Array<{
    sectionLabel: string;
    rawText: string;
    plainLanguageSummary: string;
  }>,
  question: string
): Promise<GenAIAnswerResult> {
  const lowerQ = question.toLowerCase();
  const asksForAdvice = RE_ADVICE_REQUEST.test(lowerQ);

  // Retrieve the most relevant clauses via token-overlap scoring
  const tokens = lowerQ.split(/\W+/).filter((w) => w.length > 3);
  const scored = clauses.map((c) => {
    const haystack = (c.rawText + " " + c.sectionLabel).toLowerCase();
    const score = tokens.reduce(
      (acc, t) => acc + (haystack.includes(t) ? 1 : 0),
      0
    );
    return { clause: c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const topClauses =
    scored[0]?.score > 0
      ? scored.slice(0, 4).map((s) => s.clause)
      : clauses.slice(0, 3);

  const contextText = topClauses
    .map((c) => `[${c.sectionLabel}]: ${c.rawText}`)
    .join("\n\n");

  const prompt = `Document: "${documentTitle}"
Relevant Clauses:
${contextText}

User Question: "${question}"

Instructions:
1. Answer the question using ONLY the provided clauses. Cite every source as [Section Label].
2. If the user asks whether they "should sign", "should sue", or asks for legal advice, explicitly state that Murdock provides legal information rather than legal advice, and advise them to consult a qualified attorney with the cited sections.
3. Keep the answer clear, helpful, and concise.`;

  const aiText = await callGemini(prompt, false);
  if (aiText && aiText.trim().length > 0) {
    return {
      answer: aiText.trim(),
      citedClauses: topClauses.map((c) => c.sectionLabel),
      isLegalAdviceRefused: asksForAdvice,
    };
  }

  // Deterministic fallback — always grounded, never hallucinates
  const cited = topClauses.map((c) => c.sectionLabel);
  const summaryPart = topClauses
    .map((c) => `${c.plainLanguageSummary} [${c.sectionLabel}]`)
    .join(" ");

  if (asksForAdvice) {
    return {
      answer: `Murdock provides legal literacy and information, not formal legal advice. We cannot advise you whether to sign or take legal action. Based on ${cited.join(" and ")}, here is what the terms state: ${summaryPart} You should discuss these specific obligations with a licensed attorney.`,
      citedClauses: cited,
      isLegalAdviceRefused: true,
    };
  }

  return {
    answer: `${summaryPart} (Grounded in cited sections: ${cited.map((s) => `[${s}]`).join(" ")}; provided for informational purposes only, not legal advice).`,
    citedClauses: cited,
    isLegalAdviceRefused: false,
  };
}

/**
 * Compares two agreements and identifies clause-level risk shifts.
 * Uses Gemini when available; falls back to keyword-overlap heuristics.
 */
export async function compareAgreementsWithAI(
  leftTitle: string,
  leftClauses: Array<{
    sectionLabel: string;
    rawText: string;
    clauseType: string;
    riskLevel: string;
  }>,
  rightText: string
): Promise<GenAIComparisonResult> {
  const prompt = `Compare this base agreement ("${leftTitle}") against the following alternate/amended text:
Base Clauses:
${leftClauses
  .map(
    (c) => `[${c.sectionLabel} | ${c.clauseType} | ${c.riskLevel}]: ${c.rawText}`
  )
  .join("\n")}

Alternate Text:
"""${rightText.slice(0, 10_000)}"""

Analyze differences in:
1. Termination notice requirements
2. Penalties, liability caps, or payment timelines
3. Obligation shifts between parties
4. Removed or altered clauses

Output JSON:
{
  "summary": "Concise summary of differences",
  "keyDifferences": ["Difference 1", "Difference 2"],
  "riskShifts": ["Risk shift 1", "Risk shift 2"],
  "recommendationsForLawyer": ["Question 1 to ask lawyer", "Question 2"]
}`;

  const aiResponse = await callGemini(prompt, true);
  if (aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse) as Partial<GenAIComparisonResult>;
      if (parsed.summary) {
        return {
          summary: parsed.summary,
          keyDifferences: Array.isArray(parsed.keyDifferences)
            ? parsed.keyDifferences
            : [],
          riskShifts: Array.isArray(parsed.riskShifts) ? parsed.riskShifts : [],
          recommendationsForLawyer: Array.isArray(
            parsed.recommendationsForLawyer
          )
            ? parsed.recommendationsForLawyer
            : [],
        };
      }
    } catch {
      // Fall through to heuristic
    }
  }

  // Keyword-overlap heuristic fallback
  const rightLower = rightText.toLowerCase();
  const altered: string[] = [];
  const riskShifts: string[] = [];
  const lawyerQuestions: string[] = [];

  for (const clause of leftClauses) {
    const keyWords = clause.rawText
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 5);
    const matchCount = keyWords.filter((w) => rightLower.includes(w)).length;
    if (keyWords.length > 0 && matchCount / keyWords.length < 0.4) {
      altered.push(clause.sectionLabel);
      if (
        clause.riskLevel === "HIGH" ||
        clause.clauseType === "PENALTY" ||
        clause.clauseType === "TERMINATION"
      ) {
        riskShifts.push(
          `Terms regarding ${clause.sectionLabel} (${clause.clauseType}) appear altered or omitted in the compared version.`
        );
        lawyerQuestions.push(
          `How does the modification of ${clause.sectionLabel} affect my liability and termination rights?`
        );
      }
    }
  }

  const summary = `Compared ${leftClauses.length} base clauses against the alternate text. ${
    altered.length > 0
      ? `Found noticeable alterations or omissions in: ${altered.join(", ")}.`
      : "No major clause deletions detected between the two versions."
  } Review any modified penalties or termination clauses with a legal professional.`;

  return {
    summary,
    keyDifferences: altered.map(
      (label) => `Section ${label} has notable phrasing differences or omissions.`
    ),
    riskShifts,
    recommendationsForLawyer:
      lawyerQuestions.length > 0
        ? lawyerQuestions
        : [
            "Verify whether notice periods and default fees align with local regulations.",
          ],
  };
}

// ---------------------------------------------------------------------------
// Deterministic heuristic classifier (no network, always available)
// ---------------------------------------------------------------------------

function fallbackClassifyClause(
  text: string,
  sectionLabel: string
): GenAIClauseAnalysis {
  const value = text.toLowerCase();

  if (
    /sole discretion|reasonable efforts|as deemed necessary|at its option|from time to time|without limitation|undefined|discretion/.test(
      value
    )
  ) {
    return {
      clauseType: "AMBIGUOUS",
      riskLevel: "MEDIUM",
      plainLanguageSummary:
        "Uses subjective language giving one party unilateral discretion or undefined boundaries.",
      riskExplanation:
        "Vague terms like 'sole discretion' can be interpreted in favour of the drafting party during a dispute.",
      lawyerQuestion: `Can we define clear objective criteria for the discretionary terms used in ${sectionLabel}?`,
      confidenceScore: 0.91,
    };
  }

  if (
    /penalt|late fee|interest rate|fine|liquidated damages|indemnif|hold harmless|unlimited liability/.test(
      value
    )
  ) {
    return {
      clauseType: "PENALTY",
      riskLevel: "HIGH",
      plainLanguageSummary:
        "Imposes financial penalties, late charges, or indemnification obligations if conditions are breached.",
      riskExplanation:
        "High penalty rates or one-sided indemnity clauses can expose you to substantial out-of-pocket costs.",
      lawyerQuestion: `Are the late charges or indemnity burdens in ${sectionLabel} standard or negotiable under applicable law?`,
      confidenceScore: 0.96,
    };
  }

  if (
    /terminat|cancel|end this agreement|early release|notice of non-renewal/.test(
      value
    )
  ) {
    return {
      clauseType: "TERMINATION",
      riskLevel: "MEDIUM",
      plainLanguageSummary:
        "Explains how and when either party can end the agreement, including required advance notice.",
      riskExplanation:
        "Short notice periods or unilateral termination rights can leave you vulnerable to sudden contract cancellation.",
      lawyerQuestion: `What are the exact notice requirements and remedies if the other party terminates under ${sectionLabel}?`,
      confidenceScore: 0.94,
    };
  }

  if (
    /must|shall|required to|covenants|agrees to|responsible for|will provide|obligated/.test(
      value
    )
  ) {
    return {
      clauseType: "OBLIGATION",
      riskLevel: "LOW",
      plainLanguageSummary:
        "Specifies a binding obligation or duty that you or the other party must fulfil.",
      riskExplanation:
        "Failure to fulfil this duty may constitute a breach of contract.",
      lawyerQuestion: `What happens if delays or external factors prevent full compliance with ${sectionLabel}?`,
      confidenceScore: 0.93,
    };
  }

  if (/may|entitled|has the right|permitted|option to|eligible/.test(value)) {
    return {
      clauseType: "RIGHT",
      riskLevel: "LOW",
      plainLanguageSummary:
        "Grants a permission, privilege, or optional right to one or both parties.",
      confidenceScore: 0.92,
    };
  }

  if (
    /means|shall have the meaning|defined as|refers to/.test(value) &&
    value.length < 200
  ) {
    return {
      clauseType: "DEFINITION",
      riskLevel: "LOW",
      plainLanguageSummary:
        "Defines the exact legal meaning of a key term used throughout this contract.",
      confidenceScore: 0.95,
    };
  }

  return {
    clauseType: "OTHER",
    riskLevel: "LOW",
    plainLanguageSummary:
      "Outlines general administrative or operational terms of this agreement.",
    confidenceScore: 0.88,
  };
}
