import { executeTool } from "./tools";
import { Policy, listPolicies, markPolicyFired, removeExpiredPolicies } from "./policyStore";

function privacyAllowed(policy: Policy, privacy: string) {
  if (!policy.safeguards?.privacy) return true;
  const p = policy.safeguards.privacy;
  if (p === "off") return true;
  if (p === "local") return privacy === "local" || privacy === "cloud";
  if (p === "cloud") return privacy === "cloud";
  return true;
}

function cooldownOk(policy: Policy, now: number) {
  const cd = policy.safeguards?.cooldownMs || 0;
  if (!cd) return true;
  if (!policy.lastFiredAt) return true;
  return now - policy.lastFiredAt >= cd;
}

function predicateMatch(observation: Record<string, any>, triggers: any): boolean {
  // Minimal predicate: triggers.match is an object of { key: value } that must equal in observation
  // Optional triggers.anyTrue: array of { path: string } where truthy in observation
  if (!triggers) return false;
  if (triggers.match) {
    for (const [k, v] of Object.entries(triggers.match)) {
      if (observation?.[k] !== v) return false;
    }
  }
  if (Array.isArray(triggers.anyTrue)) {
    const ok = triggers.anyTrue.some((x: any) => !!observation?.[x.path]);
    if (!ok) return false;
  }
  if (triggers.threshold) {
    const { key, gte } = triggers.threshold;
    if (typeof gte === "number" && !(Number(observation?.[key]) >= gte)) return false;
  }
  return true;
}

export async function evaluatePolicies(opts: { observation: Record<string, any>; privacy: string }) {
  const now = Date.now();
  removeExpiredPolicies(now);
  const policies = listPolicies()
    .filter((p) => p.expiresAt > now)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const p of policies) {
    if (!privacyAllowed(p, opts.privacy)) continue;
    if (!cooldownOk(p, now)) continue;
    if (!predicateMatch(opts.observation, p.triggers)) continue;

    // Execute actions sequentially
    for (const act of p.actions || []) {
      try {
        await executeTool({ name: String(act.name), args: act.args || {} });
      } catch {}
    }
    // Optional verification entry
    if (p.verify?.claim) {
      try { await executeTool({ name: "agent.verify_step", args: { claim: p.verify.claim, pass: true } }); } catch {}
    }
    markPolicyFired(p.id);
  }
}
