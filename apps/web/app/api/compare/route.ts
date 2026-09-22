import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { compareSchema, extractGraph, ownedDocument, saveDocument } from "../../../lib/document-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const parsed = compareSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Request rejected." }, { status: 400 });
    const left = ownedDocument(parsed.data.leftDocumentId, userId);
    if (!left) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const right = saveDocument(extractGraph(userId, "Pasted comparison", parsed.data.rightText));
    const misses = left.clauses.filter((clause) => !right.clauses.some((other) => other.clauseType === clause.clauseType));
    return NextResponse.json({ summary: `Compared ${left.clauses.length} source clauses with ${right.clauses.length} clauses in the pasted version. ${misses.length} original clause types have no matching clause: ${misses.map((clause) => clause.sectionLabel).join(", ") || "none"}. Review these cited sections with a lawyer for their practical effect. This is general information, not legal advice.` });
  } catch (error) {
    console.error("Document comparison failed", error);
    return NextResponse.json({ error: "An unexpected API error occurred." }, { status: 500 });
  }
}
