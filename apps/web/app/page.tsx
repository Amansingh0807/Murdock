"use client";

import { ChangeEvent, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SignedIn } from "@clerk/nextjs";
import { AuthControls } from "./auth-controls";
import { useApiToken } from "./providers";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

interface Clause {
  id: string;
  sectionLabel: string;
  rawText: string;
  plainLanguageSummary: string;
  clauseType: string;
  riskLevel: string;
  riskExplanation?: string;
  lawyerQuestion?: string;
}

interface DocumentGraph {
  id: string;
  title: string;
  clauses: Clause[];
}

const API_BASE = "/api";

// ---------------------------------------------------------------------------
// Home page component
// ---------------------------------------------------------------------------

export default function Home() {
  const router = useRouter();
  const getToken = useApiToken();

  const [doc, setDoc] = useState<DocumentGraph | null>(null);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [otherText, setOtherText] = useState("");
  const [comparisonSummary, setComparisonSummary] = useState("");
  const [error, setError] = useState("");

  // ---------------------------------------------------------------------------
  // Stable API request helper — memoised so child callbacks don't re-create it
  // ---------------------------------------------------------------------------

  const apiRequest = useCallback(
    async function <T = unknown>(
      endpoint: string,
      options: RequestInit
    ): Promise<T> {
      const token = await getToken();
      const headers = new Headers(options.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(endpoint, { ...options, headers });
      const contentType = res.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : null;

      if (!res.ok) {
        throw new Error(
          (data as { error?: string })?.error ??
            "The server could not process this request. Please try again."
        );
      }
      if (!data) throw new Error("Invalid response received from server.");
      return data as T;
    },
    [getToken]
  );

  // ---------------------------------------------------------------------------
  // Document helpers
  // ---------------------------------------------------------------------------

  const openDocument = useCallback(
    (nextDoc: DocumentGraph) => {
      try {
        const history = JSON.parse(
          localStorage.getItem("murdock.documents") ?? "[]"
        ) as Array<{ id: string }>;
        const updated = [
          { id: nextDoc.id, title: nextDoc.title, createdAt: new Date().toISOString() },
          ...history.filter((item) => item.id !== nextDoc.id),
        ].slice(0, 25);
        localStorage.setItem("murdock.documents", JSON.stringify(updated));
      } catch {
        // localStorage unavailable — non-critical
      }
      router.push(`/documents/${nextDoc.id}`);
    },
    [router]
  );

  const handleLoadSample = useCallback(async () => {
    try {
      setBusy(true);
      setError("");
      const sampleDoc = await apiRequest<DocumentGraph>(
        `${API_BASE}/documents/sample`,
        { method: "POST" }
      );
      openDocument(sampleDoc);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load sample agreement."
      );
    } finally {
      setBusy(false);
    }
  }, [apiRequest, openDocument]);

  const handleFileUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        setBusy(true);
        setError("");
        const form = new FormData();
        form.append("file", file);
        const parsedDoc = await apiRequest<DocumentGraph>(
          `${API_BASE}/documents`,
          { method: "POST", body: form }
        );
        openDocument(parsedDoc);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not parse and analyse file."
        );
      } finally {
        setBusy(false);
      }
    },
    [apiRequest, openDocument]
  );

  const handleAskQuestion = useCallback(async () => {
    if (!doc || !question.trim()) return;
    try {
      setError("");
      const res = await apiRequest<{ answer: string }>(
        `${API_BASE}/documents/${doc.id}/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: question.trim() }),
        }
      );
      setAnswer(res.answer);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not answer question."
      );
    }
  }, [apiRequest, doc, question]);

  const handleCompare = useCallback(async () => {
    if (!doc || !otherText.trim()) return;
    try {
      setError("");
      const res = await apiRequest<{ summary: string }>(
        `${API_BASE}/compare`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leftDocumentId: doc.id,
            rightText: otherText.trim(),
          }),
        }
      );
      setComparisonSummary(res.summary);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not compare agreements."
      );
    }
  }, [apiRequest, doc, otherText]);

  // Derived data — computed only when doc.clauses changes
  const flaggedClauses = useMemo(
    () => doc?.clauses.filter((c) => c.riskLevel !== "LOW") ?? [],
    [doc]
  );

  // ---------------------------------------------------------------------------
  // Landing / Upload view
  // ---------------------------------------------------------------------------

  if (!doc) {
    return (
      <main id="main-content" className="shell">
        <a href="#upload-section" className="sr-only">
          Skip to document upload
        </a>

        <nav className="nav" aria-label="Main navigation">
          <div className="brand" aria-label="Murdock brand">
            Mur<i>d</i>ock
          </div>
          <div className="nav-right">
            <SignedIn>
              <a
                className="btn ghost"
                href="/dashboard"
                aria-label="Go to personal document dashboard"
              >
                Dashboard
              </a>
            </SignedIn>
            <span>Legal clarity, grounded in your document</span>
            <AuthControls />
          </div>
        </nav>

        <section className="hero" aria-labelledby="hero-heading">
          <div className="eyebrow">AI-Assisted Legal Document Intelligence</div>
          <h1 id="hero-heading">Understand what your contract actually says.</h1>
          <p>
            Upload any legal agreement to get instant, section-by-section plain
            English explanations, grounded risk flags, version comparisons, and
            curated checklists to bring to a lawyer.
          </p>
          <div className="notice" role="note">
            <strong>Legal Disclaimer:</strong> Murdock provides general legal
            literacy and information, not formal legal advice. Consult a
            qualified attorney for advice regarding your specific situation.
          </div>
        </section>

        <section
          id="upload-section"
          className="upload"
          aria-labelledby="upload-heading"
        >
          <h2 id="upload-heading" style={{ fontSize: 20, marginBottom: 8 }}>
            {busy ? "Parsing & Analysing Document…" : "Start with a Legal Document"}
          </h2>
          <p>
            Upload a PDF, DOCX, or plain text contract. Murdock extracts a
            grounded clause graph powering plain-language summaries, risk
            detection, and Q&amp;A.
          </p>

          {busy && (
            <div className="loader" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <span>Analysing clauses and detecting liabilities with GenAI...</span>
            </div>
          )}

          {error && (
            <p className="form-error" role="alert" aria-live="assertive">
              {error}
            </p>
          )}

          <div className="actions">
            <label className="btn" aria-label="Choose a file to analyse">
              <span>Choose Document (PDF, DOCX, TXT)</span>
              <input
                className="file"
                type="file"
                accept=".txt,.pdf,.docx"
                onChange={handleFileUpload}
                disabled={busy}
                aria-label="Upload legal document"
              />
            </label>
            <button
              className="btn ghost"
              onClick={handleLoadSample}
              disabled={busy}
              aria-label="Explore sample rental agreement"
            >
              {busy ? "Please wait…" : "Explore Sample Agreement"}
            </button>
          </div>
        </section>

        <section className="how" aria-label="How Murdock works">
          <div>
            <b>1. Grounded Clause Extraction</b>
            <p>
              Documents are parsed into cited, immutable clauses—eliminating AI
              hallucination.
            </p>
          </div>
          <div>
            <b>2. Plain-Language Simplification</b>
            <p>
              Jargon is demystified into 8th-grade accessible English directly
              alongside original terms.
            </p>
          </div>
          <div>
            <b>3. Actionable Next Steps</b>
            <p>
              Generate targeted questions and topics to review with a licensed
              legal professional.
            </p>
          </div>
        </section>

        <footer className="footer" aria-label="Footer">
          <span>© 2026 Murdock · Legal Literacy, Not Legal Advice</span>
          <div>
            <a href="/privacy" aria-label="Privacy policy">
              Privacy
            </a>
            <a href="/terms" aria-label="Terms of service">
              Terms
            </a>
            <a href="/contact" aria-label="Contact us">
              Contact
            </a>
          </div>
        </footer>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Active Document Workspace view
  // ---------------------------------------------------------------------------

  return (
    <main id="main-content" className="shell">
      <nav className="nav" aria-label="Document workspace navigation">
        <div className="brand" aria-label="Murdock brand">
          Mur<i>d</i>ock
        </div>
        <div className="nav-right">
          <button
            className="btn ghost"
            onClick={() => setDoc(null)}
            aria-label="Close document and analyse another"
          >
            New document
          </button>
          <AuthControls />
        </div>
      </nav>

      {error && (
        <p className="form-error" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      <div className="notice" role="note">
        <strong>Information only:</strong> Every summary and risk flag below
        cites specific clauses from this agreement.
      </div>

      <div className="workspace" style={{ marginTop: 18 }}>
        {/* Main Document Clause Graph */}
        <section
          className="card"
          aria-label="Document clauses and plain-language analysis"
        >
          <div className="doc-head">
            <div>
              <h2>{doc.title}</h2>
              <span className="eyebrow">Structured Clause Intelligence Graph</span>
            </div>
            <span>{doc.clauses.length} clauses analysed</span>
          </div>

          <div className="clauses">
            {doc.clauses.map((clause) => (
              <article
                id={clause.id}
                key={clause.id}
                className={`clause ${clause.riskLevel}`}
                aria-label={`Clause ${clause.sectionLabel} with ${clause.riskLevel} risk`}
              >
                <div className="meta">
                  {clause.sectionLabel} · {clause.clauseType}
                </div>
                <p>{clause.rawText}</p>
                <p className="summary">
                  <strong>In Plain English:</strong> {clause.plainLanguageSummary}
                </p>
                {clause.riskExplanation && (
                  <p>
                    <strong>Why this matters:</strong> {clause.riskExplanation}
                  </p>
                )}
                <span className="citation">Source: {clause.sectionLabel}</span>
              </article>
            ))}
          </div>
        </section>

        {/* Sidebar Intelligence & Tools */}
        <aside className="side" aria-label="Risk assessment and document tools">
          <section className="card" aria-labelledby="risk-summary-heading">
            <h3 id="risk-summary-heading">Risk &amp; Inconsistency Flags</h3>
            <div
              className="score"
              aria-label={`${flaggedClauses.length} clauses needing attention`}
            >
              {flaggedClauses.length}
            </div>
            <p style={{ fontSize: 13, color: "#68786e" }}>
              clauses requiring closer review
            </p>
            {flaggedClauses.map((clause) => (
              <div className="flag" key={clause.id}>
                <b>{clause.riskLevel}</b> ·{" "}
                <a href={`#${clause.id}`}>{clause.sectionLabel}</a>
              </div>
            ))}
          </section>

          <section className="card" aria-labelledby="chat-heading">
            <h3 id="chat-heading">Ask Murdock</h3>
            <div className="notice" role="note" style={{ fontSize: 12 }}>
              Strictly grounded in your document. Refuses unauthorised legal
              advice.
            </div>
            <div className="chat">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                placeholder="What happens if I terminate early?"
                aria-label="Question about this document"
              />
              <button
                className="btn"
                onClick={handleAskQuestion}
                aria-label="Submit question to assistant"
              >
                Ask
              </button>
            </div>
            {answer && (
              <p className="answer" role="region" aria-live="polite">
                {answer}
              </p>
            )}
          </section>

          <section className="card" aria-labelledby="compare-heading">
            <h3 id="compare-heading">Compare Another Version</h3>
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Paste counter-proposal or amended version text here…"
              aria-label="Alternate agreement text to compare"
              rows={4}
            />
            <button
              className="btn"
              style={{ marginTop: 8 }}
              onClick={handleCompare}
              aria-label="Analyse differences between versions"
            >
              Compare Clauses
            </button>
            {comparisonSummary && (
              <div className="diff" role="region" aria-live="polite">
                {comparisonSummary}
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="lawyer-heading">
            <h3 id="lawyer-heading">Questions to Ask a Lawyer</h3>
            <p style={{ fontSize: 12, color: "#68786e", marginBottom: 8 }}>
              Bring these targeted questions to your legal consultation:
            </p>
            {flaggedClauses.map((clause) => (
              <p style={{ fontSize: 13 }} key={clause.id}>
                •{" "}
                {clause.lawyerQuestion ??
                  `Could you clarify the legal implications of ${clause.sectionLabel}?`}{" "}
                <span className="citation">[{clause.sectionLabel}]</span>
              </p>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}
