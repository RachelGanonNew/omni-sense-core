import { NextRequest, NextResponse } from "next/server";
import { listPolicies, removeExpiredPolicies } from "@/lib/policyStore";

export async function GET(_req: NextRequest) {
  try {
    removeExpiredPolicies(Date.now());
    const items = listPolicies();
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
