import fs from "fs";
import path from "path";

export type Policy = {
  id: string;
  intent: string;
  triggers: any; // JSON predicate spec
  actions: any[]; // array of { name, args }
  safeguards?: { cooldownMs?: number; maxFirings?: number; privacy?: "off"|"local"|"cloud" };
  verify?: { claim: string };
  ttlMs: number;
  priority?: number;
  createdAt: number;
  expiresAt: number;
  lastFiredAt?: number;
  fireCount?: number;
};

function dataFile() {
  const p = path.join(process.cwd(), ".data", "policies.json");
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, "[]", { encoding: "utf8" });
  return p;
}

export function listPolicies(): Policy[] {
  try {
    const p = dataFile();
    const raw = fs.readFileSync(p, "utf8") || "[]";
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function savePolicies(items: Policy[]): void {
  const p = dataFile();
  fs.writeFileSync(p, JSON.stringify(items, null, 2));
}

export function addPolicy(pol: Policy): Policy {
  const items = listPolicies();
  const existingIdx = items.findIndex((x) => x.id === pol.id);
  if (existingIdx >= 0) items[existingIdx] = pol; else items.push(pol);
  savePolicies(items);
  return pol;
}

export function removeExpiredPolicies(now = Date.now()): void {
  const items = listPolicies();
  const kept = items.filter((p) => p.expiresAt > now && (p.safeguards?.maxFirings ? (p.fireCount || 0) < (p.safeguards!.maxFirings as number) : true));
  if (kept.length !== items.length) savePolicies(kept);
}

export function markPolicyFired(id: string): void {
  const items = listPolicies();
  const idx = items.findIndex((p) => p.id === id);
  if (idx >= 0) {
    const it = items[idx];
    it.lastFiredAt = Date.now();
    it.fireCount = (it.fireCount || 0) + 1;
    items[idx] = it;
    savePolicies(items);
  }
}

export function validatePolicySafety(pol: Policy): { ok: boolean; error?: string } {
  // Minimal guardrails: forbid explicit medical advice keywords and sensitive inference hints.
  const txt = `${pol.intent} ${JSON.stringify(pol.actions || [])}`.toLowerCase();
  if (/(diagnos|prescrib|medical advice|therapy)/.test(txt)) return { ok: false, error: "forbidden_scope" };
  if (/(demograph|ethnic|religion|political)/.test(txt)) return { ok: false, error: "sensitive_inference" };
  return { ok: true };
}
