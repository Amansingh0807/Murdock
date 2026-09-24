import { describe, it, expect, beforeEach } from "vitest";
import { GET as healthGet } from "../../app/api/health/route";
import { POST as samplePost } from "../../app/api/documents/sample/route";
import { GET as documentGet } from "../../app/api/documents/[id]/route";
import { POST as askPost } from "../../app/api/documents/[id]/ask/route";
import { POST as comparePost } from "../../app/api/compare/route";
import { saveDocument, extractGraph, sampleText } from "../../lib/document-service";

describe("API Route Integration Tests", () => {
  let sampleDocId: string;

  beforeEach(() => {
    const doc = saveDocument(extractGraph("local_demo_user", "Test Lease", sampleText()));
    sampleDocId = doc.id;
  });

  it("GET /api/health should return 200 with status ok", async () => {
    const res = healthGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Murdock API");
    expect(data.status).toBe("ok");
  });

  it("POST /api/documents/sample should return a 201 with populated document", async () => {
    const res = await samplePost();
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toMatch(/^doc_/);
    expect(data.clauses.length).toBeGreaterThan(0);
  });

  it("GET /api/documents/[id] should return 200 for existing document", async () => {
    const req = new Request(`http://localhost:3000/api/documents/${sampleDocId}`);
    const res = await documentGet(req, { params: Promise.resolve({ id: sampleDocId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(sampleDocId);
  });

  it("GET /api/documents/[id] should return 404 for nonexistent document", async () => {
    const req = new Request("http://localhost:3000/api/documents/doc_nonexistent");
    const res = await documentGet(req, { params: Promise.resolve({ id: "doc_nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("POST /api/documents/[id]/ask should return 200 with answer", async () => {
    const req = new Request(`http://localhost:3000/api/documents/${sampleDocId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What are the termination requirements?" }),
    });
    const res = await askPost(req, { params: Promise.resolve({ id: sampleDocId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.answer).toBeTruthy();
  });

  it("POST /api/documents/[id]/ask should reject invalid or empty questions with 400", async () => {
    const req = new Request(`http://localhost:3000/api/documents/${sampleDocId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "a" }), // too short (min 3)
    });
    const res = await askPost(req, { params: Promise.resolve({ id: sampleDocId }) });
    expect(res.status).toBe(400);
  });

  it("POST /api/compare should return comparison summary and recommendations", async () => {
    const req = new Request("http://localhost:3000/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftDocumentId: sampleDocId,
        rightText: "1. TERM: Continues for 24 months. 2. TERMINATION: 90 days notice required.",
      }),
    });
    const res = await comparePost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBeTruthy();
  });
});
