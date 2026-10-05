import { readFile, writeFile } from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";

// State shared with the home-machine agent (scripts/local-agent.mjs):
// requestedAt = last time someone pressed "Cào giá ngay"; seenAt = last agent poll.
const STATE_FILE = path.join(process.cwd(), ".local-agent.json");

export interface AgentState {
  requestedAt: string | null;
  seenAt: string | null;
}

export async function readAgentState(): Promise<AgentState> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8"));
  } catch {
    return { requestedAt: null, seenAt: null };
  }
}

export async function updateAgentState(patch: Partial<AgentState>): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify({ ...(await readAgentState()), ...patch }), "utf8");
}

// Agent endpoints auth: x-merge-key must equal HISTORY_SHEET_ID (present in both .env.local)
export function hasAgentKey(req: NextRequest): boolean {
  return !!process.env.HISTORY_SHEET_ID && req.headers.get("x-merge-key") === process.env.HISTORY_SHEET_ID;
}
