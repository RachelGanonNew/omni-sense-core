import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOmniContext } from "@/lib/omnisenseStore";
import { appendInteraction, buildLongMemorySnippet } from "@/lib/longMemory";
import { agentAddEvent } from "@/lib/agentStore";
import { createTask } from "@/lib/taskStore";
import { feedbackStats } from "@/lib/feedbackStore";

export type AutonomousAction = {
  id: string;
  type: "calendar" | "email" | "task" | "document" | "followup";
  title: string;
  description: string;
  data: any;
  confidence: number;
  status: "proposed" | "approved" | "executed" | "failed";
  executedAt?: number;
  error?: string;
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const body = await req.json().catch(() => ({}));
    const { transcript, notes, meetingSummary, executeMode } = body || {};

    const { systemInstruction, preferences } = getOmniContext();
    const longMemory = await buildLongMemorySnippet({ preferences: preferences || {}, limit: 24, maxChars: 2200 });
    const stats = feedbackStats();

    // Build context for action extraction
    const context = [
      transcript ? `Transcript: ${String(transcript).slice(0, 2000)}` : "",
      notes ? `Notes: ${String(notes).slice(0, 1500)}` : "",
      meetingSummary ? `Summary: ${String(meetingSummary).slice(0, 1000)}` : "",
    ].filter(Boolean).join("\n\n");

    if (!context.trim()) {
      return NextResponse.json({ error: "Provide transcript, notes, or meetingSummary" }, { status: 400 });
    }

    if (!apiKey) {
      // Demo fallback
      const demoActions: AutonomousAction[] = [
        {
          id: `act_${Date.now()}_1`,
          type: "task",
          title: "Review Q1 roadmap priorities",
          description: "Create a task to review and finalize Q1 roadmap based on meeting discussion",
          data: { owner: "Team Lead", due: "Next Friday", priority: "high" },
          confidence: 0.85,
          status: "proposed",
        },
        {
          id: `act_${Date.now()}_2`,
          type: "email",
          title: "Send meeting recap to stakeholders",
          description: "Draft follow-up email summarizing key decisions and action items",
          data: { to: "team@company.com", subject: "Meeting Recap - Action Items", body: "Hi team,\n\nHere are the key takeaways from today's meeting:\n\n1. Q1 priorities finalized\n2. Design review scheduled for Friday\n3. Budget approval pending\n\nPlease review and confirm your action items.\n\nBest regards" },
          confidence: 0.80,
          status: "proposed",
        },
        {
          id: `act_${Date.now()}_3`,
          type: "calendar",
          title: "Design Review Meeting",
          description: "Schedule follow-up design review based on meeting commitment",
          data: { date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), time: "14:00", duration: "60min", attendees: ["Design Team", "Product Lead"] },
          confidence: 0.90,
          status: "proposed",
        },
        {
          id: `act_${Date.now()}_4`,
          type: "document",
          title: "Meeting Minutes",
          description: "Structured meeting minutes with decisions, action items, and next steps",
          data: {
            sections: [
              { heading: "Decisions Made", items: ["Approved Q1 roadmap", "Budget allocated for new hire"] },
              { heading: "Action Items", items: ["Review roadmap (Team Lead, by Friday)", "Send budget request (Finance, by Monday)"] },
              { heading: "Next Steps", items: ["Design review on Friday at 2pm", "Monthly check-in scheduled"] },
            ],
          },
          confidence: 0.88,
          status: "proposed",
        },
        {
          id: `act_${Date.now()}_5`,
          type: "followup",
          title: "Schedule 1-week check-in",
          description: "Propose a follow-up meeting to track progress on action items",
          data: { date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), time: "10:00", duration: "30min", agenda: "Review action item progress from last meeting" },
          confidence: 0.75,
          status: "proposed",
        },
      ];
      agentAddEvent("system", { kind: "autonomous.propose.demo", count: demoActions.length });
      return NextResponse.json({ actions: demoActions, mode: "demo" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-3-pro-preview" });

    const accuracyHint = stats.total > 5
      ? `User feedback accuracy: ${(stats.accuracy * 100).toFixed(0)}%. ${stats.accuracy < 0.7 ? "Be more conservative with confidence scores." : "Maintain current quality."}`
      : "";

    const prompt = `${systemInstruction}

You are an autonomous meeting action agent. Analyze the meeting context below and extract 3-5 executable actions.

${accuracyHint}

LongTermMemory (recent interactions):
${longMemory || "(none)"}

Meeting Context:
${context}

For EACH action, return a JSON object with these exact keys:
- type: one of "calendar", "email", "task", "document", "followup"
- title: short descriptive title
- description: what this action accomplishes
- data: structured data for execution (see below)
- confidence: 0.0-1.0 how confident you are this action is correct

Data formats by type:
- calendar: { date: "YYYY-MM-DD", time: "HH:MM", duration: "Xmin", attendees: string[] }
- email: { to: string, subject: string, body: string }
- task: { owner: string, due: string, priority: "high"|"medium"|"low", notes?: string }
- document: { sections: [{ heading: string, items: string[] }] }
- followup: { date: "YYYY-MM-DD", time: "HH:MM", duration: "Xmin", agenda: string }

Return ONLY a JSON array of action objects. No markdown, no explanation.`;

    let text = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
        text = resp.response.text().trim();
        break;
      } catch (e) {
        if (attempt === 2) throw e;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }

    // Extract JSON array
    const arrStart = text.indexOf("[");
    const arrEnd = text.lastIndexOf("]");
    if (arrStart < 0 || arrEnd <= arrStart) {
      return NextResponse.json({ error: "bad_response", raw: text.slice(0, 500) }, { status: 500 });
    }
    const parsed = JSON.parse(text.slice(arrStart, arrEnd + 1));
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "expected_array" }, { status: 500 });
    }

    const actions: AutonomousAction[] = parsed.slice(0, 7).map((a: any, i: number) => ({
      id: `act_${Date.now()}_${i}`,
      type: ["calendar", "email", "task", "document", "followup"].includes(a.type) ? a.type : "task",
      title: String(a.title || `Action ${i + 1}`).slice(0, 200),
      description: String(a.description || "").slice(0, 500),
      data: a.data || {},
      confidence: Math.max(0, Math.min(1, Number(a.confidence) || 0.5)),
      status: "proposed" as const,
    }));

    // Auto-execute tasks if executeMode is true and confidence >= 0.7
    if (executeMode) {
      for (const action of actions) {
        if (action.confidence >= 0.7) {
          try {
            if (action.type === "task") {
              createTask(action.title, action.data?.notes || action.description);
              action.status = "executed";
              action.executedAt = Date.now();
            } else {
              // Other types are "executed" as proposals (calendar links, email drafts, etc.)
              action.status = "executed";
              action.executedAt = Date.now();
            }
          } catch (e: any) {
            action.status = "failed";
            action.error = e?.message || "execution_failed";
          }
        }
      }
    }

    agentAddEvent("system", { kind: "autonomous.propose", count: actions.length, executed: actions.filter((a) => a.status === "executed").length });

    try {
      await appendInteraction(
        "autonomous.execute",
        { input: { context: context.slice(0, 800) }, output: { actionCount: actions.length }, meta: { executeMode }, preferences: preferences || {} },
        { maxItems: 800 }
      );
    } catch {}

    return NextResponse.json({ actions, mode: "cloud" });
  } catch (e: any) {
    return NextResponse.json({ error: "failed", detail: String(e?.message || e) }, { status: 500 });
  }
}
