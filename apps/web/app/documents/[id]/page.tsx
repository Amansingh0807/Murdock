"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthControls } from "../../auth-controls";
import { useApiToken } from "../../providers";
import { saveChat } from "../../../lib/client-history";

type Clause = { id: string; sectionLabel: string; rawText: string; plainLanguageSummary: string; clauseType: string; riskLevel: string; riskExplanation?: string };
type Doc = { id: string; title: string; clauses: Clause[] };

export default function DocumentPage() {
  const params = useParams<{ id: string }>();
  const getToken = useApiToken();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const flagged = useMemo(() => doc?.clauses.filter((clause) => clause.riskLevel !== "LOW") ?? [], [doc]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const token = await getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const response = await fetch(`/api/documents/${params.id}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Document not found.");
        if (active) setDoc(data);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load document.");
      } finally {
        if (active) setBusy(false);
      }
    }
    load();
    return () => { active = false; };
  }, [getToken, params.id]);

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!doc || !question.trim()) return;
    try {
      setError("");
      const token = await getToken();
      const response = await fetch(`/api/documents/${doc.id}/ask`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ question }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not answer question.");
      setAnswer(data.answer);
      saveChat({ id: crypto.randomUUID(), documentId: doc.id, title: doc.title, question, answer: data.answer, createdAt: new Date().toISOString() });
    } catch (askError) { setError(askError instanceof Error ? askError.message : "Could not answer question."); }
  }

  if (busy) return <main className="shell"><nav className="nav"><Link className="brand" href="/">Mur<i>d</i>ock</Link><AuthControls /></nav><section className="upload"><div className="loader" role="status"><span className="spinner" />Loading your document...</div></section></main>;
  if (error && !doc) return <main className="shell"><nav className="nav"><Link className="brand" href="/">Mur<i>d</i>ock</Link><AuthControls /></nav><p className="form-error">{error}</p><Link className="btn" href="/">Upload another document</Link></main>;
  if (!doc) return null;

  return <main className="shell"><nav className="nav"><Link className="brand" href="/">Mur<i>d</i>ock</Link><div className="nav-right"><Link className="btn ghost" href="/dashboard">Dashboard</Link><Link className="btn ghost" href="/">New document</Link><AuthControls /></div></nav>{error && <p className="form-error">{error}</p>}<div className="notice">Informational, not legal advice. Every explanation and flag below links back to a clause in this document.</div><div className="workspace" style={{ marginTop: 18 }}><section className="card"><div className="doc-head"><div><h2>{doc.title}</h2><span className="eyebrow">Structured clause view</span></div><span>{doc.clauses.length} clauses</span></div><div className="clauses">{doc.clauses.map((clause) => <article id={clause.id} key={clause.id} className={`clause ${clause.riskLevel}`}><div className="meta">{clause.sectionLabel} · {clause.clauseType}</div><p>{clause.rawText}</p><p className="summary">In plain language: {clause.plainLanguageSummary}</p>{clause.riskExplanation && <p><b>Why this matters:</b> {clause.riskExplanation}</p>}<span className="citation">Source: {clause.sectionLabel}</span></article>)}</div></section><aside className="side"><section className="card"><h3>Risk label</h3><div className="score">{flagged.length}</div><p style={{ fontSize: 13, color: "#68786e" }}>clauses needing attention</p>{flagged.map((clause) => <div className="flag" key={clause.id}><b>{clause.riskLevel}</b> · <a href={`#${clause.id}`}>{clause.sectionLabel}</a></div>)}</section><section className="card"><h3>Ask Murdock</h3><div className="notice">Information only — not a substitute for legal advice.</div><form className="chat" onSubmit={ask}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What does termination mean?" /><button className="btn" type="submit">Ask</button></form>{answer && <p className="answer">{answer}</p>}</section></aside></div></main>;
}
