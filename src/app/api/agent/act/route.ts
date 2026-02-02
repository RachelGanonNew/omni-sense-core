import { NextRequest, NextResponse } from "next/server";
import { runAgentStep } from "@/lib/agent";
import { getOmniContext } from "@/lib/omnisenseStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { observation = {}, preferences, maxTools } = body || {};

    // Enforce privacy: if local or off, do not call the cloud model
    const { preferences: storePrefs } = getOmniContext();
    const privacy = (preferences?.privacyMode || storePrefs?.privacyMode || "cloud") as string;
    if (privacy === "off") {
      return NextResponse.json({ error: "privacy_off" }, { status: 403 });
    }

    const out = await runAgentStep({ observation, preferences, maxTools });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
