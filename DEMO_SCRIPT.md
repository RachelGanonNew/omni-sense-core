# OmniSense Core — 3-Minute Demo Video Script (Glasses + Classroom)

**Total runtime: ~2:50**  
**Tools needed:** Veo 3 / Google AI Studio (for 1–2 B‑roll clips), screen recorder (Loom/OBS), browser open to your deployed URL.

This script tells a single story: a shy student with AI glasses using OmniSense as a live social translator in class, plus a quick show of the autonomous agent and metrics.

---

## [0:00–0:20] HOOK — “Social translation for students”

**Voiceover / Caption:**
> “Some students talk too much. Some can’t get a word in. Social cues are hard — especially in high school.”

**On screen (Veo 3 B‑roll):**
- Clip of an Asian high school classroom: four students in a group. One dominates, another tries to speak and stops, one is quiet.
- Quick cut to a close-up of the main boy wearing sleek black smart glasses, looking overwhelmed in the hallway.

**Overlay text:**  
> “What if your AI could translate the room’s vibe — and then handle all the follow-ups?”

---

## [0:20–0:55] DAY 1 — Connect glasses + live social translation

**On screen (app + B‑roll):**
1. Cut to `https://omnisense-orchestrator.vercel.app` home.
   - Show the hero: “OmniSense — Live Social Translator”.
   - Highlight status pills: AI Assist, Camera & Mic, Glasses.
2. Click **“Enable”** → grant mic/cam.
3. Click **“Connect Glasses”** in the sidebar (simulated adapter).
4. Split-screen or cut back to Veo 3 clip:
   - The boy taps “Connect Glasses” on his phone; a tiny light on his frame turns on.

**On screen (UI):**
- Speak a short “tense” interaction into the mic (or play a clip).
- Show:
  - **Speaking / Intensity / Engagement** changing in the Session card.
  - **Live Suggestions** updating with a 4‑line script, e.g.:  
    - “The Vibe: One voice is dominating.”  
    - “The Hidden Meaning: Others may be holding back.”  
    - “Social Red Flags: Repeated interruptions.”  
    - “The Social Script: ‘We’ve heard a lot from me — what do you think?’”

**Voiceover:**
> “OmniSense listens through mic, camera, and AI glasses. Gemini 3 Pro fuses audio, video, and long-term memory to translate the room’s social subtext into four short lines: the vibe, hidden meaning, red flags, and exactly what to say.”

---

## [0:55–1:35] MARATHON AGENT — Planner + Action Queue

**On screen (app only):**
1. Scroll to **Planner**.
   - Show an auto-drafted goal, e.g. “Stay balanced in discussion; mitigate dominance; end with a clear next step.”
2. Type over or keep:  
   `"Prepare for my next meeting with Alex Chen – don’t dominate, but don’t disappear."`
3. Click **Run**.
   - Show the **Working** pill and task history for a few seconds.

**Voiceover:**
> “Under the hood, OmniSense runs a Marathon Agent. Gemini 3 Pro sees tool schemas, long-term memory, and your goal — then decides when to search the web, create tasks, write notes, and verify itself.”

**On screen (Action Queue):**
4. Toggle **Autonomous** in the hero bar.
5. Paste short notes in **Follow‑ups** (e.g., “Ken dominated; Mei stayed quiet. Next class, Mei should lead part of the discussion.”).
6. Click **Generate Actions** in the **Action Queue**.
   - Show 3–5 actions (task, calendar, document, followup) with confidence bars.
   - Expand an email preview and a document preview.
7. Click **Approve All**; show statuses turning to Executed and optionally hit 👍 on one action.

**Voiceover:**
> “After class or a meeting, OmniSense turns rough notes into structured actions: tasks, calendar stubs, emails, and minutes. Each action is confidence‑scored, and every thumbs‑up or thumbs‑down feeds back into the prompts.”

---

## [1:35–2:05] DAY 30 — Continuity + real change

**On screen (Veo 3 B‑roll + app):**
1. Veo 3 clip: same classroom, 30 days later.
   - Group is balanced; the boy with glasses speaks briefly and others listen.
2. Cut to **Session Continuity** in the app:
   - Click **Session Review**.
   - Show:
     - Summary
     - Recurring patterns (e.g. fewer dominance events)
     - Proactive reminders
     - Goal progress and pending tasks

**Voiceover:**
> “Over time, OmniSense notices patterns: fewer dominance events, more contributions from quiet students, recurring commitments that slip. Continuity mode and the Task store turn your whole social life into a trackable, improvable system.”

---

## [2:05–2:35] RELIABILITY, PRIVACY, AND EVAL

**On screen:**
1. Briefly open `/api/evaluate` in a new tab:
   - Show JSON with rubric scores for reasoning, chain of command, location awareness, social interaction.
2. Scroll through the **Action Queue** showing confidence bars.
3. Open the **sidebar** to show:
   - Privacy toggle (Cloud / Local / Off).
   - Glasses status and sensors (head motion, brightness, temp).

**Voiceover:**
> “Every insight is structured JSON, self‑scored for confidence, and rate‑limited. `/api/evaluate` generates synthetic scenarios and rubric‑scores OmniSense across four competencies, so we can measure and tune behavior without user data. Three privacy modes, strict prompts, and a policy engine keep it safe by design.”

---

## [2:35–2:50] CLOSE — Impact + call to action

**On screen:** Hero banner + quick montage of hallway + classroom clips + app UI.

**Voiceover:**
> “OmniSense: a live social translator that helps you communicate better — in class, at work, and in daily life. It runs a true Marathon Agent on top of Gemini 3 Pro: long‑term memory, multimodal reasoning, and self‑verification, not just another chatbot.”

**Final screen:**
- URL: https://omnisense-orchestrator.vercel.app  
- GitHub: https://github.com/RachelGanonNew/omni-sense-core  
- “Powered by Gemini 3 Pro”

---

## Recording Tips

- **Resolution:** 1080p
- **Browser:** Use Chrome, zoom to ~90% for cleaner UI
- **Pre-load:** Open the app before recording so it’s ready
- **Audio:** Use a quiet room or add voiceover in post
- **Captions:** Add subtitles for accessibility
- **Music:** Optional subtle background music
- **Upload:** YouTube (unlisted) + embed in Devpost submission
