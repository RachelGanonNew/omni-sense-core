import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const { notesText } = await req.json();
    if (!notesText || typeof notesText !== "string") {
      return NextResponse.json({ error: "notesText required" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-3-pro-preview" });

    const prompt = `Extract clear action items from the meeting notes.
- Output JSON only with this shape:
{
  "summary": string,
  "actions": [
    {"type":"task","title":string,"owner"?:string,"due"?:string},
    {"type":"calendar","title":string,"attendees"?:string[],"date"?:string,"time"?:string}
  ]
}
Notes:\n${notesText}`;

    const resp = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = resp.response.text();
    // Try to locate JSON in response
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    let parsed: any = { summary: "", actions: [] };
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const jsonStr = text.slice(jsonStart, jsonEnd + 1);
      try {
        parsed = JSON.parse(jsonStr);
      } catch {}
    }
    if (!parsed || !Array.isArray(parsed.actions)) parsed = { summary: text.slice(0, 300), actions: [] };

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
