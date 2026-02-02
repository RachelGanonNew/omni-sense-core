import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), ".data");
const logFile = path.join(dataDir, "agent.log");

function ensureDir() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  } catch {}
}

export function logJsonl(entry: Record<string, any>) {
  try {
    ensureDir();
    const line = JSON.stringify({ ts: Date.now(), ...entry }) + "\n";
    fs.appendFileSync(logFile, line, { encoding: "utf8" });
  } catch {}
}

export function readRecentLogs(limit = 200): string[] {
  try {
    ensureDir();
    if (!fs.existsSync(logFile)) return [];
    const txt = fs.readFileSync(logFile, "utf8");
    const lines = txt.trim().split(/\r?\n/);
    return lines.slice(-limit);
  } catch {
    return [];
  }
}
