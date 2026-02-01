import { NextRequest, NextResponse } from "next/server";
import { getOmniContext, setOmniContext } from "@/lib/omnisenseStore";

export async function GET() {
  const ctx = getOmniContext();
  return NextResponse.json({
    systemInstruction: ctx.systemInstruction,
    preferences: ctx.preferences || {},
    historySnippet: ctx.historySnippet || "",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { systemInstruction, preferences, historySnippet } = body || {};
    const updated = setOmniContext({ systemInstruction, preferences, historySnippet });
    return NextResponse.json({ ok: true, context: updated });
  } catch (e) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
}
