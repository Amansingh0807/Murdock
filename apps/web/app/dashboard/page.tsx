"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthControls } from "../auth-controls";
import { ChatItem, getChatHistory, getDocumentHistory, HistoryItem } from "../../lib/client-history";

export default function DashboardPage() {
  const [documents, setDocuments] = useState<HistoryItem[]>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
  useEffect(() => { setDocuments(getDocumentHistory()); setChats(getChatHistory()); }, []);
  return <main className="shell"><nav className="nav"><Link className="brand" href="/">Mur<i>d</i>ock</Link><div className="nav-right"><Link className="btn" href="/">New document</Link><AuthControls /></div></nav><section className="hero dashboard-hero"><div className="eyebrow">Your workspace</div><h1>Documents and past chats.</h1><p>Pick up where you left off. Your recent activity is kept in this browser.</p></section><div className="dashboard-grid"><section className="card dashboard-panel"><div className="doc-head"><div><h2>Documents</h2><span className="eyebrow">{documents.length} saved</span></div></div>{documents.length ? <div className="history-list">{documents.map((document) => <Link className="history-item" href={`/documents/${document.id}`} key={document.id}><span><b>{document.title}</b><small>{new Date(document.createdAt).toLocaleString()}</small></span><strong>Open →</strong></Link>)}</div> : <div className="empty-state"><p>No documents yet.</p><Link className="btn" href="/">Analyse your first document</Link></div>}</section><section className="card dashboard-panel"><div className="doc-head"><div><h2>Past chats</h2><span className="eyebrow">{chats.length} questions</span></div></div>{chats.length ? <div className="chat-history">{chats.map((chat) => <article className="chat-item" key={chat.id}><small>{chat.title} · {new Date(chat.createdAt).toLocaleString()}</small><b>{chat.question}</b><p>{chat.answer}</p><Link href={`/documents/${chat.documentId}`}>Return to document →</Link></article>)}</div> : <div className="empty-state"><p>Your document questions will appear here.</p></div>}</section></div></main>;
}
