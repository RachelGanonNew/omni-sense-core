import { NextRequest, NextResponse } from "next/server";
import { agentStop } from "@/lib/agentStore";

export async function POST(_req: NextRequest) {
  const sess = agentStop();
  if (!sess) return NextResponse.json({ error: "no_active_session" }, { status: 400 });
  return NextResponse.json({ ok: true, session: { id: sess.id, startedAt: sess.startedAt, endedAt: sess.endedAt } });
}
