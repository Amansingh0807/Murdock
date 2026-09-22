import { NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/api-auth";
import { ownedDocument, questionSchema, referencedAnswer } from "../../../../../lib/document-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser();
    if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const parsed = questionSchema.safeParse(await request.json());
    const { id } = await params;
    const document = ownedDocument(id, userId);
    if (!parsed.success) return NextResponse.json({ error: "Request rejected." }, { status: 400 });
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    return NextResponse.json({ answer: referencedAnswer(document, parsed.data.question) });
  } catch (error) {
    console.error("Question request failed", error);
    return NextResponse.json({ error: "An unexpected API error occurred." }, { status: 500 });
  }
}
