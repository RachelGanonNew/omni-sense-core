"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Levels = {
  rms: number;
  speaking: boolean;
};

export default function Home() {
  const [consented, setConsented] = useState(false);
  const [paused, setPaused] = useState(false);
  const [levels, setLevels] = useState<Levels>({ rms: 0, speaking: false });
  const [speakingMs, setSpeakingMs] = useState(0);
  const [interruption, setInterruption] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string>(
    "Stay concise. Invite others to weigh in. Clarify owners and dates."
  );
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<string>("");
  const [actions, setActions] = useState<Array<any>>([]);
  const [extracting, setExtracting] = useState(false);
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [useStream, setUseStream] = useState(false);
  const [sysInstr, setSysInstr] = useState<string>("");
  const [prefs, setPrefs] = useState<string>("{}");
  const [hist, setHist] = useState<string>("");
  const [savingCtx, setSavingCtx] = useState(false);
  const [analyzeOut, setAnalyzeOut] = useState<string>("");
  const [analyzeConfidence, setAnalyzeConfidence] = useState<number | null>(null);
  const [outputMode, setOutputMode] = useState<"text" | "voice">("text");
  const [privacyMode, setPrivacyMode] = useState<"off" | "local" | "cloud">("cloud");
  const speakRef = useRef<{ speak: (t: string) => void; cancel: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const lastSpeakingRef = useRef<boolean>(false);
  const lastRmsRef = useRef<number>(0);
  const startedAtRef = useRef<number | null>(null);

  const speakingThreshold = 0.06; // heuristic
  const spikeFactor = 2.2; // interruption heuristic

  const stopAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (analyserRef.current) analyserRef.current.disconnect();
    analyserRef.current = null;
    if (audioCtxRef.current) audioCtxRef.current.close();
    audioCtxRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const teardown = useCallback(() => {
    stopAudio();
    stopStream();
  }, [stopAudio, stopStream]);

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
    setLevels({ rms, speaking });

    if (startedAtRef.current == null) startedAtRef.current = performance.now();
    const now = performance.now();

    if (!paused && speaking) {
      setSpeakingMs((ms) => ms + 1000 / 30);
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
    if (!consented || paused) return;
    let cancelled = false;
    const iv = setInterval(async () => {
      try {
        const payload = {
          audioDynamics: {
            intensityPct: Math.min(100, Math.round(levels.rms * 400)),
            speaking: levels.speaking,
            interruption: !!interruption,
          },
          visionHints: { scene: "meeting" },
          transcript: notes.slice(0, 220),
        };

        if (useStream) {
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
                    if (!cancelled && tip) setSuggestion(String(tip).slice(0, 180));
                    await reader.cancel();
                    return;
                  } catch {}
                }
              }
            }
          }
        } else {
          const res = await fetch("/api/suggest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intensityPct: payload.audioDynamics.intensityPct,
              speaking: payload.audioDynamics.speaking,
              interruption: payload.audioDynamics.interruption,
            }),
          });
          if (!res.ok) return;
          const j = await res.json();
          if (!cancelled && j?.suggestion) {
            setSuggestion(j.suggestion);
            if (outputMode === "voice" && j?.suggestion) {
              speakRef.current?.speak(String(j.suggestion).slice(0, 180));
            }
          }
        }
      } catch {}
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [consented, paused, levels.rms, levels.speaking, interruption, useStream, notes, outputMode]);

  // Load current backend context when trainer opens
  useEffect(() => {
    if (!trainerOpen) return;
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
  }, [trainerOpen]);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {!consented && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-0.5">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-slate-900">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Enable AI Assistant</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Camera and microphone will be used in real time. No raw media is stored. You can pause at any time.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 font-medium text-white shadow-lg transition-all hover:shadow-xl"
                onClick={async () => {
                  setConsented(true);
                  await start();
                }}
              >
                Enable Assistant
              </button>
              <button
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={() => setConsented(false)}
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${consented && !paused ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-gray-400"}`} />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                AI Assistant {consented && !paused ? "Active" : "Inactive"}
              </span>
            </div>
            {consented && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span>Speaking: {speakingSeconds}s</span>
                <span>•</span>
                <span>Intensity: {intensityPct}%</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              onClick={() => setTrainerOpen((v) => !v)}
            >
              {trainerOpen ? "Close Settings" : "Settings"}
            </button>
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                paused 
                  ? "bg-green-500 text-white hover:bg-green-600" 
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
              onClick={() => {
                if (!consented) return;
                setPaused((p) => {
                  const np = !p;
                  if (np) {
                    stopAudio();
                    stopStream();
                  } else {
                    start();
                  }
                  return np;
                });
              }}
            >
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* Video Section */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Live Video Feed</h2>
              <video 
                ref={videoRef} 
                className="h-96 w-full rounded-xl bg-black object-cover shadow-inner" 
                muted 
                playsInline 
              />
              
              {/* Audio Visualization */}
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Speaking Intensity</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{intensityPct}%</span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300 ease-out"
                    style={{ width: `${intensityPct}%` }}
                  />
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  You've been speaking for {speakingSeconds} seconds
                </div>
              </div>

              {/* Interruption Alert */}
              {interruption && (
                <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="font-medium text-amber-800 dark:text-amber-200">{interruption}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Suggestions Section */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">AI Suggestions</h2>
              
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-slate-800">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {suggestion}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Suggestions update in real-time based on conversation dynamics
              </div>
            </div>
          </div>
        </div>

        {/* Notes and Actions Section */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Meeting Notes & Actions</h2>
          
          <textarea
            className="w-full min-h-32 rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-600 dark:bg-slate-800 dark:focus:border-blue-400 dark:focus:bg-slate-700"
            placeholder="Paste brief meeting notes or type key commitments..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          
          <div className="mt-4 flex items-center gap-4">
            <button
              className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-medium text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-60"
              onClick={extractActions}
              disabled={!notes.trim() || extracting}
            >
              {extracting ? "Extracting..." : "Extract Actions"}
            </button>
            {summary && (
              <span className="text-sm text-green-600 dark:text-green-400">
                ✓ Summary ready
              </span>
            )}
          </div>

          {/* Summary */}
          {summary && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-slate-800">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">Summary</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">{summary}</p>
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Action Items</h3>
              {actions.map((a, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{a.title}</h4>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {a.type}
                        {a.owner && ` • ${a.owner}`}
                        {a.due && ` • Due ${a.due}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.type === "calendar" && (
                        <a
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          href={calendarDraftUrl(a.title, a.date, a.time)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Add to Calendar
                        </a>
                      )}
                      {a.type === "task" && (
                        <button
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          onClick={() => alert("Task added locally for demo")}
                        >
                          Add Task
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        {trainerOpen && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">OmniSense Settings</h2>
            
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  System Instruction
                </label>
                <textarea
                  className="h-48 w-full rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-600 dark:bg-slate-800 dark:focus:border-blue-400 dark:focus:bg-slate-700"
                  value={sysInstr}
                  onChange={(e) => setSysInstr(e.target.value)}
                />
              </div>
              
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Preferences (JSON)
                </label>
                <textarea
                  className="h-48 w-full rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm font-mono outline-none focus:border-blue-500 focus:bg-white dark:border-gray-600 dark:bg-slate-800 dark:focus:border-blue-400 dark:focus:bg-slate-700"
                  value={prefs}
                  onChange={(e) => setPrefs(e.target.value)}
                />
              </div>
            </div>
            
            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                History Snippet
              </label>
              <textarea
                className="h-20 w-full rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-600 dark:bg-slate-800 dark:focus:border-blue-400 dark:focus:bg-slate-700"
                value={hist}
                onChange={(e) => setHist(e.target.value)}
              />
            </div>
            
            <div className="mt-6 flex items-center gap-4">
              <button
                className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-medium text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-60"
                onClick={saveContext}
                disabled={savingCtx}
              >
                {savingCtx ? "Saving..." : "Save Settings"}
              </button>
              <button
                className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={testAnalyze}
              >
                Test Analysis
              </button>
            </div>
            
            {analyzeOut && (
              <div className="mt-6">
                {analyzeConfidence != null && (
                  <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                    Confidence: {(analyzeConfidence * 100).toFixed(0)}%
                  </div>
                )}
                <pre className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs dark:border-gray-700 dark:bg-slate-800">
                  {analyzeOut}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
