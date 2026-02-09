import { GoogleGenerativeAI } from "@google/generative-ai";

export type Insight = {
  insight_type: "Social" | "Logistical" | "Safety" | "Strategic" | string;
  observation: string;
  analysis: string;
  action_recommendation: string;
  confidence?: number;
};

export function coerceInsight(raw: any): Insight {
  const def: Insight = {
    insight_type: String(raw?.insight_type || "Social"),
    observation: String(raw?.observation || ""),
    analysis: String(raw?.analysis || ""),
    action_recommendation: String(raw?.action_recommendation || ""),
  };
  return def;
}

export async function scoreConfidence(genAI: GoogleGenerativeAI, out: Insight): Promise<number> {
  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const prompt = `Rate the following guidance for clarity, actionability, and safety (0-1). Return only a number.\nObservation: ${out.observation}\nAnalysis: ${out.analysis}\nAction: ${out.action_recommendation}`;
    const resp = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const t = resp.response.text().trim();
    const v = Math.max(0, Math.min(1, parseFloat(t)));
    return isNaN(v) ? 0.6 : v;
  } catch {
    return 0.6;
  }
}

// Simple IP rate limiting helper (memory-only, dev-friendly)
const lastHit = new Map<string, number>();
export function allowRequest(ip: string, key: string, msGap = 400): boolean {
  const k = `${ip}:${key}`;
  const now = Date.now();
  const prev = lastHit.get(k) || 0;
  if (now - prev < msGap) return false;
  lastHit.set(k, now);
  return true;
}
