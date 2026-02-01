import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOmniContext } from "@/lib/omnisenseStore";
import { allowRequest, coerceInsight, scoreConfidence } from "@/lib/validate";
import { agentAddEvent, agentGet } from "@/lib/agentStore";
import { addPersonSeen } from "@/lib/memoryStore";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Demo mode fallback so public deployments can be explored without a key
      const body = await req.json().catch(() => ({}));
      const sample = coerceInsight({
        insight_type: "Social",
        observation: "Balanced turn-taking could be improved",
        analysis: "One voice dominates; others paused. Consider inviting input and clarifying next steps.",
        action_recommendation: "Invite 1-2 quieter members to weigh in and assign owners + dates for top items.",
      });
      sample.confidence = 0.5;
      agentAddEvent("insight", sample);
      return NextResponse.json(sample);
    }
    // Simple rate limit per IP
    const ip = req.headers.get("x-forwarded-for") || "local";
    if (!allowRequest(ip, "omni-analyze", 400)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const body = await req.json();

    const {
      audioDynamics, // { intensityPct:number, speaking:boolean, interruption:boolean }
      visionHints,   // { scene?: string, objects?: string[] }
      transcript,    // partial ASR text
      overrideSystemInstruction,
    } = body || {};

    const { systemInstruction, preferences, historySnippet } = getOmniContext();
    const sess = agentGet();
    const fp = sess?.stats?.falsePositives || 0;
    const imp = sess?.stats?.improvements || 0;
    let tuning = "";
    if (fp - imp >= 3) {
      tuning = "Be more conservative; only output recommendations when highly supported. Prefer observations over strong actions.";
    } else if (imp - fp >= 3) {
      tuning = "Be more proactive; suggest specific next actions where appropriate.";
    }
    const system = overrideSystemInstruction || systemInstruction;

    // Privacy enforcement
    const privacy = preferences?.privacyMode || "cloud";
    if (privacy === "off") {
      return NextResponse.json({ error: "privacy_off" }, { status: 403 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-3.0-pro" });

    const prompt = `${system}

User Context (short): ${JSON.stringify(preferences || {})}
History Snippet: ${historySnippet || ""}

Live Observations:
- Audio: ${JSON.stringify(audioDynamics || {})}
- Vision: ${JSON.stringify(visionHints || {})}
- Transcript: ${transcript || ""}

Instructions:
- Return ONLY a JSON object with keys: insight_type, observation, analysis, action_recommendation.
- Keep it concise and actionable.
- Avoid sensitive attribute inferences; do not mention biometrics or identity.
${tuning ? `\nTuning: ${tuning}` : ""}
`;

    // If privacy local mode, avoid cloud calls, return heuristic demo insight
    if (privacy === "local") {
      const local = coerceInsight({
        insight_type: "Strategic",
        observation: "Local mode enabled — providing generic advice",
        analysis: "Based on audio dynamics and transcript snippet only.",
        action_recommendation: "Invite others, clarify owners/dates, and timebox decisions.",
      });
      local.confidence = 0.45;
      agentAddEvent("insight", local);
      // Memory: naive person extraction from transcript
      if (transcript) {
        const m = transcript.match(/[A-Z][a-z]+\s+[A-Z][a-z]+/g);
        if (m) m.slice(0, 3).forEach((n: string) => addPersonSeen(n));
      }
      return NextResponse.json(local);
    }

    // Simple retry/backoff for transient failures
    const genOnce = async () => await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    let resp: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        resp = await genOnce();
        break;
      } catch (e) {
        if (attempt === 2) throw e;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    let text = resp.response.text().trim();

    // Try to extract JSON
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s >= 0 && e > s) text = text.slice(s, e + 1);
    const parsed = JSON.parse(text);
    const coerced = coerceInsight(parsed);
    const conf = await scoreConfidence(genAI, coerced);
    coerced.confidence = conf;
    agentAddEvent("insight", coerced);
    if (transcript) {
      const m = transcript.match(/[A-Z][a-z]+\s+[A-Z][a-z]+/g);
      if (m) m.slice(0, 3).forEach((n: string) => addPersonSeen(n));
    }
    return NextResponse.json(coerced);
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
