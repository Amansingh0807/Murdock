import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/server";

describe("Murdock API Tests", () => {
  it("should return ok for /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name", "Murdock API");
    expect(res.body).toHaveProperty("status", "ok");
  });

  it("should generate a sample document", async () => {
    const res = await request(app).post("/documents/sample");
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title", "Sample rental agreement");
    expect(res.body).toHaveProperty("clauses");
    expect(Array.isArray(res.body.clauses)).toBe(true);
    expect(res.body.clauses.length).toBeGreaterThan(0);
  });
  
  it("should return 404 for asking questions on non-existent document", async () => {
    const res = await request(app)
      .post("/documents/fake-doc-id/ask")
      .send({ question: "What happens if I pay late?" });
      
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("should reject too short questions", async () => {
    const res = await request(app)
      .post("/documents/fake-doc-id/ask")
      .send({ question: "a" });
      
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});
