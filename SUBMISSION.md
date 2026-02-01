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
