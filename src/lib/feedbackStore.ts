import fs from "fs";
import { dataPath } from "./dataDir";

export type FeedbackEntry = {
  t: number;
  actionId: string;
  actionType: string;
  rating: "up" | "down";
  correction?: string;
};

function filePath() {
  return dataPath("feedback.jsonl");
}

export function appendFeedback(entry: FeedbackEntry) {
  try {
    const p = filePath();
    const dir = p.replace(/[\\/][^\\/]+$/, "");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(p, JSON.stringify(entry) + "\n", { encoding: "utf8" });
  } catch {}
}

export function listRecentFeedback(limit = 50): FeedbackEntry[] {
  try {
    const p = filePath();
    if (!fs.existsSync(p)) return [];
    const txt = fs.readFileSync(p, "utf8");
    const lines = txt.trim().split(/\r?\n/).filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean) as FeedbackEntry[];
  } catch {
    return [];
  }
}

export function feedbackStats(): { total: number; up: number; down: number; accuracy: number } {
  const items = listRecentFeedback(200);
  const up = items.filter((i) => i.rating === "up").length;
  const down = items.filter((i) => i.rating === "down").length;
  const total = up + down;
  return { total, up, down, accuracy: total > 0 ? up / total : 1 };
}
