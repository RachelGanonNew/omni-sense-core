import { NextRequest, NextResponse } from "next/server";
import { addPolicy, validatePolicySafety, Policy } from "@/lib/policyStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, intent, triggers, actions, safeguards, verify, ttlMs, priority } = body || {};
    if (!id || !intent || !triggers || !actions || !ttlMs) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    const pol: Policy = {
      id: String(id),
      intent: String(intent),
      triggers: triggers || {},
      actions: Array.isArray(actions) ? actions : [],
      safeguards: safeguards || { cooldownMs: 60000, privacy: "cloud" },
      verify: verify?.claim ? { claim: String(verify.claim) } : undefined,
      ttlMs: Number(ttlMs),
      priority: typeof priority === "number" ? priority : 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + Number(ttlMs),
      fireCount: 0,
    };
    const safety = validatePolicySafety(pol);
    if (!safety.ok) return NextResponse.json({ error: safety.error }, { status: 400 });
    addPolicy(pol);
    return NextResponse.json({ ok: true, id: pol.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
