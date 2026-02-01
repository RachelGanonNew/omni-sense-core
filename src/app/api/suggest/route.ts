import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }
    const body = await req.json();
    const { intensityPct, speaking, interruption } = body ?? {};
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-3.0-pro" });

    const system = `You are a concise Social Pilot that provides short, actionable meeting guidance.
Avoid speculation. Do not reference protected traits. One sentence, direct voice.
Inputs describe live audio dynamics: intensity 0-100, speaking boolean, interruption flag.`;
    const user = `Intensity: ${intensityPct}; Speaking: ${!!speaking}; Interruption: ${interruption ? "yes" : "no"}.
Return 1 short tip (<= 18 words). If interruption=yes, prioritize de-escalation and inclusion. If speaking=true and intensity high, suggest brevity.`;

    const res = await model.generateContent({ contents: [
      { role: "user", parts: [{ text: system }] },
      { role: "user", parts: [{ text: user }] },
    ]});
    const text = res.response.text().trim();
    return NextResponse.json({ suggestion: text.slice(0, 180) });
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
