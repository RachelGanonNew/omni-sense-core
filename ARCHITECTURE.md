# OmniSense Core — Architecture

Deep technical documentation for the Gemini 3 Hackathon submission.

---

## 1. System Design Decisions

### Why Next.js 16 (App Router)

OmniSense requires both a rich client-side UI (real-time mic/cam, WebRTC, TTS) and server-side API routes that call Gemini securely. Next.js App Router gives us:

- **Server-side API routes** — API keys never leave the server; all Gemini calls happen in serverless functions
- **React Server Components** — fast initial load, then hydrate for interactive features
- **Turbopack** — sub-second HMR during development
- **Edge-compatible** — deploys to Vercel with zero config

A pure React SPA would require a separate backend or expose API keys. A Python backend would add deployment complexity and latency for the real-time coaching loop.

### Why Server-Side Gemini Calls

```
Browser → POST /api/omnisense/analyze → Gemini 3 Pro → JSON insight → Browser
```

All Gemini API calls happen server-side for three reasons:

1. **Security** — `GEMINI_API_KEY` is never sent to the client
2. **Rate limiting** — per-IP throttling in `validate.ts` prevents abuse
3. **Privacy enforcement** — server checks `privacyMode` before any external call; "off" mode returns 403

### Privacy Architecture Trade-offs

Three privacy modes create distinct data paths:

```
Cloud Mode:  Browser → Server → Gemini API → Response → Browser
             (full features, data transits Google servers)

Local Mode:  Browser → Server → Heuristic fallback → Browser
             (no external calls, reduced quality)

Off Mode:    Browser → Server → 403 Forbidden
             (zero analysis, maximum privacy)
```

The trade-off is explicit: users choose their comfort level. In Cloud mode, we still minimize data — only structured features (intensity percentages, boolean flags, short transcript snippets capped at 220 chars) are sent, never raw audio/video.

---

## 2. Gemini 3 Pro Integration

### Model Configuration

```typescript
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-3.0-pro"
});
```

We use `gemini-3.0-pro` for all calls. The model name is configurable via environment variable for easy upgrades.

### Key Gemini 3 Features Leveraged

| Feature | How We Use It |
|---|---|
| **Multimodal reasoning** | `analyze-frames` sends base64 video frames as `inlineData` parts alongside text prompts — true vision+language fusion |
| **1M token context window** | `buildLongMemorySnippet()` injects up to 2200 chars of interaction history into every prompt, enabling cross-session continuity |
| **Structured JSON output** | All prompts end with "Return ONLY JSON with keys: ..." — Gemini 3 reliably produces parseable JSON |
| **Function calling patterns** | Agent tools (`tools.ts`) are structured as name+args pairs that Gemini proposes and we execute server-side |
| **Streaming** | `/api/omnisense/analyze/stream` uses SSE to deliver insights as they generate |

### Prompt Engineering

Every analysis prompt follows this structure:

```
[System Instruction]          ← from omnisenseStore (customizable via Trainer)
[User Context]                ← preferences JSON
[History Snippet]             ← short safe-to-share summary
[Live Observations]           ← audio dynamics, vision hints, transcript
[Long-Term Memory]            ← recent interactions from Upstash Redis
[Output Instructions]         ← strict JSON schema + 4-line Social Script format
[Tuning Directive]            ← adaptive based on user feedback (conservative/proactive)
```

The tuning directive is dynamic:

```typescript
// From /api/omnisense/analyze
const fp = sess?.stats?.falsePositives || 0;
const imp = sess?.stats?.improvements || 0;
if (fp - imp >= 3) {
  tuning = "Be more conservative; only output recommendations when highly supported.";
} else if (imp - fp >= 3) {
  tuning = "Be more proactive; suggest specific next actions where appropriate.";
}
```

This creates a **self-improving feedback loop**: user thumbs-down → more conservative prompts → fewer false positives.

### Context Window Optimization

We don't dump raw data into the 1M context window. Instead:

1. **Truncation** — transcripts capped at 220-1000 chars depending on endpoint
2. **Sanitization** — `longMemory.ts` truncates strings to 1200 chars, limits arrays to 24 items, caps object depth at 4
3. **Rolling window** — only last 24-60 interactions included (configurable)
4. **Structured summaries** — `assembleLongContext()` produces a compact string from session + logs + tasks

This keeps prompts under ~4K tokens while preserving the most relevant context.

---

## 3. Autonomous Execution Pipeline

### Overview

OmniSense goes beyond analysis to **execute actions**. The pipeline:

```
Meeting Context (notes + transcript + summary)
    ↓
POST /api/omnisense/autonomous-execute
    ↓
Gemini 3 Pro extracts 3-5 structured actions
    ↓
Actions returned to UI as "proposed"
    ↓
User reviews in Action Queue panel
    ↓
Execute individually or "Approve All" (confidence ≥ 70%)
    ↓
POST /api/omnisense/verify-action (thumbs up/down)
    ↓
Feedback stored in feedback.jsonl
    ↓
Future prompts adapt based on accuracy stats
```

