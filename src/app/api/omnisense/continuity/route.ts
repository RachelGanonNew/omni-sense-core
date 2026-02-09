import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOmniContext } from "@/lib/omnisenseStore";
import { listRecentInteractions, buildLongMemorySnippet } from "@/lib/longMemory";
import { listTasks } from "@/lib/taskStore";
import { feedbackStats } from "@/lib/feedbackStore";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "summary"; // summary | timeline | review

    const { preferences } = getOmniContext();
    const interactions = await listRecentInteractions({ limit: 100, preferences: preferences || {} });
    const tasks = listTasks();
    const stats = feedbackStats();

    if (mode === "timeline") {
      // Group interactions by day
      const byDay: Record<string, { count: number; kinds: Record<string, number>; first: number; last: number }> = {};
      for (const ev of interactions) {
        const d = new Date(typeof ev.t === "number" && ev.t > 0 ? ev.t : Date.now());
        const day = (isNaN(d.getTime()) ? new Date() : d).toISOString().slice(0, 10);
        if (!byDay[day]) byDay[day] = { count: 0, kinds: {}, first: ev.t, last: ev.t };
        byDay[day].count++;
        byDay[day].kinds[ev.kind] = (byDay[day].kinds[ev.kind] || 0) + 1;
        if (ev.t < byDay[day].first) byDay[day].first = ev.t;
        if (ev.t > byDay[day].last) byDay[day].last = ev.t;
      }
      const timeline = Object.entries(byDay)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([day, data]) => ({ day, ...data }));

      return NextResponse.json({
        timeline,
        totalInteractions: interactions.length,
        tasks: tasks.slice(-20),
        feedback: stats,
      });
    }

    if (mode === "review") {
      // Monthly/weekly review — needs Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      const longMemory = await buildLongMemorySnippet({ preferences: preferences || {}, limit: 60, maxChars: 4000 });

      const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
      const completedTasks = tasks.filter((t) => t.status === "done");

      if (!apiKey) {
        return NextResponse.json({
          mode: "review",
          offline: true,
          summary: `${interactions.length} interactions tracked. ${pendingTasks.length} pending tasks, ${completedTasks.length} completed.`,
          pendingTasks: pendingTasks.slice(-10),
          completedTasks: completedTasks.slice(-10),
          feedback: stats,
          patterns: [],
          reminders: pendingTasks.slice(0, 3).map((t) => `Pending: ${t.title}`),
        });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });

      const prompt = `You are an autonomous meeting continuity agent. Analyze the user's interaction history and task list to produce a review.

Long-term Memory (recent interactions):
${longMemory || "(none)"}

Tasks:
- Pending: ${pendingTasks.slice(-10).map((t) => t.title).join(", ") || "none"}
- Completed: ${completedTasks.slice(-10).map((t) => t.title).join(", ") || "none"}

Feedback stats: ${stats.total} ratings, ${(stats.accuracy * 100).toFixed(0)}% positive

Return ONLY JSON with these keys:
- summary: string (2-3 sentence overview of recent activity)
- patterns: string[] (recurring themes or issues detected across sessions)
- reminders: string[] (proactive follow-ups the user should address)
- goalProgress: string (assessment of long-term goal tracking)
- recommendations: string[] (suggestions for improvement)`;

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

      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      let parsed: any = {};
      if (s >= 0 && e > s) {
        try { parsed = JSON.parse(text.slice(s, e + 1)); } catch {}
      }

      return NextResponse.json({
        mode: "review",
        offline: false,
        ...parsed,
        pendingTasks: pendingTasks.slice(-10),
        completedTasks: completedTasks.slice(-10),
        feedback: stats,
      });
    }

    // Default: summary mode
    return NextResponse.json({
      mode: "summary",
      totalInteractions: interactions.length,
      recentKinds: interactions.slice(0, 20).map((i) => i.kind),
      tasks: {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === "pending").length,
        inProgress: tasks.filter((t) => t.status === "in_progress").length,
        done: tasks.filter((t) => t.status === "done").length,
        blocked: tasks.filter((t) => t.status === "blocked").length,
      },
      feedback: stats,
      oldestInteraction: interactions.length ? new Date(typeof interactions[interactions.length - 1].t === "number" ? interactions[interactions.length - 1].t : Date.now()).toISOString() : null,
      newestInteraction: interactions.length ? new Date(typeof interactions[0].t === "number" ? interactions[0].t : Date.now()).toISOString() : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "failed", detail: String(e?.message || e) }, { status: 500 });
  }
}
