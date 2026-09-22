export type HistoryItem = { id: string; title: string; createdAt: string };
export type ChatItem = { id: string; documentId: string; title: string; question: string; answer: string; createdAt: string };

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(key) ?? "[]") as T[]; } catch { return []; }
}

export function getDocumentHistory() { return read<HistoryItem>("murdock.documents"); }
export function getChatHistory() { return read<ChatItem>("murdock.chats"); }
export function saveChat(item: ChatItem) { localStorage.setItem("murdock.chats", JSON.stringify([item, ...getChatHistory()].slice(0, 50))); }
