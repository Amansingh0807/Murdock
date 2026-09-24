import { describe, it, expect } from "vitest";
import {
  analyzeClauseWithAI,
  generateGroundedAnswer,
  compareAgreementsWithAI,
} from "../../lib/genai";

describe("GenAI Legal Intelligence Engine Unit Tests", () => {
  it("should classify high-risk penalty clauses accurately", async () => {
    const analysis = await analyzeClauseWithAI(
      "Section 4.2",
      "Late payment incurs an immediate fine of $500 plus 24% annual compounding interest and full indemnification of legal costs."
    );

    expect(analysis.clauseType).toBe("PENALTY");
    expect(analysis.riskLevel).toBe("HIGH");
    expect(analysis.plainLanguageSummary).toBeTruthy();
    expect(analysis.lawyerQuestion).toBeTruthy();
    expect(analysis.confidenceScore).toBeGreaterThanOrEqual(0.8);
  });

  it("should identify ambiguous unilateral discretion terms", async () => {
    const analysis = await analyzeClauseWithAI(
      "Section 9",
      "The vendor may in its sole discretion terminate or modify service tiers at any time without limitation."
    );

    expect(analysis.clauseType).toBe("AMBIGUOUS");
    expect(analysis.riskLevel).toBe("MEDIUM");
    expect(analysis.riskExplanation).toBeTruthy();
  });

  it("should ground Q&A strictly in provided clauses with citations", async () => {
    const clauses = [
      {
        sectionLabel: "Clause 3",
        rawText: "The tenant shall pay rent on the first day of each calendar month.",
        plainLanguageSummary: "Rent must be paid on the 1st of every month.",
      },
      {
        sectionLabel: "Clause 7",
        rawText: "Subletting is strictly prohibited without prior written consent from the landlord.",
        plainLanguageSummary: "You cannot sublet without written permission.",
      },
    ];

    const result = await generateGroundedAnswer("Residential Lease", clauses, "Can I sublet the apartment?");
    expect(result.answer).toContain("Clause 7");
    expect(result.citedClauses).toContain("Clause 7");
  });

  it("should detect liability and penalty shifts when comparing agreements", async () => {
    const leftClauses = [
      {
        sectionLabel: "Clause 5",
        rawText: "Either party may terminate with 60 days written notice.",
        clauseType: "TERMINATION",
        riskLevel: "LOW",
      },
      {
        sectionLabel: "Clause 8",
        rawText: "Late fee of $25 applies after 10 days grace period.",
        clauseType: "PENALTY",
        riskLevel: "LOW",
      },
    ];

    const amendedText = `Clause 5: Landlord may terminate immediately with 24 hours notice. Tenant must provide 90 days notice. Clause 8: Late fee of $250 applies immediately with zero grace period.`;

    const comparison = await compareAgreementsWithAI("Original Lease", leftClauses, amendedText);

    expect(comparison.summary).toBeTruthy();
    expect(comparison.recommendationsForLawyer.length).toBeGreaterThan(0);
  });
});
