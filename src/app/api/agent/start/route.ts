import { NextRequest, NextResponse } from "next/server";
import { agentStart } from "@/lib/agentStore";

export async function POST(_req: NextRequest) {
  const sess = agentStart();
  return NextResponse.json({ ok: true, session: { id: sess.id, startedAt: sess.startedAt } });
}
