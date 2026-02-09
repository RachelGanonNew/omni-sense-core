# OmniSense Core

A proactive, privacy-first multimodal "Cognitive Second Brain" for meetings and safety. Built with Next.js + TypeScript and Gemini 3.

## Runtime Instructions
- Requirements: Node 18+, GEMINI_API_KEY set in `.env.local` at project root.
- Development: `npm run dev` → http://localhost:3000
- Production Build: `npm run build`
- Production Run: `npm run start` → http://localhost:3000

## Key Screens & Flows
- Home: live mic/cam assist, speaking intensity, interruption nudge, suggestions.
- Trainer: edit system instruction, preferences JSON, and history snippet.
- Upload: analyze a video by extracting frames + optional transcript to produce a structured JSON insight with confidence.

## Endpoints
- POST `/api/omnisense/analyze` — low-latency JSON insight from live context.
- POST `/api/omnisense/analyze-frames` — batch frames + transcript → JSON insight with confidence.
- GET  `/api/omnisense/analyze/stream` — SSE insight stream (demo behavior).
- GET/POST `/api/omnisense/context` — read/write system instruction, preferences, history.
- POST `/api/extract-actions` — extract action items from notes.
- POST `/api/suggest` — lightweight coaching suggestions.
- GET  `/api/evaluate` — synthetic cases for prompt QA, returns per-case outputs + avg confidence.
- GET  `/api/local-video` — dev-only stream of local video (C:/Users/USER/Downloads/a.mp4).

## Evaluation & Prompt QA
- Visit `/api/evaluate` to run built-in synthetic scenarios. Use results to refine Trainer context and re-run.

## Security & Hardening
- Basic per-IP rate limiting on main analysis endpoints.
- Schema coercion and a self-check confidence score using Gemini.
- No raw media persisted; context stored in `.data/omni.json`.

## Gemini Usage (200 words)
OmniSense Core uses Gemini 3 as a reasoning engine for multimodal social and safety assistance. The system instruction encodes role, constraints, and safety policy: be concise, avoid sensitive attribute inference, and provide actionable guidance. For live mode, we form lightweight observations (audio intensity, speaking state, interruptions, brief transcript) and call a fast JSON-only prompt to produce a single insight object with fields `insight_type`, `observation`, `analysis`, and `action_recommendation`. For video uploads, we extract a small set of frames (configurable) and include an optional transcript snippet with the same instruction, yielding a consistent JSON schema. To improve reliability, we add a second Gemini call for self-scoring (0–1) of clarity, actionability, and safety; this produces a confidence score shown to the user. We provide a `/api/evaluate` endpoint with synthetic meeting-like scenarios to stress-test prompts and collect average confidence without external datasets. The Trainer panel enables iterative prompt engineering: edit system instruction, preferences, and history snippet, then re-run evaluation and upload analysis to observe changes. Together, this architecture delivers a robust, privacy-first assistant that demonstrates Gemini 3’s multimodal capabilities in a focused, judge-friendly MVP.

## Demo Script (Suggested)
1) Open Upload and analyze sample video; show insight + confidence.
2) Paste notes → extract actions.
3) Open Trainer, tweak instruction, re-run `/api/evaluate`.
4) Switch to Home; show speaking intensity and suggestions.

## Judge Demo Checklist (Production)

Live URL: https://omnisense-orchestrator.vercel.app

1. Header setup
   - Set Privacy: Cloud.
   - (Optional) Enable Conversational Voice for micro‑coaching.
2. Start Judge Demo
   - Click “Start Judge Demo” (header) → runs a 3‑step autonomous loop and exports an HTML report.
   - Wait for inline status: “Demo complete. Report: …”.
3. Verification / Audit
   - Open the Verification/Audit panel.
   - Click “Refresh Timeline” to load session events and verify steps.
   - Click “Export HTML Report”; note the artifact path returned.
   - Use “Refresh” in Artifacts to list recent report/run files.
4. Temporal coaching (optional)
   - Speak continuously ~10s to trigger Dominance; listen for a brief coaching cue.
   - Create a short spike to simulate Overlap.

## Production Smoke Test

1. Health
   - GET /api/health → { "status": "ok" }
2. Agent Single Step
   - POST /api/agent/act with a minimal observation, e.g. { observation: { detection: { kind: "overlap" } }, maxTools: 1 }
   - Expect JSON with thoughts, toolCalls[], and signature/level.
3. Agent Run
   - POST /api/agent/run with { goal: "Prepare follow-up plan", steps: 2 }
   - Expect { ok: true, steps, artifact } and verify an artifact path.
4. Audit Endpoints
   - GET /api/audit/timeline → session, tasks, logs, verifySteps.
   - POST /api/audit/report → { ok: true, artifact } (HTML report path).
5. Research Provider (optional)
   - If GOOGLE_API_KEY + GOOGLE_CSE_ID set: web.search tool results include Google CSE summaries.
   - Otherwise falls back to Wikipedia summaries.

---

## Hackathon Submission Text (copy/paste)

**What we built (short description)**  
OmniSense is a **live social translator** that listens through mic, camera, and AI glasses, explains the room’s social subtext in four lines, and then uses a **Gemini 3‑powered agent** to handle all the follow‑ups. It is not a chat wrapper: it is a tool‑calling orchestrator with long‑term memory, policies, and verification.

**Strategic track fit**  
- **🧠 Marathon Agent** – Planner + Action Queue + long‑term memory form a background agent that keeps drafting goals, creating tasks, and maintaining continuity across days of interactions.  
- **👨‍🏫 Real‑Time Teacher** – Live mic/cam + glasses sensors drive streaming “social translation” for classrooms and meetings: The Vibe, Hidden Meaning, Social Red Flags, and The Social Script.  
- **☯️ Vibe Engineering** – Thought signatures, verification tools (`agent.verify_step`), synthetic eval (`/api/evaluate`), and HTML audit artifacts build a self‑evaluation loop that measures and improves behavior over time.

**How we use Gemini 3 (≈200 words)**  
OmniSense uses Gemini 3 Pro as a **tool-calling orchestrator**, not a simple chat wrapper. For live “social translation”, the browser streams lightweight observations (RMS intensity, speaking state, interruptions, glasses sensor cues, short transcript snippets) to `/api/omnisense/analyze/stream`. The server builds a rich prompt that combines system instruction, user preferences, long-context assembly, and a long‑term memory snippet. Gemini 3 Pro returns a structured JSON object with a four-line script: The Vibe, The Hidden Meaning, Social Red Flags, The Social Script. A second Gemini call self-scores clarity, actionability, and safety, feeding a confidence bar and conservative/proactive tuning.  
For the **Marathon Agent**, `/api/agent/run` calls `runAgentStep`, which provides Gemini 3 with tool schemas (`web.search`, `calendar.create_event`, `memory.write`, `tasks.create`, `tasks.update_status`, `notes.write`, `agent.verify_step`) plus long-term memory and preferences. Gemini proposes tool_calls; the server executes them, logs thought signatures, and writes verification records. `/api/evaluate` uses Gemini to synthesize diverse scenarios and rubric-score OmniSense’s outputs across four competencies, producing quantitative reliability metrics. Together, this architecture showcases Gemini 3 Pro’s long context, multimodal reasoning, structured outputs, and agentic tool calling in a way that is self-evaluating and ready for real-world social coaching.

