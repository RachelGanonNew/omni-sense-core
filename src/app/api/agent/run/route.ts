import { NextRequest, NextResponse } from "next/server";
import { assembleLongContext } from "@/lib/context";
import { runAgentStep } from "@/lib/agent";
import { agentAddEvent } from "@/lib/agentStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const goal: string = String(body.goal || "");
    const steps: number = Math.max(1, Math.min(10, Number(body.steps || 3)));
    const maxTools: number = Math.max(0, Math.min(5, Number(body.maxToolsPerStep || 2)));
    const userPrefs = body.preferences || {};

    if (!goal) return NextResponse.json({ error: "missing_goal" }, { status: 400 });

    const started = Date.now();
    const trace: any[] = [];
    let final: string | null = null;

    for (let i = 0; i < steps; i++) {
      const longCtx = assembleLongContext();
      const observation = { goal, step_index: i, long_context_hint: longCtx.slice(0, 2000) };
      const out = await runAgentStep({ observation, preferences: userPrefs, maxTools });
      trace.push({ i, out });
      agentAddEvent("system", { kind: "agent.run_step", index: i, tools: out.toolCalls.length });
      // Early stop if model provided a final
      if (out.final && out.final.length > 0) {
        final = String(out.final);
        break;
      }
    }

    if (!final) {
      const last = trace[trace.length - 1]?.out?.final;
      final = last ? String(last) : null;
    }

    return NextResponse.json({ ok: true, goal, steps: trace.length, final, ms: Date.now() - started });
  } catch (e: any) {
    const detail = String(e?.message || e);
    agentAddEvent("system", { kind: "agent.run_failed", error: detail });
    return NextResponse.json({ error: "failed", detail }, { status: 500 });
  }
}
