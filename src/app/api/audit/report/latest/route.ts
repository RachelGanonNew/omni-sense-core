import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(_req: NextRequest) {
  try {
    const dir = path.join(process.cwd(), ".data", "verify");
    if (!fs.existsSync(dir)) {
      return new Response("No reports", { status: 404, headers: { "content-type": "text/plain" } });
    }
    const files = fs
      .readdirSync(dir)
      .filter((n) => n.startsWith("audit_") && n.endsWith(".html"))
      .map((n) => ({ n, t: Number(n.replace(/[^0-9]/g, "")) || fs.statSync(path.join(dir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (files.length === 0) {
      return new Response("No reports", { status: 404, headers: { "content-type": "text/plain" } });
    }
    const latest = path.join(dir, files[0].n);
    const html = fs.readFileSync(latest, "utf8");
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (e) {
    return new Response("failed", { status: 500, headers: { "content-type": "text/plain" } });
  }
}
