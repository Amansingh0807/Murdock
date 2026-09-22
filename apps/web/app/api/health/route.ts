import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ name: "Murdock API", status: "ok", authRequired: process.env.AUTH_REQUIRED === "true" || process.env.NODE_ENV === "production" });
}
