import { NextRequest, NextResponse } from "next/server";
import { appendFeedback } from "@/lib/feedbackStore";
import { agentAddEvent } from "@/lib/agentStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { actionId, actionType, rating, correction } = body || {};

    if (!actionId || !rating || !["up", "down"].includes(rating)) {
      return NextResponse.json({ error: "actionId and rating (up|down) required" }, { status: 400 });
    }

    appendFeedback({
      t: Date.now(),
      actionId: String(actionId),
      actionType: String(actionType || "unknown"),
      rating,
      correction: correction ? String(correction).slice(0, 500) : undefined,
    });

    agentAddEvent("system", {
      kind: "autonomous.verify",
      actionId,
      actionType,
      rating,
      correction: correction ? String(correction).slice(0, 200) : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
