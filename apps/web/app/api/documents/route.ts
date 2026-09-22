import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { extractGraph, fileText, saveDocument } from "../../../lib/document-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF, DOCX, or TXT file first." }, { status: 400 });
    const text = await fileText(file);
    if (!text.trim()) return NextResponse.json({ error: "The uploaded file contains no readable text." }, { status: 422 });
    return NextResponse.json(saveDocument(extractGraph(userId, file.name, text)), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The file could not be read.";
    console.error("Document upload failed", { error: message });
    const status = message.includes("too large") ? 413 : 422;
    return NextResponse.json({ error: message.includes("Unsupported file type") || message.includes("empty") || message.includes("no readable") || message.includes("too large") ? message : "The file could not be parsed. Please try a valid PDF, DOCX, or TXT file." }, { status });
  }
}
