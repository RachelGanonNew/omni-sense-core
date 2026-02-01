import { NextRequest, NextResponse } from "next/server";
import { getOmniContext } from "@/lib/omnisenseStore";
import { createResearchProvider } from "@/lib/research";

// Public-web enrichment using a pluggable provider
// GET /api/research?name=Elon%20Musk
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = (searchParams.get("name") || "").trim();
    if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });

    const { preferences } = getOmniContext();
    const privacy = preferences?.privacyMode || "cloud";
    if (privacy === "off") return NextResponse.json({ error: "privacy_off" }, { status: 403 });
    if (privacy === "local") {
      return NextResponse.json({ source: "local", summary: `Local mode: cannot fetch web for ${name}.` });
    }

    const provider = createResearchProvider();
    const result = await provider.enrichPerson(name);
    if (!result || result.source === "none") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