### Action Types

| Type | Data Shape | Execution |
|---|---|---|
| `calendar` | `{ date, time, duration, attendees }` | Google Calendar link generated client-side |
| `email` | `{ to, subject, body }` | Draft preview shown; user copies or sends |
| `task` | `{ owner, due, priority, notes }` | Created in local task store via `createTask()` |
| `document` | `{ sections: [{ heading, items }] }` | Rendered as structured meeting minutes |
| `followup` | `{ date, time, duration, agenda }` | Proposed follow-up meeting with calendar link |

### Self-Verification Loop

```
Action Executed
    ↓
UI shows 👍/👎 buttons
    ↓
POST /api/omnisense/verify-action
    ↓
feedbackStore.ts appends to feedback.jsonl
    ↓
feedbackStats() calculates accuracy
    ↓
autonomous-execute reads stats:
  accuracy < 70% → "Be more conservative with confidence scores"
  accuracy ≥ 70% → "Maintain current quality"
```

This creates a **closed-loop learning system** where user corrections directly influence future action quality.

### Confidence Scoring

Two layers of confidence:

1. **Gemini self-assessment** — the autonomous-execute prompt asks Gemini to rate each action 0.0-1.0
2. **Historical accuracy** — `feedbackStats()` tracks the ratio of 👍 to total ratings

The UI displays confidence as a progress bar per action. Actions below 70% confidence require manual approval even in "Execute" mode.

---

## 4. Long-Term Memory System

### Architecture

```
Interaction occurs (analyze, suggest, agent step, autonomous action)
    ↓
appendInteraction() called with kind, input, output, meta
    ↓
Upstash Redis available?
  YES → LPUSH to omni:long_memory:v1, LTRIM to 600 items
  NO  → Append to .data/long_memory.jsonl (local fallback)
    ↓
On next prompt, buildLongMemorySnippet() retrieves recent items
    ↓
Formatted as timestamped lines injected into prompt
```

### Why Upstash Redis

- **Serverless-safe** — HTTP REST API, no persistent connections
- **Cross-deployment** — memory persists across Vercel function cold starts
- **Automatic TTL** — LTRIM keeps only the last N items (default 600)
- **Fallback** — if Upstash is unavailable, gracefully falls back to local JSONL

### Data Shape

```typescript
type InteractionEvent = {
  t: number;        // timestamp
  kind: string;     // "omni.analyze", "suggest", "autonomous.execute", etc.
  input?: any;      // sanitized input (truncated, depth-limited)
  output?: any;     // sanitized output
  meta?: any;       // privacy mode, IP, etc.
};
```

All data is sanitized before storage: strings truncated to 1200 chars, arrays to 24 items, object depth to 4 levels.

---

## 5. Session Continuity

### Cross-Session Tracking

`GET /api/omnisense/continuity` provides three modes:

- **summary** — interaction counts, task stats, feedback accuracy, date range
- **timeline** — interactions grouped by day with kind distribution
- **review** — Gemini-generated analysis of patterns, reminders, goal progress, and recommendations

The review mode uses the full long-term memory (up to 60 interactions, 4000 chars) to identify:
- Recurring themes across meetings
- Unresolved action items
- Behavioral patterns
- Proactive follow-up suggestions

---

## 6. Agent Tool System

### Tool Execution Flow

```typescript
// From agent.ts — runAgentStep()
const toolDefs = getToolDefinitions();  // 8 tools
const prompt = buildAgentPrompt(observation, longContext, longMemory);
const response = await callGemini(prompt, toolDefs);

// Parse tool calls from response
for (const call of response.toolCalls) {
  const result = await executeTool(call.name, call.args);
  // Result fed back into next step
}
```

### Available Tools

```typescript
// From tools.ts
const TOOLS = {
  "web.search":          // Google CSE or Wikipedia lookup
  "calendar.create_event": // Create calendar event stub in .data/
  "memory.write":        // Write tagged memory item to .data/
  "agent.event":         // Emit timeline event to agentStore
  "tasks.create":        // Create task in taskStore
  "tasks.update_status": // Update task status
  "notes.write":         // Append timestamped note
  "agent.verify_step":   // Record verification claim (pass/fail + evidence)
};
```

### Retry & Fallback

All Gemini calls use retry with exponential backoff:

```typescript
// From agent.ts — callWithRetry()
for (let i = 0; i < 3; i++) {
  try {
    return await model.generateContent(prompt);
  } catch (e) {
    await sleep(250 * Math.pow(2, i) + random(100));
  }
}
return { final: "degraded" };  // graceful fallback
```

The UI handles "degraded" responses with a user-friendly message instead of showing raw errors.

---

## 7. Real-Time Coaching Pipeline

### Audio Processing

```
Browser mic → AudioContext → AnalyserNode → getByteTimeDomainData()
    ↓
RMS calculation (30fps) → speaking boolean + intensity percentage
    ↓
Temporal detectors (windowed over 10-20s):
  - Dominance: speaking 8+/10s with avgRMS > 0.08
  - Overlap: RMS spike > 2.2x previous (interruption heuristic)
  - Engagement drop: 6+/8s of non-engaged head motion cues
    ↓
Detection emitted → /api/events + /api/agent/act
    ↓
Voice coaching (if enabled): TTS via Web Speech API
```

