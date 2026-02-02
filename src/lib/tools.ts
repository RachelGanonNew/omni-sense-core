import fs from "fs";
import path from "path";
import { createResearchProvider } from "./research";
import { logJsonl } from "./log";
import { agentAddEvent } from "./agentStore";

export type ToolCall = {
  name: string;
  args?: Record<string, any>;
};

export type ToolResult = {
  name: string;
  ok: boolean;
  result?: any;
  error?: string;
};

export type ToolDef = {
  name: string;
  description: string;
  schema: Record<string, any>;
  handler: (args: Record<string, any>) => Promise<ToolResult>;
};

function ensureData(p: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function approximateTokens(text: string) {
  // crude heuristic: 1 token ~ 4 chars
  return Math.ceil((text || "").length / 4);
}

const researchProvider = createResearchProvider();

// Handlers
async function handleResearch(args: Record<string, any>): Promise<ToolResult> {
  try {
    const q = String(args.query || "").slice(0, 256);
    const res = await (researchProvider as any).enrichPerson(q);
    return { name: "web.search", ok: true, result: res };
  } catch (e: any) {
    return { name: "web.search", ok: false, error: e?.message || String(e) };
  }
}

async function handleCalendarCreate(args: Record<string, any>): Promise<ToolResult> {
  try {
    const file = path.join(process.cwd(), ".data", "calendar.json");
    ensureData(file);
    const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8") || "[]") : [];
    const evt = {
      title: String(args.title || "Untitled"),
      when: String(args.when || ""),
      attendees: Array.isArray(args.attendees) ? args.attendees.slice(0, 20) : [],
      notes: String(args.notes || ""),
      createdAt: Date.now(),
    };
    prev.push(evt);
    fs.writeFileSync(file, JSON.stringify(prev, null, 2));
    agentAddEvent("system", { kind: "calendar.create_event", details: evt });
    return { name: "calendar.create_event", ok: true, result: evt };
  } catch (e: any) {
    return { name: "calendar.create_event", ok: false, error: e?.message || String(e) };
  }
}

async function handleMemoryWrite(args: Record<string, any>): Promise<ToolResult> {
  try {
    const file = path.join(process.cwd(), ".data", "memory.json");
    ensureData(file);
    const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8") || "[]") : [];
    const item = { text: String(args.text || ""), tags: args.tags || [], createdAt: Date.now() };
    prev.push(item);
    fs.writeFileSync(file, JSON.stringify(prev, null, 2));
    agentAddEvent("system", { kind: "memory.write", details: item });
    return { name: "memory.write", ok: true, result: item };
  } catch (e: any) {
    return { name: "memory.write", ok: false, error: e?.message || String(e) };
  }
}

async function handleAgentEvent(args: Record<string, any>): Promise<ToolResult> {
  try {
    agentAddEvent("system", { kind: String(args.kind || "note"), details: args.details || {} });
    return { name: "agent.event", ok: true, result: true };
  } catch (e: any) {
    return { name: "agent.event", ok: false, error: e?.message || String(e) };
  }
}

export const Tools: ToolDef[] = [
  {
    name: "web.search",
    description: "Search the web for public information relevant to the query using Google CSE or Wikipedia.",
    schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    handler: handleResearch,
  },
  {
    name: "calendar.create_event",
    description: "Create a calendar event stub saved locally for demo purposes.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        when: { type: "string" },
        attendees: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      required: ["title", "when"],
    },
    handler: handleCalendarCreate,
  },
  {
    name: "memory.write",
    description: "Write a memory item with optional tags to long-term store.",
    schema: { type: "object", properties: { text: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["text"] },
    handler: handleMemoryWrite,
  },
  {
    name: "agent.event",
    description: "Emit an internal agent event into the session timeline.",
    schema: { type: "object", properties: { kind: { type: "string" }, details: { type: "object" } }, required: ["kind"] },
    handler: handleAgentEvent,
  },
];

export function toolsSchemaSummary() {
  return Tools.map((t) => ({ name: t.name, description: t.description, schema: t.schema }));
}

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const def = Tools.find((t) => t.name === call.name);
  if (!def) return { name: call.name, ok: false, error: "Unknown tool" };
  const started = Date.now();
  const res = await def.handler(call.args || {});
  logJsonl({ type: "tool_result", name: def.name, ms: Date.now() - started, ok: res.ok });
  return res;
}
