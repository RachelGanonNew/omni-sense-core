import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOmniContext } from "./omnisenseStore";
import { agentAddEvent, agentGet } from "./agentStore";
import { toolsSchemaSummary, executeTool, ToolCall } from "./tools";
import { evaluatePolicies } from "./brain";
import { logJsonl } from "./log";
import { assembleLongContext } from "./context";
import { appendInteraction, buildLongMemorySnippet } from "./longMemory";

export type AgentStepInput = {
  observation: Record<string, any>;
  preferences?: Record<string, any>;
  maxTools?: number;
};

export type AgentStepOutput = {
  thoughts: string;
  toolCalls: Array<{ name: string; args: Record<string, any>; ok: boolean; result?: any; error?: string }>;
  final?: string;
  level?: 1 | 2 | 3;
  signature?: string;
};

export async function runAgentStep(input: AgentStepInput): Promise<AgentStepOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const demo: AgentStepOutput = { thoughts: "Demo: no API key present", toolCalls: [], final: "No-op" };
    agentAddEvent("system", { kind: "agent.step", details: demo });
    return demo;
  }
  const { systemInstruction, preferences: prefStore } = getOmniContext();
  const prefs = input.preferences || prefStore || {};

  const sess = agentGet();
  const stats = sess?.stats || {};

  const schema = toolsSchemaSummary();
  const modelName = process.env.GEMINI_MODEL || "gemini-3-pro-preview";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const longCtx = assembleLongContext();
  const longMemory = await buildLongMemorySnippet({ preferences: prefs, limit: 24, maxChars: 2200 });

  // Detect if this is a Planner goal-execution call vs a live social-translation call
  const goalText = input.observation?.goal;
  const isGoalMode = typeof goalText === "string" && goalText.length > 0;

  const prompt = isGoalMode
    ? `You are OmniSense Planner — an autonomous goal-execution agent.

GOAL: ${goalText}
STEP INDEX: ${input.observation?.step_index ?? 0}

YOUR JOB: Break the goal into concrete actions and execute them using the TOOLS below.
- Think step-by-step about what needs to happen to accomplish the goal.
- Use tools to search the web, create tasks, write notes, create calendar events, and verify your work.
- After executing tools, provide a clear, actionable summary of what you accomplished.

OUTPUT CONTRACT (STRICT): Return ONLY JSON with keys:
- thoughts: your step-by-step reasoning (1-3 sentences)
- tool_calls: array of { name, args } from TOOLS below (use at least 1 tool when possible)
- final: a clear, helpful summary of what was done or found (plain text, 2-6 sentences). Do NOT use the "The Vibe / Hidden Meaning / Red Flags / Social Script" format. Write a direct, useful answer.

TOOLS (JSON schema summary):\n${JSON.stringify(schema)}

CONTEXT:
- Preferences: ${JSON.stringify(prefs)}
- Stats: ${JSON.stringify(stats)}
- LongContext: ${longCtx}
- LongTermMemory:\n${longMemory || "(none)"}
`
    : `${systemInstruction}

IMPORTANT: Ignore any output-format requirements above. Follow the OUTPUT CONTRACT below exactly.

ROLE: You are OmniSense — The Tactical Fixer.
You are a high-speed social intelligence engine. Your goal is to give the user the "Perfect Move" to handle any social friction instantly. Keep analysis minimal and the solution maximal.

ADAPTATION & MEMORY:
- Use LONG-TERM MEMORY to detect patterns over time (relationship dynamics, recurring triggers, preferred communication style).
- Incorporate cultural/communication-norm nuance only when evidence supports it; do not stereotype.

OPERATIONAL PRINCIPLE: Always provide a "Graceful Exit." Give the other person a way to tell the truth without feeling embarrassed.

PRINCIPLES:
- Subtext-first: contrast literal words vs likely intent.
- Detect sarcasm/irony from mismatches (tone, facial expression, timing) when evidence supports it.
- Be direct about social risk (manipulative/condescending cues) but do not insult.
- Do not infer protected traits or identity. Avoid biometric claims.
- Provide definitive, usable guidance — give the exact sentence to say.
- Keep language simple and speakable.

OUTPUT CONTRACT (STRICT): Return ONLY JSON with keys:
- thoughts: brief reasoning summary (concise; do not reveal private chain-of-thought)
- tool_calls: array of { name, args } from TOOLS below (may be empty)
- final: user-facing guidance in EXACTLY 3 short lines:
  The Leak: 1 sentence on the truth — what is really happening right now.
  The Fix: The exact action and sentence to solve it NOW. Be specific — give a quote the user can say.
  The Vibe: 2-3 words on the body language to use (e.g., "Playful wink, lean back").

TOOLS (JSON schema summary):\n${JSON.stringify(schema)}

INPUTS:
- Observation: ${JSON.stringify(input.observation)}
- Preferences: ${JSON.stringify(prefs)}
- Stats: ${JSON.stringify(stats)}
- LongContext: ${longCtx}
- LongTermMemory (recent interactions; may be empty):\n${longMemory || ""}
`;

  const started = Date.now();
  // Resilient call with retry/backoff
  async function callWithRetry(attempts = 3): Promise<string> {
    let delay = 250;
    let lastErr: any = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const resp = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
        return resp.response.text().trim();
      } catch (e: any) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, delay + Math.floor(Math.random() * 100)));
        delay = Math.min(2000, delay * 2);
      }
    }
    // Log failure and emit verification FAIL
    agentAddEvent("system", { kind: "agent.error", details: { where: "runAgentStep.generateContent", error: String(lastErr?.message || lastErr) } });
    try { await executeTool({ name: "agent.verify_step", args: { claim: "Model call failed after retries", evidence: "generateContent", pass: false } }); } catch {}
    // Return a user-facing explanation while keeping the run consistent.
    return JSON.stringify({
      thoughts: "Gemini API unreachable; returning fallback response.",
      tool_calls: [],
      final: isGoalMode
        ? "Could not complete the goal — Gemini API call failed. Please check your API key, quota, and network, then retry."
        : "The Leak: AI is temporarily offline — Gemini API call failed.\n" +
          "The Fix: Check your API key, quota, and network, then retry.\n" +
          "The Vibe: Patient pause, deep breath.",
    });
  }

  let text = await callWithRetry(3);
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s >= 0 && e > s) text = text.slice(s, e + 1);
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch {
    parsed = { thoughts: text, tool_calls: [] };
  }

  const toolCalls: ToolCall[] = Array.isArray(parsed.tool_calls) ? parsed.tool_calls.slice(0, input.maxTools || 2) : [];
  logJsonl({ type: "agent_prompt", tokens_est: Math.ceil(prompt.length / 4), tool_calls: toolCalls.length });

  const executed: AgentStepOutput["toolCalls"] = [];
  for (const call of toolCalls) {
    const res = await executeTool({ name: String(call.name), args: call.args || {} });
    executed.push({ name: res.name, args: call.args || {}, ok: res.ok, result: res.result, error: res.error });
  }

  // Thought signature and level selection
  const okCount = executed.filter((e) => e.ok).length;
  let level: 1 | 2 | 3 = okCount > 0 ? 1 : 2; // escalate if nothing succeeded
  const signature = `obs:${Object.keys(input.observation||{}).slice(0,4).join(',')}|tools:${executed.map(e=>e.name).join('+')}|ok:${okCount}`;
  logJsonl({ type: "thought_signature", level, signature });

  // Basic self-check verification
  try {
    await executeTool({ name: "agent.verify_step", args: { claim: `Executed ${executed.length} tool(s) with ${okCount} success`, evidence: signature, pass: okCount > 0 } });
  } catch {}

  // Level 3 escalation: if Level 2 with attempted tools and no success, perform a cross-check and record escalation
  if (level === 2 && executed.length > 0 && okCount === 0) {
    level = 3;
    try {
      await executeTool({ name: "notes.write", args: { text: "Level 3 escalation: no successful tools; documenting uncertainty and requesting follow-up." } });
    } catch {}
    try {
      await executeTool({ name: "agent.event", args: { kind: "agent.level3", details: { signature, toolCalls: executed.map(e=>e.name) } } });
    } catch {}
    try {
      await executeTool({ name: "agent.verify_step", args: { claim: "Level 3 escalation executed (no successful tools)", evidence: signature, pass: false } });
    } catch {}
  }

  // Evaluate dynamic policies after tool execution (policy engine is tool-agnostic)
  try {
    const privacy = String((prefs as any)?.privacyMode || "cloud");
    await evaluatePolicies({ observation: input.observation || {}, privacy });
  } catch {}

  const out: AgentStepOutput = {
    thoughts: String(parsed.thoughts || ""),
    toolCalls: executed,
    final: parsed.final ? String(parsed.final) : undefined,
    level,
    signature,
  };

  agentAddEvent("system", { kind: "agent.step", ms: Date.now() - started, output: out });
  logJsonl({ type: "agent_step", ms: Date.now() - started, tools: executed.length });
  try {
    await appendInteraction(
      "agent.step",
      {
        input: { observation: input.observation, preferences: prefs },
        output: { thoughts: out.thoughts, final: out.final, level: out.level, signature: out.signature },
        meta: { tools: executed.map((t) => ({ name: t.name, ok: t.ok })) },
        preferences: prefs,
      },
      { maxItems: 800 }
    );
  } catch {}
  return out;
}
