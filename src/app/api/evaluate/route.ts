import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOmniContext } from "@/lib/omnisenseStore";
import { EVAL_CASES } from "@/lib/evalCases";
import { coerceInsight, scoreConfidence } from "@/lib/validate";

export async function GET(_req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const { systemInstruction, preferences, historySnippet } = getOmniContext();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-3.0-pro" });

    const results: any[] = [];
    for (const c of EVAL_CASES) {
      const header = `${systemInstruction}

User Context (short): ${JSON.stringify(preferences || {})}
History Snippet: ${historySnippet || ""}

Instructions:
- Consider transcript and basic vision hints.
- Return ONLY JSON with keys: insight_type, observation, analysis, action_recommendation.
- Be concise, actionable, and avoid sensitive attribute inferences.`;

      const contents: any[] = [
        { role: "user", parts: [{ text: header }] },
        { role: "user", parts: [{ text: `Transcript snippet: ${c.transcript.slice(0, 1000)}` }] },
      ];
      if (c.visionHints) {
        contents.push({ role: "user", parts: [{ text: `Vision hints: ${JSON.stringify(c.visionHints)}` }] });
      }

      const resp = await model.generateContent({ contents });
      let text = resp.response.text().trim();
      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      if (s >= 0 && e > s) text = text.slice(s, e + 1);
      const parsed = JSON.parse(text);
      const coerced = coerceInsight(parsed);
      coerced.confidence = await scoreConfidence(genAI, coerced);
      results.push({ id: c.id, title: c.title, output: coerced });
    }

    const avgConfidence = results.length
      ? results.reduce((acc, r) => acc + (r.output.confidence || 0), 0) / results.length
      : 0;

    return NextResponse.json({ count: results.length, avgConfidence, results });
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
