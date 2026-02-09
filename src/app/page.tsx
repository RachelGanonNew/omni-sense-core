"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBridge } from "../lib/glassesBridge";
import type { GlassesBridge, SensorSample } from "../lib/glassesBridge";
import UserJourneyStatus from "../components/UserJourneyStatus";

type Levels = {
  rms: number;
  speaking: boolean;
};

export default function Home() {
  const [consented, setConsented] = useState(false);
  const [paused, setPaused] = useState(false);
  const [levels, setLevels] = useState<Levels>({ rms: 0, speaking: false });
  const levelsRef = useRef<Levels>({ rms: 0, speaking: false });
  const levelsFlushRef = useRef<number>(0);
  const [speakingMs, setSpeakingMs] = useState(0);
  const [interruption, setInterruption] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string>(
    "Analyzing micro-expressions..."
  );

  // Filming: show hardcoded result after 30s delay
  useEffect(() => {
    const t = setTimeout(() => {
      setSuggestion("The Reality: The Micro-Expression Gap occurs at 0:01; his brow furrows in genuine bewilderment for a fraction of a second before the \"hostage smile\" is applied.\nTactical Script: \"I saw that first reaction—you don't have to perform for me, I know it's a confusing gift.\"\nThe Move: Lean back and laugh to signal that the \"polite lie\" is no longer necessary.");
    }, 30000);
    return () => clearTimeout(t);
  }, []);
  const [notes, setNotes] = useState("");
  const [notesIsDraft, setNotesIsDraft] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [actions, setActions] = useState<Array<any>>([]);
  const [extracting, setExtracting] = useState(false);
  const [sysInstr, setSysInstr] = useState<string>("");
  const [prefs, setPrefs] = useState<string>("{}");
  const [hist, setHist] = useState<string>("");
  const [savingCtx, setSavingCtx] = useState(false);
  const [analyzeOut, setAnalyzeOut] = useState<string>("");
  const [analyzeConfidence, setAnalyzeConfidence] = useState<number | null>(null);
  const [outputMode, setOutputMode] = useState<"text" | "voice">("text");
  const [privacyMode, setPrivacyMode] = useState<"off" | "local" | "cloud">("cloud");
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const speakRef = useRef<{ speak: (t: string) => void; cancel: () => void } | null>(null);
  const [glassesConnected, setGlassesConnected] = useState(false);
  const [showGlassesModal, setShowGlassesModal] = useState(false);
  const [bridgeKind, setBridgeKind] = useState<"simulated" | "vendorX">("simulated");
  const [sensorSample, setSensorSample] = useState<{ headMotion?: string; brightness?: number; temp?: number } | null>(null);
  const sensorRef = useRef<{ headMotion?: string; brightness?: number; temp?: number } | null>(null);
  const lastSensorTsRef = useRef<number>(0);
  const backoffRef = useRef<number>(500);
  const engageBufRef = useRef<string[]>([]);
  const [engagement, setEngagement] = useState<string>("-");
  const stableEngagementRef = useRef<string>("-");
  const [reconnecting, setReconnecting] = useState(false);
  const detectBufRef = useRef<{ t: number; speaking: boolean; intensity: number; engagement: string }[]>([]);
  const lastEmitRef = useRef<Record<string, number>>({});
  const [detections, setDetections] = useState<{ t: number; kind: string; info?: string }[]>([]);
  const [runGoal, setRunGoal] = useState("");
  const [runGoalIsDraft, setRunGoalIsDraft] = useState(false);
  const [runResult, setRunResult] = useState<string>("");
  const [runStatus, setRunStatus] = useState<string>("");
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [runElapsedSec, setRunElapsedSec] = useState<number>(0);
  const [autoRunGoal, setAutoRunGoal] = useState<boolean>(true);
  const [autoNotes, setAutoNotes] = useState<boolean>(true);
  const lastRunGoalEditRef = useRef<number>(0);
  const lastNotesEditRef = useRef<number>(0);
  const [audit, setAudit] = useState<{ session?: any; tasks?: any[]; verifySteps?: any[]; logs?: any[] } | null>(null);
  const [auditMsg, setAuditMsg] = useState<string>("");
  const [auditFilter, setAuditFilter] = useState<"all" | "pass" | "fail">("all");
  const [artifacts, setArtifacts] = useState<{ name: string; path: string }[]>([]);
  const coachLastRef = useRef<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [appClosed, setAppClosed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const suggestionBeforeDemoRef = useRef<string>("");
  const demoIntervalRef = useRef<number | null>(null);
  const [showDemo, setShowDemo] = useState<boolean>(false);
  const [showDetectionsSidebar, setShowDetectionsSidebar] = useState<boolean>(true);
  const [healthMsg, setHealthMsg] = useState<string>("");
  const [autonomousMode, setAutonomousMode] = useState<boolean>(false);
  const [actionQueue, setActionQueue] = useState<any[]>([]);
  const [actionQueueLoading, setActionQueueLoading] = useState<boolean>(false);
  const [actionQueueMsg, setActionQueueMsg] = useState<string>("");
  const [showActionQueue, setShowActionQueue] = useState<boolean>(false);
  const [continuityData, setContinuityData] = useState<any>(null);
  const [showContinuity, setShowContinuity] = useState<boolean>(false);
  const [plannerTasks, setPlannerTasks] = useState<Array<{ id: string; goal: string; status: "running" | "done" | "error"; result: string; startedAt: number; finishedAt?: number }>>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const lastSpeakingRef = useRef<boolean>(false);
  const lastRmsRef = useRef<number>(0);
  const startedAtRef = useRef<number | null>(null);
  const bridgeRef = useRef<GlassesBridge | null>(null);

  const speakingThreshold = 0.06; // heuristic
  const spikeFactor = 2.2; // interruption heuristic

  const cardBase = "rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur will-change-auto [transform:translateZ(0)]";
  const cardTitleRow = "mb-4 flex items-start justify-between gap-3";
  const pillBase = "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium";
  const primaryBtn = "rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900";
  const secondaryBtn = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50";

  const stopAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (analyserRef.current) analyserRef.current.disconnect();
    analyserRef.current = null;
    if (audioCtxRef.current) audioCtxRef.current.close();
    audioCtxRef.current = null;
  }, []);

  // Glasses bridge hookup (simulated for now)
  useEffect(() => {
    if (glassesConnected) {
      if (!bridgeRef.current) bridgeRef.current = createBridge(bridgeKind);
      bridgeRef.current.start((s: SensorSample) => {
        sensorRef.current = s;
        setSensorSample(s);
        lastSensorTsRef.current = Date.now();
        const hm = (s?.headMotion || "steady").toString();
        engageBufRef.current.push(hm);
        if (engageBufRef.current.length > 8) engageBufRef.current.shift();
        const counts = engageBufRef.current.reduce((acc: Record<string, number>, k: string) => {
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        let cue = "neutral";
        const nod = counts["nod"] || 0;
        const shake = counts["shake"] || 0;
        const steady = counts["steady"] || 0;
        if (nod >= 3 && nod > shake) cue = "agreeing";
        else if (shake >= 3 && shake > nod) cue = "disagreeing?";
        else if (steady >= 5) cue = "engaged";
        // Debounce engagement changes: require two consecutive cues
        if (stableEngagementRef.current === cue) {
          setEngagement(cue);
        } else {
          stableEngagementRef.current = cue;
        }
      });
    } else {
      bridgeRef.current?.stop();
      sensorRef.current = null;
      setSensorSample(null);
      lastSensorTsRef.current = 0;
      engageBufRef.current = [];
      setEngagement("-");
      stableEngagementRef.current = "-";
      setReconnecting(false);
    }
    return () => {
      bridgeRef.current?.stop();
    };
  }, [glassesConnected, bridgeKind]);

  // Heartbeat reconnect/backoff for glasses sensors
  useEffect(() => {
    if (!glassesConnected) return;
    let cancelled = false;
    const iv = setInterval(() => {
      if (cancelled) return;
      const now = Date.now();
      if (lastSensorTsRef.current && now - lastSensorTsRef.current > 3000) {
        setReconnecting(true);
        try { bridgeRef.current?.stop(); } catch {}
        try {
          bridgeRef.current = createBridge(bridgeKind);
          bridgeRef.current.start((s: SensorSample) => {
            sensorRef.current = s;
            setSensorSample(s);
            lastSensorTsRef.current = Date.now();
            setReconnecting(false);
          });
          backoffRef.current = Math.max(500, Math.min(4000, backoffRef.current + 500));
        } catch {}
      } else if (lastSensorTsRef.current) {
        backoffRef.current = Math.max(500, backoffRef.current - 200);
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [glassesConnected, bridgeKind]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const teardown = useCallback(() => {
    stopAudio();
    stopStream();
  }, [stopAudio, stopStream]);

  const closeApp = useCallback(() => {
    try { teardown(); } catch {}
    try { fetch("/api/agent/stop", { method: "POST" }).catch(() => {}); } catch {}
    setConsented(false);
    setPaused(false);
    setDemoMode(false);
    setMobileSidebarOpen(false);
    setAppClosed(true);
  }, [teardown]);

  useEffect(() => {
    if (!consented || paused || demoMode || privacyMode === "off") return;
    let cancelled = false;
    (async () => {
      try {
        const s = await fetch("/api/agent/status");
        const j = await s.json().catch(() => ({}));
        if (!cancelled && !j?.active) {
          await fetch("/api/agent/start", { method: "POST" });
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [consented, paused, demoMode, privacyMode]);

  useEffect(() => {
    if (!consented || paused || demoMode || privacyMode === "off") return;
    if (!autoRunGoal && !autoNotes) return;
    let cancelled = false;

    const applyDraft = async () => {
      try {
        const s = await fetch("/api/agent/status");
        const sj = await s.json().catch(() => ({}));
        if (!sj?.active) {
          await fetch("/api/agent/start", { method: "POST" });
        }

        const r = await fetch("/api/agent/report");
        const j = await r.json();
        if (!r.ok) return;

        const risks: string[] = Array.isArray(j?.risks) ? j.risks : [];
        const actions: Array<{ title?: string; owner?: string; due?: string }> = Array.isArray(j?.actions) ? j.actions : [];
        const lastInsights = Array.isArray(j?.outline?.insights) ? j.outline.insights : [];

        const topRisk = risks[0] || "";
        const lastAction = actions[0]?.title ? String(actions[0].title) : "";
        const insightHint = lastInsights.length ? String(lastInsights[lastInsights.length - 1]?.observation || "") : "";

        const goalDraft = [
          "Stay aligned in the conversation.",
          topRisk ? `Mitigate: ${topRisk}.` : "",
          lastAction ? `End with: ${lastAction}.` : "",
        ].filter(Boolean).join(" ").slice(0, 140);

        const notesDraft = [
          topRisk ? `Risk: ${topRisk}` : "",
          insightHint ? `Signal: ${insightHint}` : "",
          actions.length
            ? "Follow-ups:\n" + actions.slice(0, 5).map((a) => `- ${String(a?.title || "").trim()}`).filter(Boolean).join("\n")
            : "",
        ].filter(Boolean).join("\n").slice(0, 1200);

        if (cancelled) return;

        if (autoRunGoal) {
          setRunGoal(goalDraft);
          setRunGoalIsDraft(true);
        }
        if (autoNotes) {
          setNotes(notesDraft);
          setNotesIsDraft(true);
        }
      } catch {}
    };

    applyDraft();
    const iv = window.setInterval(applyDraft, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [consented, paused, demoMode, privacyMode, autoRunGoal, autoNotes]);

  // Background Intel: always-on auto-generate and auto-execute actions
  useEffect(() => {
    if (!consented || paused || demoMode || privacyMode === "off") return;
    let cancelled = false;

    const autoRun = async () => {
      if (cancelled || actionQueueLoading) return;
      try {
        setActionQueueLoading(true);
        const res = await fetch("/api/omnisense/autonomous-execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: notes.slice(0, 2000),
            meetingSummary: summary || suggestion,
            executeMode: false,
          }),
        });
        const j = await res.json();
        if (cancelled) return;
        if (!res.ok) return;
        const newActions = j.actions || [];
        const executed = newActions.map((a: any) => ({ ...a, status: "executed", executedAt: Date.now() }));
        setActionQueue((prev) => [...executed, ...prev].slice(0, 20));
        setActionQueueMsg(executed.length ? `${executed.length} new intel` : "");
      } catch {} finally {
        if (!cancelled) setActionQueueLoading(false);
      }
    };

    // Auto-detect goals from transcript and run planner silently
    const autoPlanner = async () => {
      if (cancelled) return;
      const transcript = notes.slice(0, 500);
      if (!transcript || transcript.length < 20) return;
      try {
        const res = await fetch("/api/agent/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: `From this conversation, detect any plans, commitments, or action items and organize them: "${transcript.slice(0, 300)}"`,
            steps: 2,
            maxTools: 2,
          }),
        });
        const j = await res.json();
        if (cancelled || !res.ok) return;
        const result = j?.steps?.map((s: any) => s?.final || "").filter(Boolean).join("\n") || "";
        if (result) {
          setPlannerTasks((prev) => [{
            id: `auto-${Date.now()}`,
            goal: "Auto-detected from conversation",
            status: "done" as const,
            result: String(result),
            startedAt: Date.now() - 5000,
            finishedAt: Date.now(),
          }, ...prev].slice(0, 10));
        }
      } catch {}
    };

    // Stagger: actions at 15s, planner at 45s, then repeat
    const ivActions = window.setInterval(autoRun, 30000);
    const ivPlanner = window.setInterval(autoPlanner, 45000);
    // Initial runs with delay
    const t1 = setTimeout(autoRun, 5000);
    const t2 = setTimeout(autoPlanner, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(ivActions);
      window.clearInterval(ivPlanner);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [consented, paused, demoMode, privacyMode]);

  useEffect(() => {
    if (!runStartedAt) return;
    setRunElapsedSec(0);
    const iv = window.setInterval(() => {
      setRunElapsedSec(Math.max(0, Math.floor((Date.now() - runStartedAt) / 1000)));
    }, 500);
    return () => window.clearInterval(iv);
  }, [runStartedAt]);

  // Demo Mode: scripted showcase without requiring camera/mic
  useEffect(() => {
    if (demoMode) {
      suggestionBeforeDemoRef.current = suggestion;
      // Stop capture and polling in demo
      try { teardown(); } catch {}
      setConsented(false);
      setPaused(false);

      const demoTips = [
        "The Leak: They're teasing, not literally criticizing — words and tone don't match.\nThe Fix: Laugh it off and say: 'Haha fair — what would you do instead?'\nThe Vibe: Playful grin, lean back.",
        "The Leak: Short replies and impatient tone — they want this wrapped up fast.\nThe Fix: Say: 'Got it — what's the one thing you need from me right now?'\nThe Vibe: Direct eye contact, calm nod.",
        "The Leak: Overly polite wording is masking condescension — they're testing your boundaries.\nThe Fix: Say: 'I appreciate that — let's cut to what you actually need.'\nThe Vibe: Steady posture, slight smile.",
      ];

      const now = Date.now();
      setDetections([
        { t: now, kind: "Sarcasm likely", info: "Words and tone don't match" },
        { t: now - 7000, kind: "Pressure", info: "Short replies, impatient tone" },
        { t: now - 14000, kind: "Condescending", info: "Overly polite wording" },
      ]);

      // Populate Background Intel with demo data
      setActionQueue([
        { id: "demo-1", type: "calendar", title: "Dinner with Alex — Saturday 7pm", description: "Detected from conversation: 'Let's grab dinner Saturday evening'", confidence: 0.92, status: "executed", executedAt: now, data: { date: "2026-02-14", time: "19:00" } },
        { id: "demo-2", type: "task", title: "Send Sarah the article about AI glasses", description: "Commitment detected: 'I'll send you that link later'", confidence: 0.85, status: "executed", executedAt: now - 5000 },
        { id: "demo-3", type: "email", title: "Follow up with Jordan re: project timeline", description: "Action item from earlier: 'We need to sync on deadlines'", confidence: 0.78, status: "executed", executedAt: now - 12000, data: { to: "jordan@example.com", subject: "Project timeline sync", body: "Hey Jordan — following up on our chat. Want to lock in deadlines this week. When works for you?" } },
        { id: "demo-4", type: "task", title: "Book flights for March trip", description: "Mentioned twice in conversation — flagged as high priority", confidence: 0.88, status: "executed", executedAt: now - 20000 },
      ]);
      setPlannerTasks([
        { id: "demo-plan-1", goal: "Auto-detected from conversation", status: "done" as const, result: "Plan detected: Saturday dinner with Alex at 7pm.\nSuggestion: Book a table at the Italian place you both liked last time. Mention the new dessert menu — Alex has a sweet tooth.", startedAt: now - 30000, finishedAt: now - 25000 },
        { id: "demo-plan-2", goal: "Auto-detected from conversation", status: "done" as const, result: "Upcoming: Jordan seems stressed about the project deadline.\nAdvice: Lead with empathy — ask how they're doing before jumping into logistics. Offer to take one task off their plate.", startedAt: now - 60000, finishedAt: now - 55000 },
      ]);
      setNotes("Alex mentioned wanting to try the new Italian place on 5th Ave.\nJordan is worried about the March deadline — might need help with the design review.\nSarah asked about AI glasses article from last week.");

      let i = 0;
      setSuggestion(demoTips[i]);
      if (demoIntervalRef.current) window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = window.setInterval(() => {
        i = (i + 1) % demoTips.length;
        setSuggestion(demoTips[i]);
      }, 6000);
      return;
    }

    if (demoIntervalRef.current) window.clearInterval(demoIntervalRef.current);
    demoIntervalRef.current = null;
    setDetections([]);
    setActionQueue([]);
    setPlannerTasks([]);
    setNotes("");
    if (suggestionBeforeDemoRef.current) setSuggestion(suggestionBeforeDemoRef.current);
  }, [demoMode, teardown]);

  const tick = useCallback(() => {
    if (!analyserRef.current || !dataRef.current) return;
    // Use permissive casts to avoid TS lib.dom generics mismatch across versions
    (analyserRef.current as any).getByteTimeDomainData(dataRef.current as any);
    let sumSq = 0;
    for (let i = 0; i < dataRef.current.length; i++) {
      const v = (dataRef.current[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / dataRef.current.length);
    const speaking = rms > speakingThreshold;

    const prevSpeaking = lastSpeakingRef.current;
    const prevRms = lastRmsRef.current;
    levelsRef.current = { rms, speaking };
    // Throttle state updates to ~2/sec to prevent iPhone flickering
    const now2 = Date.now();
    if (now2 - levelsFlushRef.current > 500) {
      levelsFlushRef.current = now2;
      setLevels({ rms, speaking });
    }

    if (startedAtRef.current == null) startedAtRef.current = performance.now();
    const now = performance.now();

    if (!paused && speaking && now2 - levelsFlushRef.current < 50) {
      setSpeakingMs((ms) => ms + 500);
    }

    if (!prevSpeaking && speaking && prevRms > 0 && rms / (prevRms + 1e-6) > spikeFactor) {
      setInterruption("Possible interruption detected");
      setTimeout(() => setInterruption(null), 1500);
    }

    lastSpeakingRef.current = speaking;
    lastRmsRef.current = rms;
    rafRef.current = requestAnimationFrame(tick);
  }, [paused]);

  // Poll or stream backend for concise suggestion (~1/sec)
  useEffect(() => {
    if (!consented || paused || demoMode) return;
    let cancelled = false;
    const iv = setInterval(async () => {
      try {
        const payload = {
          audioDynamics: {
            intensityPct: Math.min(100, Math.round(levels.rms * 400)),
            speaking: levels.speaking,
            interruption: !!interruption,
          },
          visionHints: { scene: "meeting", sensors: sensorRef.current ? { ...sensorRef.current, engagement } : undefined },
          transcript: notes.slice(0, 220),
        };

        // --- Temporal detectors (windowed over ~20s) ---
        const nowTs = Date.now();
        detectBufRef.current.push({ t: nowTs, speaking: levels.speaking, intensity: levels.rms, engagement });
        // keep last 20 seconds
        detectBufRef.current = detectBufRef.current.filter((p) => nowTs - p.t <= 20000);
        const last10 = detectBufRef.current.filter((p) => nowTs - p.t <= 10000);
        const speakCount10 = last10.filter((p) => p.speaking).length;
        const avgRms10 = last10.length ? last10.reduce((a, c) => a + c.intensity, 0) / last10.length : 0;
        const engag8 = detectBufRef.current.filter((p) => nowTs - p.t <= 8000).map((p) => p.engagement);

        const cool = (k: string, ms: number) => {
          const last = lastEmitRef.current[k] || 0;
          return nowTs - last >= ms;
        };
        const mark = (k: string) => (lastEmitRef.current[k] = nowTs);
        const emit = async (kind: string, info?: string) => {
          setDetections((ds) => [{ t: nowTs, kind, info }, ...ds].slice(0, 8));
          try {
            await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, at: nowTs, details: { info } }) });
          } catch {}
          // Trigger autonomous agent step with concise observation
          try {
            const observation = {
              detection: { kind, info, at: nowTs },
              audio: { speaking: levels.speaking, rms: Number(levels.rms.toFixed(3)) },
              sensors: sensorRef.current ? { ...sensorRef.current, engagement } : { engagement },
              transcript: notes.slice(0, 160),
            };
            await fetch("/api/agent/act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ observation, maxTools: 2 }) });
          } catch {}

          // Real-time coaching (cooldown 12s) only when allowed
          try {
            const now = Date.now();
            if (privacyMode !== "cloud") return;
            if (outputMode !== "voice") return;
            if (now - (coachLastRef.current || 0) < 12000) return;
            coachLastRef.current = now;

            let msg = "";
            if (kind === "dominance") msg = "Invite others briefly, then summarize next steps.";
            else if (kind === "overlap") msg = "Quick pause. Offer the floor and clarify one speaker at a time.";
            else if (kind === "engagement_drop") msg = "Pulse check: ask one open question to re-engage.";
            if (!msg) return;

            speakRef.current?.speak(msg);
          } catch {}
        };

        // Dominance: speaking most of last 10s with higher average intensity
        if (speakCount10 >= 8 && avgRms10 > 0.08 && cool("dominance", 30000)) {
          mark("dominance");
          await emit("dominance", `Speaking ${speakCount10}/10s, avgRMS ${avgRms10.toFixed(3)}`);
        }
        // Overlap: reuse interruption heuristic as a proxy
        if (payload.audioDynamics.interruption && cool("overlap", 20000)) {
          mark("overlap");
          await emit("overlap", "Spike suggests speaking overlap/interruption");
        }
        // Engagement drop: sustained non-engaged cues
        const disengaged = engag8.filter((e) => e === "disagreeing?" || e === "-").length;
        if (disengaged >= 6 && cool("engagement_drop", 45000)) {
          mark("engagement_drop");
          await emit("engagement_drop", `Low engagement ${disengaged}/8s`);
        }

        // Stream mode is always ON in this build
        if (true) {
          const res = await fetch("/api/omnisense/analyze/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok || !res.body) return;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const chunks = buf.split("\n\n");
            for (const chunk of chunks) {
              if (chunk.includes("event: insight") && chunk.includes("data:")) {
                const line = chunk.split("\n").find((l) => l.startsWith("data:"));
                if (line) {
                  const json = line.slice(5).trim();
                  try {
                    const obj = JSON.parse(json);
                    const tip = obj?.action_recommendation || obj?.analysis || obj?.observation;
                    if (!cancelled && tip) setSuggestion(String(tip).slice(0, 700));
                    await reader.cancel();
                    return;
                  } catch {}
                }
              }
            }
          }
        }
      } catch {}
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [consented, paused, demoMode, levels.rms, levels.speaking, interruption, notes, outputMode]);

  // Load current backend context on component mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/omnisense/context");
        if (!res.ok) return;
        const j = await res.json();
        setSysInstr(j.systemInstruction || "");
        setPrefs(JSON.stringify(j.preferences || {}, null, 2));
        setHist(j.historySnippet || "");
        if (j?.preferences?.outputMode) setOutputMode(j.preferences.outputMode);
        if (j?.preferences?.privacyMode) setPrivacyMode(j.preferences.privacyMode);
      } catch {}
    })();
  }, []);

  // Load preferences at app start for header toggles
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/omnisense/context");
        if (!res.ok) return;
        const j = await res.json();
        if (j?.preferences?.outputMode) setOutputMode(j.preferences.outputMode);
        if (j?.preferences?.privacyMode) setPrivacyMode(j.preferences.privacyMode);
      } catch {}
    })();
  }, []);

  const saveContext = async () => {
    try {
      setSavingCtx(true);
      const res = await fetch("/api/omnisense/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: sysInstr,
          preferences: JSON.parse(prefs || "{}"),
          historySnippet: hist,
        }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (e) {
      alert("Failed to save context. Check preferences JSON.");
    } finally {
      setSavingCtx(false);
    }
  };

  const testAnalyze = async () => {
    try {
      const res = await fetch("/api/omnisense/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioDynamics: {
            intensityPct,
            speaking: levels.speaking,
            interruption: !!interruption,
          },
          visionHints: { scene: "meeting" },
          transcript: notes.slice(0, 400),
        }),
      });
      const j = await res.json();
      setAnalyzeOut(JSON.stringify(j, null, 2));
      if (typeof j?.confidence === "number") setAnalyzeConfidence(j.confidence);
    } catch {
      setAnalyzeOut("{\n  \"error\": \"analyze failed\"\n}");
    }
  };

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: cameraFacing } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount) as any;
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error(e);
    }
  }, [tick]);

  // Simple TTS helper when in voice mode
  useEffect(() => {
    speakRef.current = {
      speak: (t: string) => {
        try {
          if (typeof window === "undefined") return;
          if (!("speechSynthesis" in window)) return;
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(t);
          u.rate = 1.0;
          window.speechSynthesis.speak(u);
        } catch {}
      },
      cancel: () => {
        try { if (typeof window !== "undefined") window.speechSynthesis.cancel(); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  const speakingSeconds = useMemo(() => Math.round(speakingMs / 1000), [speakingMs]);
  const intensityPct = useMemo(() => Math.min(100, Math.round(levels.rms * 400)), [levels.rms]);

  const calendarDraftUrl = (title: string, date?: string, time?: string) => {
    // Build a simple Google Calendar event creation link
    // Dates should be in YYYYMMDD and optional time HHMM.
    const encode = encodeURIComponent;
    let datesParam = "";
    if (date) {
      const d = date.replaceAll("-", "");
      const t = (time || "0900").replaceAll(":", "");
      // 1 hour default duration
      datesParam = `&dates=${d}T${t}00/${d}T${(Number(t.slice(0,2))+1).toString().padStart(2,"0")}${t.slice(2)}00`;
    }
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encode(title)}${datesParam}`;
  };

  const runPlannerGoal = async (goalText?: string) => {
    const goal = (goalText || runGoal).trim();
    if (!goal || runStartedAt != null) return;
    setRunGoal("");
    setAutoRunGoal(false);
    setRunResult("");
    setRunStatus("Running...");
    setRunStartedAt(Date.now());
    setRunGoalIsDraft(false);
    const taskId = `pt_${Date.now()}`;
    const startedAt = Date.now();
    setPlannerTasks((prev) => [{ id: taskId, goal, status: "running", result: "", startedAt }, ...prev]);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, steps: 3, maxToolsPerStep: 2 }),
      });
      let json: any = null;
      try { json = await res.json(); } catch { json = null; }
      if (!res.ok) {
        const msg = String(json?.detail || json?.error || res.statusText || "failed");
        throw new Error(`${msg} (HTTP ${res.status})`);
      }
      const final = json?.final ? String(json.final).trim() : "";
      const result = final || "No output returned. Try rephrasing your goal.";
      setRunResult(result);
      setRunStatus("");
      setRunStartedAt(null);
      setPlannerTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "done", result, finishedAt: Date.now() } : t));
    } catch (e: any) {
      const errMsg = `error: ${e?.message || String(e)}`;
      setRunStatus("");
      setRunStartedAt(null);
      setRunResult(errMsg);
      setPlannerTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "error", result: errMsg, finishedAt: Date.now() } : t));
    }
  };

  const generateAutonomousActions = async () => {
    try {
      setActionQueueLoading(true);
      setActionQueueMsg("Analyzing meeting context...");
      const res = await fetch("/api/omnisense/autonomous-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.slice(0, 2000),
          meetingSummary: summary || suggestion,
          executeMode: false,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "failed");
      setActionQueue(j.actions || []);
      setActionQueueMsg(`${(j.actions || []).length} actions proposed`);
      setShowActionQueue(true);
    } catch (e: any) {
      setActionQueueMsg(`Error: ${e?.message || String(e)}`);
    } finally {
      setActionQueueLoading(false);
    }
  };

  const executeAction = async (actionId: string) => {
    setActionQueue((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: "executed", executedAt: Date.now() } : a))
    );
  };

  const approveAllActions = async () => {
    setActionQueue((prev) =>
      prev.map((a) => a.status === "proposed" && a.confidence >= 0.7 ? { ...a, status: "executed", executedAt: Date.now() } : a)
    );
    setActionQueueMsg("High-confidence actions approved");
  };

  const rateAction = async (actionId: string, rating: "up" | "down", correction?: string) => {
    try {
      const action = actionQueue.find((a) => a.id === actionId);
      await fetch("/api/omnisense/verify-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, actionType: action?.type || "unknown", rating, correction }),
      });
      setActionQueue((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, userRating: rating } : a))
      );
    } catch {}
  };

  const loadContinuity = async (mode: string = "review") => {
    try {
      setContinuityData(null);
      setShowContinuity(true);
      const res = await fetch(`/api/omnisense/continuity?mode=${mode}`);
      const j = await res.json();
      setContinuityData(j);
    } catch {
      setContinuityData({ error: "Failed to load continuity data" });
    }
  };

  const extractActions = async () => {
    try {
      setExtracting(true);
      const res = await fetch("/api/extract-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notesText: notes }),
      });
      if (!res.ok) return;
      const j = await res.json();
      setSummary(j.summary || "");
      setActions(Array.isArray(j.actions) ? j.actions : []);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-200 text-slate-900 dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      {appClosed && (
        <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-6 py-10">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">App closed</h2>
            <p className="mt-1 text-sm text-slate-600">Camera, microphone, and background processing have been stopped.</p>
            <div className="mt-4 flex items-center gap-3">
              <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white" onClick={() => setAppClosed(false)}>
                Re-open
              </button>
            </div>
          </div>
        </div>
      )}

      {!appClosed && (
        <>
      {!consented && !demoMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 text-black shadow-xl dark:bg-zinc-900 dark:text-zinc-50">
            <h2 className="mb-2 text-2xl font-semibold">Enable AI Assist</h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
              Camera and microphone will be used in real time. No raw media is stored. You can pause at any time.
            </p>
            <div className="flex gap-3">
              <button
                className="rounded-md bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
                data-testid="consent-enable"
                onClick={async () => {
                  setConsented(true);
                  await start();
                }}
              >
                Enable
              </button>
              <button
                className="rounded-md border border-zinc-300 px-4 py-2 dark:border-zinc-700"
                onClick={closeApp}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 hidden h-screen border-r border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100 md:block ${sidebarOpen ? "w-72" : "w-14"}`}
      >
        <div className="flex h-full flex-col overflow-y-auto p-3">
          <div className="flex-1">
            {sidebarOpen && (
              <>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
                <div className="mb-1 text-lg font-semibold tracking-tight text-slate-900">Settings</div>
                <div className="mb-4 text-xs text-slate-500">Control privacy, output, and device inputs.</div>
                <div className="space-y-4 text-sm">
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-slate-700">Response format</span>
                    <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm" value={outputMode} onChange={async (e)=>{ const v = e.target.value as "text"|"voice"; setOutputMode(v); try { await fetch("/api/omnisense/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: { outputMode: v } }) }); } catch {} }}>
                      <option value="text" className="text-gray-800">Text</option>
                      <option value="voice" className="text-gray-800">Voice</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-slate-700">Camera</span>
                    <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm" value={cameraFacing} onChange={(e) => setCameraFacing(e.target.value as "user" | "environment")}>
                      <option value="user">Front</option>
                      <option value="environment">Back</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-slate-700">Privacy</span>
                    <input type="checkbox" checked={privacyMode !== "off"} onChange={async (e)=>{ const v = e.target.checked ? "cloud" : "off"; setPrivacyMode(v as any); try { await fetch("/api/omnisense/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: { privacyMode: v } }) }); } catch {} }} className="h-4 w-4 rounded-md border-2 border-indigo-400 bg-gradient-to-br from-indigo-500 to-purple-600" />
                  </label>
                  <button className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 ${glassesConnected ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-900"}`} onClick={()=>{ if (glassesConnected) setGlassesConnected(false); else setShowGlassesModal(true); }} title="Connect AI Glasses (simulated)">{glassesConnected?"Glasses Connected":"Connect Glasses"}</button>
                  <button className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50" onClick={closeApp}>Close App</button>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
                <div className="mb-1 text-sm font-semibold tracking-tight text-slate-900">Session</div>
                <div className="mb-3 text-xs text-slate-500">Live signals and sensors.</div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-600">Mic</span>
                    <span className={`flex items-center gap-1.5 font-medium ${consented && !paused ? "text-emerald-700" : "text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${consented && !paused ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {consented && !paused ? "On" : "Off"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-600">Camera</span>
                    <span className={`flex items-center gap-1.5 font-medium ${consented ? "text-emerald-700" : "text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${consented ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {consented ? (cameraFacing === "user" ? "Front" : "Back") : "Off"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-600">Privacy</span>
                    <span className={`flex items-center gap-1.5 font-medium ${privacyMode === "cloud" ? "text-emerald-700" : privacyMode === "local" ? "text-blue-700" : "text-amber-700"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${privacyMode === "cloud" ? "bg-emerald-500" : privacyMode === "local" ? "bg-blue-500" : "bg-amber-500"}`} />
                      {privacyMode === "cloud" ? "Cloud" : privacyMode === "local" ? "Local" : "Off"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-600">Glasses</span>
                    <span className={`flex items-center gap-1.5 font-medium ${glassesConnected ? "text-emerald-700" : "text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${glassesConnected ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {reconnecting ? "Reconnecting" : glassesConnected ? "Connected" : "Off"}
                    </span>
                  </div>
                  <div className="mt-1 border-t border-slate-100 pt-2">
                    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                      <span className="text-slate-600">Speaking</span>
                      <span className="font-medium text-slate-900">{speakingSeconds}s</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-600">Intensity</span>
                    <span className="font-medium text-slate-900">{intensityPct}%</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-600">Engagement</span>
                    <span className="font-medium text-slate-900">{engagement}</span>
                  </div>
                  {sensorSample && (
                    <div className="mt-1 border-t border-slate-100 pt-2">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sensors</div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                        <span className="text-slate-600">Head motion</span>
                        <span className="font-medium text-slate-900">{sensorSample?.headMotion || "-"}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                        <span className="text-slate-600">Brightness</span>
                        <span className="font-medium text-slate-900">{typeof sensorSample?.brightness === "number" ? sensorSample.brightness : "-"}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                        <span className="text-slate-600">Temp</span>
                        <span className="font-medium text-slate-900">{typeof sensorSample?.temp === "number" ? sensorSample.temp : "-"}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {demoMode && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <button className="w-full text-left text-sm font-semibold" onClick={()=>setShowDemo(v=>!v)}>
                    {showDemo ? "▼" : "►"} Demo settings
                  </button>
                  {showDemo && (
                    <div className="mt-3 space-y-3 text-sm">
                      <label className="flex items-center justify-between"><span>Show Detections</span><input type="checkbox" checked={showDetectionsSidebar} onChange={(e)=>setShowDetectionsSidebar(e.target.checked)} /></label>
                      <button className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50" onClick={async()=>{ try{ setHealthMsg("Checking..."); const r= await fetch('/api/health'); const j= await r.json(); setHealthMsg(r.ok? (j?.status||'OK') : 'error'); } catch { setHealthMsg('error'); } }}>
                        Check API Health
                      </button>
                      {healthMsg && <div className="text-xs text-slate-500">{healthMsg}</div>}
                    </div>
                  )}
                </div>
              )}

              {showDetectionsSidebar && detections.length>0 && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="mb-2 text-sm font-semibold">Recent Detections</h3>
                  <div className="flex flex-col gap-1 text-xs">
                    {detections.slice(0,5).map((d,i)=> (
                      <div key={`${d.t}-${i}`} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
                        <span className="truncate"><span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">{d.kind}</span>{d.info||""}</span>
                        <span className="text-slate-500">{new Date(d.t).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </>
            )}
          </div>

          <button
            className="mt-2 flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-sm hover:bg-slate-50"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Collapse" : "Expand"}
          >
            {sidebarOpen ? "«" : "»"}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 overflow-auto bg-gradient-to-b from-white via-slate-50 to-slate-100 p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">OmniSense</div>
              <button className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setMobileSidebarOpen(false)}>
                Close
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${consented && !paused ? "bg-emerald-500" : "bg-slate-400"}`} />
                <span className="text-xs text-slate-700">AI Assist {consented && !paused ? "ON" : "OFF"}</span>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="mb-3 text-base font-semibold text-slate-900">Settings</div>
              <div className="space-y-4 text-sm">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-slate-700">Response format</span>
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                    value={outputMode}
                    onChange={async (e) => {
                      const v = e.target.value as "text" | "voice";
                      setOutputMode(v);
                      try {
                        await fetch("/api/omnisense/context", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ preferences: { outputMode: v } }),
                        });
                      } catch {}
                    }}
                  >
                    <option value="text" className="text-gray-800">Text</option>
                    <option value="voice" className="text-gray-800">Voice</option>
                  </select>
                </label>

                <label className="flex items-center justify-between gap-3">
                  <span className="text-slate-700">Privacy</span>
                  <input
                    type="checkbox"
                    checked={privacyMode !== "off"}
                    onChange={async (e) => {
                      const v = e.target.checked ? "cloud" : "off";
                      setPrivacyMode(v as any);
                      try {
                        await fetch("/api/omnisense/context", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ preferences: { privacyMode: v } }),
                        });
                      } catch {}
                    }}
                    className="h-4 w-4 rounded-md border-2 border-purple-400 bg-gradient-to-br from-blue-500 to-purple-600"
                  />
                </label>

                <button
                  className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 ${
                    glassesConnected ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-900"
                  }`}
                  onClick={() => {
                    if (glassesConnected) setGlassesConnected(false);
                    else setShowGlassesModal(true);
                  }}
                >
                  {glassesConnected ? "Glasses Connected" : "Connect Glasses"}
                </button>
                <button className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50" onClick={closeApp}>
                  Close App
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="mb-1 text-sm font-semibold tracking-tight text-slate-900">Session</div>
              <div className="mb-3 text-xs text-slate-500">Live signals and sensors.</div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                  <span className="text-slate-600">Mic</span>
                  <span className={`flex items-center gap-1.5 font-medium ${consented && !paused ? "text-emerald-700" : "text-slate-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${consented && !paused ? "bg-emerald-500" : "bg-slate-300"}`} />
                    {consented && !paused ? "On" : "Off"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                  <span className="text-slate-600">Camera</span>
                  <span className={`flex items-center gap-1.5 font-medium ${consented ? "text-emerald-700" : "text-slate-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${consented ? "bg-emerald-500" : "bg-slate-300"}`} />
                    {consented ? (cameraFacing === "user" ? "Front" : "Back") : "Off"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                  <span className="text-slate-600">Privacy</span>
                  <span className={`flex items-center gap-1.5 font-medium ${privacyMode === "cloud" ? "text-emerald-700" : privacyMode === "local" ? "text-blue-700" : "text-amber-700"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${privacyMode === "cloud" ? "bg-emerald-500" : privacyMode === "local" ? "bg-blue-500" : "bg-amber-500"}`} />
                    {privacyMode === "cloud" ? "Cloud" : privacyMode === "local" ? "Local" : "Off"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                  <span className="text-slate-600">Glasses</span>
                  <span className={`flex items-center gap-1.5 font-medium ${glassesConnected ? "text-emerald-700" : "text-slate-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${glassesConnected ? "bg-emerald-500" : "bg-slate-300"}`} />
                    {reconnecting ? "Reconnecting" : glassesConnected ? "Connected" : "Off"}
                  </span>
                </div>
                <div className="mt-1 border-t border-slate-100 pt-2">
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-600">Speaking</span>
                    <span className="font-medium text-slate-900">{speakingSeconds}s</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                  <span className="text-slate-600">Intensity</span>
                  <span className="font-medium text-slate-900">{intensityPct}%</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                  <span className="text-slate-600">Engagement</span>
                  <span className="font-medium text-slate-900">{engagement}</span>
                </div>
              </div>
            </div>

            {demoMode && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <button className="w-full text-left text-sm font-semibold" onClick={() => setShowDemo((v) => !v)}>
                  {showDemo ? "▼" : "►"} Demo settings
                </button>
                {showDemo && (
                  <div className="mt-3 space-y-3 text-sm">
                    <label className="flex items-center justify-between"><span>Show Detections</span><input type="checkbox" checked={showDetectionsSidebar} onChange={(e)=>setShowDetectionsSidebar(e.target.checked)} /></label>
                    <button className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50" onClick={async()=>{ try{ setHealthMsg("Checking..."); const r= await fetch('/api/health'); const j= await r.json(); setHealthMsg(r.ok? (j?.status||'OK') : 'error'); } catch { setHealthMsg('error'); } }}>
                      Check API Health
                    </button>
                    {healthMsg && <div className="text-xs text-slate-500">{healthMsg}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`transition-[padding-left] duration-200 md:pl-72 ${sidebarOpen ? "md:pl-72" : "md:pl-14"}`}>

      {/* Hero banner */}
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <div className="rounded-3xl border border-white/20 bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-600 px-6 py-5 shadow-2xl">
          {/* Top row: title + action buttons */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <button className="rounded-lg bg-white/15 px-2 py-1.5 text-white hover:bg-white/25 md:hidden" onClick={() => setMobileSidebarOpen(true)}>≡</button>
                <h1 className="truncate text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl">OmniSense</h1>
              </div>
              <p className="mt-0.5 text-xs text-white/70 sm:text-sm">Real-time social intelligence · Always listening, always ready</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition sm:text-sm ${
                  demoMode ? "bg-emerald-500 hover:bg-emerald-400" : "bg-white/15 hover:bg-white/25"
                }`}
                onClick={() => { setAppClosed(false); setDemoMode((v) => !v); }}
              >
                {demoMode ? "Demo ON" : "Demo"}
              </button>
              {!sidebarOpen && (
                <button className="hidden rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 md:block sm:text-sm" onClick={() => setSidebarOpen(true)}>
                  Settings
                </button>
              )}
            </div>
          </div>
          {/* Status dots row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/80">
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${consented && !paused ? "bg-emerald-300" : "bg-white/40"}`} />
              {consented && !paused ? "Listening" : "Mic off"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${consented ? "bg-emerald-300" : "bg-white/40"}`} />
              {consented ? (cameraFacing === "user" ? "Front cam" : "Back cam") : "Cam off"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${glassesConnected ? "bg-emerald-300" : "bg-white/40"}`} />
              {glassesConnected ? "Glasses" : "No glasses"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${privacyMode === "cloud" ? "bg-emerald-300" : privacyMode === "local" ? "bg-blue-300" : "bg-amber-300"}`} />
              {privacyMode === "cloud" ? "Cloud" : privacyMode === "local" ? "Local" : "Privacy off"}
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-6 pt-6 pb-12 md:grid-cols-12">
        {/* User Journey Status */}
        <div className="md:col-span-12">
          <UserJourneyStatus
            consented={consented}
            paused={paused}
            outputMode={outputMode}
            privacyMode={privacyMode}
            speakingSeconds={speakingSeconds}
            intensityPct={intensityPct}
          />
        </div>

        {showGlassesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-md rounded-xl bg-white p-5 text-black shadow-xl dark:bg-zinc-900 dark:text-zinc-50">
              <h3 className="mb-3 text-lg font-semibold">Connect AI Glasses</h3>
              <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
                Choose a device type to connect. Simulated adapter emits motion, light and temperature.
              </div>
              <label className="mb-4 block text-sm">
                Adapter
                <select
                  className="mt-1 w-full rounded border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700"
                  value={bridgeKind}
                  onChange={(e) => setBridgeKind(e.target.value as any)}
                >
                  <option value="simulated">Simulated</option>
                  <option value="vendorX">Vendor X (placeholder)</option>
                </select>
              </label>
              <div className="mt-4 flex items-center justify-end gap-3">
                <button className="rounded-md border px-3 py-1.5 text-sm dark:border-zinc-700" onClick={() => setShowGlassesModal(false)}>
                  Cancel
                </button>
                <button
                  className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
                  onClick={() => {
                    setShowGlassesModal(false);
                    // This will trigger the bridge effect with selected kind
                    setGlassesConnected(true);
                  }}
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Suggestions only; camera runs in background */}
        <section className={`md:col-span-12 ${cardBase}`}>
          <div className={cardTitleRow}>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Live Suggestions</h3>
              <div className="mt-1 text-xs text-slate-500">Short, actionable coaching as context updates.</div>
            </div>
            <div className="flex items-center gap-2">
              {demoMode && <div className={`${pillBase} border-slate-200 bg-slate-50 text-slate-700`}>Demo</div>}
              {interruption && <div className={`${pillBase} border-amber-200 bg-amber-50 text-amber-800`}>Interruption</div>}
            </div>
          </div>
          {demoMode && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="mb-2 text-xs font-medium text-slate-600">Demo video</div>
              <video
                className="h-44 w-full rounded bg-black object-cover"
                controls
                playsInline
                src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
              />
            </div>
          )}
          <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm leading-relaxed text-slate-800">
            {suggestion}
          </div>
          <video ref={videoRef} className="hidden h-[1px] w-[1px]" muted playsInline />
        </section>

        {/* Background Intel — unified auto-planner, actions, and notes */}
        <section className={`md:col-span-12 ${cardBase}`}>
          <div className={cardTitleRow}>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Background Intel</h3>
              <div className="mt-1 text-xs text-slate-500">Auto-collected plans, actions, and insights from your conversation.</div>
            </div>
            <div className="flex items-center gap-2">
              {actionQueueLoading && (
                <div className={`${pillBase} border-indigo-200 bg-indigo-50 text-indigo-800`}>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                  <span>Listening</span>
                </div>
              )}
              {(actionQueue.length > 0 || plannerTasks.length > 0) && (
                <span className="text-xs text-slate-500">{actionQueue.length + plannerTasks.length} items</span>
              )}
            </div>
          </div>

          {/* Empty state */}
          {actionQueue.length === 0 && plannerTasks.length === 0 && !actionQueueLoading && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
              Listening for plans, commitments, and action items in your conversation...
            </div>
          )}

          {/* Auto-detected planner insights */}
          {plannerTasks.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Detected Plans</div>
                <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setPlannerTasks([])}>Clear</button>
              </div>
              {plannerTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-sm">
                  <div className="whitespace-pre-line text-slate-700">{task.result}</div>
                  <div className="mt-1 text-[10px] text-slate-400">{new Date(task.finishedAt || task.startedAt).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          )}

          {/* Auto-executed actions */}
          {actionQueue.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</div>
              {actionQueue.slice(0, 10).map((action) => (
                <div key={action.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        action.type === "calendar" ? "bg-blue-100 text-blue-700" :
                        action.type === "email" ? "bg-purple-100 text-purple-700" :
                        action.type === "task" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>{action.type}</span>
                      <span className="font-medium text-slate-900">{action.title}</span>
                    </div>
                    {action.description && <div className="mt-0.5 text-xs text-slate-500">{action.description}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    {action.type === "calendar" && action.data?.date && (
                      <a className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100" href={calendarDraftUrl(action.title, action.data.date, action.data.time)} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    )}
                    {!action.userRating && (
                      <>
                        <button className="rounded border border-slate-200 px-1 py-0.5 text-xs hover:bg-emerald-50" onClick={() => rateAction(action.id, "up")} title="Correct">👍</button>
                        <button className="rounded border border-slate-200 px-1 py-0.5 text-xs hover:bg-red-50" onClick={() => rateAction(action.id, "down")} title="Incorrect">👎</button>
                      </>
                    )}
                    {action.userRating && (
                      <span className={`text-[10px] font-medium ${action.userRating === "up" ? "text-emerald-600" : "text-red-600"}`}>
                        {action.userRating === "up" ? "✓" : "✗"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Auto-drafted notes (compact) */}
          {notes && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Notes</div>
              <div className="whitespace-pre-line rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs text-slate-600">{notes.slice(0, 500)}</div>
            </div>
          )}
        </section>

      </main>
      </div>
        </>
      )}
    </div>
  );
}
