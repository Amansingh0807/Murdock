import { describe, it, expect } from "vitest";
import {
  cleanText,
  extractGraph,
  fileText,
  sampleText,
  referencedAnswer,
  saveDocument,
  ownedDocument,
  getDocument,
} from "../../lib/document-service";

describe("Document Service Unit Tests", () => {
  it("should sanitize null bytes and limit character count defensively", () => {
    const maliciousText = "Confidential\u0000Agreement\u0000Terms";
    const cleaned = cleanText(maliciousText);
    expect(cleaned).not.toContain("\u0000");
    expect(cleaned).toBe("ConfidentialAgreementTerms");
  });

  it("should extract structured clause graph from legal text", () => {
    const raw = `1. TERMINATION\nEither party may terminate with 30 days notice.\n\n2. PENALTY\nA late fee of 5% applies to overdue balance.\n\n3. OBLIGATION\nThe tenant must maintain the premises.`;
    const doc = extractGraph("user_123", "Test Lease", raw);

    expect(doc.id).toMatch(/^doc_/);
    expect(doc.ownerId).toBe("user_123");
    expect(doc.title).toBe("Test Lease");
    expect(doc.clauses.length).toBeGreaterThanOrEqual(3);

    const termClause = doc.clauses.find((c) => c.clauseType === "TERMINATION");
    expect(termClause).toBeDefined();
    expect(termClause?.riskLevel).toBe("MEDIUM");

    const penaltyClause = doc.clauses.find((c) => c.clauseType === "PENALTY");
    expect(penaltyClause).toBeDefined();
    expect(penaltyClause?.riskLevel).toBe("HIGH");
  });

  it("should detect ambiguous language and tag with MEDIUM risk", () => {
    const text = "1. DISCRETION\nThe company may at its sole discretion modify services without limitation.";
    const doc = extractGraph("user_1", "Terms", text);
    const clause = doc.clauses[0];
    expect(clause.clauseType).toBe("AMBIGUOUS");
    expect(clause.riskLevel).toBe("MEDIUM");
    expect(clause.riskExplanation).toBeDefined();
  });

  it("should generate grounded answers with cited sections", async () => {
    const raw = sampleText();
    const doc = extractGraph("user_123", "Rental Agreement", raw);
    const answer = await referencedAnswer(doc, "What are the rules for late payment?");

    expect(answer).toBeDefined();
    expect(answer).toContain("[");
    expect(answer).toContain("]");
  });

  it("should refuse legal advice when asked if user should sign or sue", async () => {
    const raw = sampleText();
    const doc = extractGraph("user_123", "Rental Agreement", raw);
    const answer = await referencedAnswer(doc, "Should I sign this agreement?");

    expect(answer).toMatch(/cannot|informational|not\s*(formal\s*)?legal advice/i);
    expect(answer).toMatch(/lawyer|attorney/i);
  });

  it("should correctly manage document ownership and retrieval", () => {
    const doc = extractGraph("owner_abc", "Confidential NDA", sampleText());
    saveDocument(doc);

    const retrieved = ownedDocument(doc.id, "owner_abc");
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(doc.id);

    // Unowned user cannot access
    const unauthorized = ownedDocument(doc.id, "intruder_xyz");
    expect(unauthorized).toBeUndefined();
  });

  it("should parse plain text files and reject empty files", async () => {
    const emptyFile = new File([], "empty.txt", { type: "text/plain" });
    await expect(fileText(emptyFile)).rejects.toThrow("The uploaded file is empty.");

    const validFile = new File(["Section 1: Payment is due monthly."], "test.txt", { type: "text/plain" });
    const text = await fileText(validFile);
    expect(text).toContain("Payment is due monthly.");
  });

  it("should extract a 50-section document in under 100 ms (performance regression)", () => {
    const sections = Array.from({ length: 50 }, (_, i) =>
      `${i + 1}. SECTION ${i + 1}\nThe tenant must comply with all terms set forth in section ${i + 1}.\n\n`
    ).join("");
    const start = performance.now();
    const doc = extractGraph("perf_user", "Large Agreement", sections);
    const elapsed = performance.now() - start;
    expect(doc.clauses.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(100);
  });

  it("should truncate oversized text at the 500 kB boundary", () => {
    const huge = "a".repeat(600_000);
    const cleaned = cleanText(huge);
    expect(cleaned.length).toBe(500_000);
  });
});
