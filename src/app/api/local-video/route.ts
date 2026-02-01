import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

// WARNING: This reads a local file path on the dev machine. For demo/dev only.
const LOCAL_VIDEO_PATH = "C:/Users/USER/Downloads/a.mp4"; // Windows path, use forward slashes for Node

export async function GET(req: NextRequest) {
  try {
    const filePath = path.normalize(LOCAL_VIDEO_PATH);
    if (!fs.existsSync(filePath)) {
      return new Response("File not found", { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (isNaN(start) || isNaN(end) || start > end || end >= fileSize) {
        return new Response("Invalid range", { status: 416 });
      }
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": "video/mp4",
        },
      });
    }

    const stream = fs.createReadStream(filePath);
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": "video/mp4",
      },
    });
  } catch (e) {
    return new Response("Failed to read local video", { status: 500 });
  }
}