### Streaming Insights

```
POST /api/omnisense/analyze/stream
    ↓
Gemini generateContent() → extract JSON from response
    ↓
SSE: event: insight\ndata: {json}\n\n
    ↓
Browser reads stream → updates suggestion panel
    ↓
event: done\ndata: end\n\n
```

---

## 8. Serverless Storage Strategy

### The Problem

Vercel serverless functions have a **read-only filesystem** except `/tmp`. Multiple stores (`agentStore`, `taskStore`, `memoryStore`, etc.) need to write JSON/JSONL files.

### The Solution

```typescript
// dataDir.ts
const cwd = process.cwd();
const baseDir = process.env.VERCEL || cwd.startsWith("/var/task") ? "/tmp" : cwd;
export function dataPath(filename: string): string {
  return path.join(baseDir, ".data", filename);
}
```

- **Vercel**: all writes go to `/tmp/.data/` (ephemeral but functional per invocation)
- **Local dev**: writes go to `<project>/.data/` (persistent)
- **Production persistence**: Upstash Redis for long-term memory (survives cold starts)

### Store Summary

| Store | File | Purpose |
|---|---|---|
| `agentStore` | `agent.json` | Session state, events, stats |
| `taskStore` | `tasks.json` | Local task CRUD |
| `memoryStore` | `memory.json` | People-seen tracking |
| `policyStore` | `policies.json` | Active policies |
| `pairStore` | `pair-sessions.json` | WebRTC session state |
| `log` | `agent.log` | JSONL event log |
| `longMemory` | `long_memory.jsonl` | Interaction history (fallback) |
| `feedbackStore` | `feedback.jsonl` | Action verification ratings |
| `omnisenseStore` | `omni.json` | System instruction + preferences |

---

## 9. Security & Privacy

### Rate Limiting

```typescript
// validate.ts — allowRequest()
// In-memory per-IP throttle with ~400ms gap
const lastCall: Record<string, number> = {};
export function allowRequest(ip: string, scope: string, gapMs: number): boolean {
  const key = `${ip}:${scope}`;
  const now = Date.now();
  if (lastCall[key] && now - lastCall[key] < gapMs) return false;
  lastCall[key] = now;
  return true;
}
```

### Policy Safety Validation

```typescript
// policyStore.ts — validatePolicySafety()
const txt = `${pol.intent} ${JSON.stringify(pol.actions)}`.toLowerCase();
if (/(diagnos|prescrib|medical advice|therapy)/.test(txt))
  return { ok: false, error: "forbidden_scope" };
if (/(demograph|ethnic|religion|political)/.test(txt))
  return { ok: false, error: "sensitive_inference" };
```

### Prompt Safety

Every analysis prompt includes:
- "Avoid sensitive attribute inferences; do not mention biometrics or identity"
- "Do not infer protected traits or identity"
- "Be direct about social risk but do not insult"

---

## 10. Performance

### Video Frame Processing

Upload page extracts frames client-side using `<canvas>`:
- Video loaded into `<video>` element
- Frames captured at intervals via `canvas.toDataURL()`
- Base64 frames sent to `/api/omnisense/analyze-frames`
- Server caps at 12 frames per request to limit payload size

### Response Times

| Endpoint | Typical Latency | Notes |
|---|---|---|
| `/api/health` | <10ms | Static response |
| `/api/suggest` | 1-3s | Single Gemini call |
| `/api/omnisense/analyze` | 2-5s | Gemini + confidence scoring (2 calls) |
| `/api/omnisense/analyze-frames` | 3-8s | Multimodal with images |
| `/api/agent/run` | 5-30s | Multi-step (1-10 Gemini calls) |
| `/api/omnisense/autonomous-execute` | 3-8s | Single Gemini call for action extraction |
| `/api/evaluate` | 15-60s | N scenarios × 3 Gemini calls each |

### Bundle Size

- Next.js 16 with Turbopack produces optimized chunks
- React Compiler (`babel-plugin-react-compiler`) auto-memoizes components
- No heavy client-side dependencies beyond React 19 + Tailwind CSS 4

---

## 11. Why Gemini 3 Over Alternatives

| Criterion | Gemini 3 Pro | GPT-4o | Claude 3.5 |
|---|---|---|---|
| **Multimodal** | Native vision+audio+text | Vision+text | Vision+text |
| **Context window** | 1M tokens | 128K tokens | 200K tokens |
| **Structured output** | Reliable JSON | Reliable JSON | Reliable JSON |
| **Streaming** | Yes | Yes | Yes |
| **Cost** | Competitive | Higher | Higher |
| **Hackathon fit** | Gemini 3 Hackathon requirement | N/A | N/A |

Gemini 3's 1M token context window is critical for our cross-session continuity feature — we can inject weeks of interaction history without truncation concerns.

---

*Last updated: February 2026*
