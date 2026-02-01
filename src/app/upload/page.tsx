"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export default function UploadAnalyzePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [frameCount, setFrameCount] = useState<number>(8);
  const [notes, setNotes] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string>("");
  const [confidence, setConfidence] = useState<number | null>(null);

  const extractFrames = useCallback(async (video: HTMLVideoElement, n: number): Promise<string[]> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    const duration = video.duration || 0;
    const frames: string[] = [];
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    if (duration <= 0) return [];
    for (let i = 1; i <= n; i++) {
      const t = (duration * i) / (n + 1);
      await new Promise<void>((resolve) => {
        const handler = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL("image/png"));
          video.removeEventListener("seeked", handler);
          resolve();
        };
        video.addEventListener("seeked", handler);
        video.currentTime = t;
      });
    }
    return frames;
  }, []);

  const analyze = useCallback(async () => {
    const vid = videoRef.current;
    if (!vid || !videoUrl) return;
    try {
      setAnalyzing(true);
      setResult("");
      setConfidence(null);
      if (vid.readyState < 2) {
        await new Promise((r) => vid.addEventListener("loadeddata", () => r(null), { once: true }));
      }
      const frames = await extractFrames(vid, frameCount);
      const res = await fetch("/api/omnisense/analyze-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frames: frames.map((d) => ({ dataUrl: d })),
          transcript: notes.slice(0, 800),
        }),
      });
      const j = await res.json();
      setResult(JSON.stringify(j, null, 2));
      if (typeof j?.confidence === "number") setConfidence(j.confidence);
    } catch (e) {
      setResult("{\n  \"error\": \"video analysis failed\"\n}");
    } finally {
      setAnalyzing(false);
    }
  }, [videoUrl, frameCount, notes, extractFrames]);

  // Auto-load default local video served by API (dev only)
  // This hits /api/local-video, which streams C:/Users/USER/Downloads/a.mp4
  // If you want to disable, comment out this effect or clear the videoUrl.
  // We also expose an explicit button below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setVideoUrl("/api/local-video");
  }, []);

  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <div className="text-sm">OmniSense • Upload Video Analysis</div>
        <a className="text-xs underline" href="/">Home</a>
      </header>

      <main className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-6 pb-12 md:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <video
            ref={videoRef}
            className="h-[280px] w-full rounded-lg bg-black object-cover"
            muted
            controls
            src={videoUrl || undefined}
          />
          <div className="mt-3 flex flex-col gap-3">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setVideoUrl(URL.createObjectURL(f));
                } else {
                  setVideoUrl("");
                }
              }}
            />
            <div className="flex items-center gap-3 text-xs">
              <button
                className="rounded-md border px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => setVideoUrl("/api/local-video")}
              >
                Load default (a.mp4)
              </button>
              <span className="text-zinc-500">Dev-only: streams C:/Users/USER/Downloads/a.mp4</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="text-zinc-600 dark:text-zinc-300">Frames:</label>
              <input
                type="number"
                min={4}
                max={20}
                value={frameCount}
                onChange={(e) => setFrameCount(Math.max(4, Math.min(20, Number(e.target.value) || 8)))}
                className="w-20 rounded-md border border-zinc-300 bg-transparent p-1 text-sm dark:border-zinc-700"
              />
              <button
                className="rounded-md bg-black px-3 py-1.5 text-white disabled:opacity-60 dark:bg-white dark:text-black"
                onClick={analyze}
                disabled={!videoUrl || analyzing}
              >
                {analyzing ? "Analyzing…" : "Analyze Video"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-2 text-lg font-semibold">Context (Optional Transcript)</h3>
          <textarea
            className="h-48 w-full rounded-md border border-zinc-300 bg-transparent p-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            placeholder="Paste transcript or notes here to include in analysis..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>

        {result && (
          <section className="md:col-span-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Video Insight</h3>
              {confidence != null && (
                <span className="text-xs text-zinc-600 dark:text-zinc-300">Confidence: {(confidence * 100).toFixed(0)}%</span>
              )}
            </div>
            <pre className="max-h-96 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950">
{result}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}
