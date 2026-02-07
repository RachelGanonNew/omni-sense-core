import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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

    for (let i = 0; i < steps; i++) {
      const longCtx = assembleLongContext();
      const observation = { goal, step_index: i, long_context_hint: longCtx.slice(0, 2000) };
      const out = await runAgentStep({ observation, preferences: userPrefs, maxTools });
      trace.push({ i, out });
      agentAddEvent("system", { kind: "agent.run_step", index: i, tools: out.toolCalls.length });
      // Early stop if model provided a final
      if (out.final && out.final.length > 0) break;
    }

    // Write verification artifact for the run
    // Note: Vercel's filesystem is read-only except for /tmp.
    const cwd = process.cwd();
    const baseDir = process.env.VERCEL || cwd.startsWith("/var/task") ? "/tmp" : cwd;
    const dir = path.join(baseDir, ".data", "verify");
    const file = path.join(dir, `run_${Date.now()}.json`);
    let artifactWriteError: string | null = null;
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ goal, steps, maxTools, started, ended: Date.now(), trace }, null, 2));
    } catch (err: any) {
      artifactWriteError = String(err?.message || err);
      agentAddEvent("system", { kind: "agent.run_artifact_write_failed", error: artifactWriteError });
    }

    return NextResponse.json({ ok: true, goal, steps: trace.length, artifact: artifactWriteError ? null : file, artifactWriteError });
  } catch (e: any) {
    const detail = String(e?.message || e);
    agentAddEvent("system", { kind: "agent.run_failed", error: detail });
    return NextResponse.json({ error: "failed", detail }, { status: 500 });
  }
}
