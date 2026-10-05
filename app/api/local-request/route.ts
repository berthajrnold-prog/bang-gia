import { NextRequest, NextResponse } from "next/server";
import { hasAgentKey, readAgentState, updateAgentState } from "@/lib/local-agent";

// GET: polled by the home-machine agent. Returns the latest scrape request and
// records that the agent is alive.
export async function GET(req: NextRequest) {
  if (!hasAgentKey(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { requestedAt } = await readAgentState();
  await updateAgentState({ seenAt: new Date().toISOString() });
  return NextResponse.json({ ok: true, requestedAt });
}
