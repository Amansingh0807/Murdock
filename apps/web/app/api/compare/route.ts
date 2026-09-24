import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import {
  compareAgreementsWithAI,
  compareSchema,
  extractGraph,
  ownedDocument,
  saveDocument,
} from "../../../lib/document-service";

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
    const comparison = await compareAgreementsWithAI(left.title, left.clauses, parsed.data.rightText);
    return NextResponse.json({
      summary: comparison.summary,
      keyDifferences: comparison.keyDifferences,
      riskShifts: comparison.riskShifts,
      recommendationsForLawyer: comparison.recommendationsForLawyer,
    });
  } catch (error) {
    console.error("Document comparison failed", error);
    return NextResponse.json({ error: "An unexpected API error occurred." }, { status: 500 });
  }
}
