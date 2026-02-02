import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOmniContext } from "./omnisenseStore";
import { agentAddEvent, agentGet } from "./agentStore";
import { toolsSchemaSummary, executeTool, ToolCall } from "./tools";
import { logJsonl } from "./log";

export type AgentStepInput = {
  observation: Record<string, any>;
  preferences?: Record<string, any>;
  maxTools?: number;
};

export type AgentStepOutput = {
  thoughts: string;
  toolCalls: Array<{ name: string; args: Record<string, any>; ok: boolean; result?: any; error?: string }>;
  final?: string;
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
  const modelName = process.env.GEMINI_MODEL || "gemini-3.0-pro";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `${systemInstruction}

You are an autonomous meeting and productivity agent. Given the observation, decide whether to call tools from the provided registry to achieve helpful outcomes. Prefer minimal, high-value actions.

TOOLS (JSON schema summary):\n${JSON.stringify(schema)}

Return ONLY JSON with keys: thoughts, tool_calls (array of {name,args}), final (string optional). Keep args small.

Observation: ${JSON.stringify(input.observation)}
Preferences: ${JSON.stringify(prefs)}
Stats: ${JSON.stringify(stats)}
`;

  const started = Date.now();
  const resp = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
  let text = resp.response.text().trim();
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

  const out: AgentStepOutput = {
    thoughts: String(parsed.thoughts || ""),
    toolCalls: executed,
    final: parsed.final ? String(parsed.final) : undefined,
  };

  agentAddEvent("system", { kind: "agent.step", ms: Date.now() - started, output: out });
  logJsonl({ type: "agent_step", ms: Date.now() - started, tools: executed.length });
  return out;
}
