import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/api-auth";
import { extractGraph, sampleText, saveDocument } from "../../../../lib/document-service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const userId = await requireUser();
    if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    return NextResponse.json(saveDocument(extractGraph(userId, "Sample rental agreement", sampleText())), { status: 201 });
  } catch (error) {
    console.error("Sample document failed", error);
    return NextResponse.json({ error: "An unexpected API error occurred." }, { status: 500 });
  }
}
