import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/api-auth";
import { getDocument } from "../../../../lib/document-service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser();
    if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const { id } = await params;
    const document = getDocument(id, userId);
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    return NextResponse.json(document);
  } catch (error) {
    console.error("Document lookup failed", error);
    return NextResponse.json({ error: "An unexpected API error occurred." }, { status: 500 });
  }
}
