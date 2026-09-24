import { describe, it, expect } from "vitest";
import { cleanText, extractGraph, ownedDocument, saveDocument, sampleText, questionSchema, compareSchema } from "../../lib/document-service";

describe("Security & Hardening Tests", () => {
  it("enforces tenant and user isolation: user A cannot access user B's document", () => {
    const userADoc = saveDocument(extractGraph("user_alice_123", "Alice Will", sampleText()));
    
    // Alice accesses her document
    expect(ownedDocument(userADoc.id, "user_alice_123")).toBeDefined();

    // Bob attempts unauthorized cross-tenant access
    expect(ownedDocument(userADoc.id, "user_bob_456")).toBeUndefined();
    expect(ownedDocument(userADoc.id, "anonymous_intruder")).toBeUndefined();
  });

  it("sanitizes null-byte injection attempts", () => {
    const attackPayload = "Legit Contract\u0000<script>alert('xss')</script>\u0000DROP TABLE documents;";
    const cleaned = cleanText(attackPayload);
    expect(cleaned).not.toContain("\u0000");
  });

  it("strictly enforces question input length limits (min 3, max 1000)", () => {
    // Underflow
    expect(questionSchema.safeParse({ question: "hi" }).success).toBe(false);
    expect(questionSchema.safeParse({ question: "" }).success).toBe(false);

    // Overflow (1001 chars)
    const longString = "a".repeat(1001);
    expect(questionSchema.safeParse({ question: longString }).success).toBe(false);

    // Valid
    expect(questionSchema.safeParse({ question: "What is the penalty fee?" }).success).toBe(true);
  });

  it("strictly enforces comparison input boundary (max 500,000 chars)", () => {
    const oversizedPayload = "a".repeat(500001);
    const result = compareSchema.safeParse({
      leftDocumentId: "doc_123",
      rightText: oversizedPayload,
    });
    expect(result.success).toBe(false);
  });
});
