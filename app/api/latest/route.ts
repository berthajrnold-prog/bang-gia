import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), ".scrape-cache.json");

export async function GET() {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ rows: [], timestamp: null });
  }
}

// POST: seed cache from client-side localStorage (one-time bootstrap)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.rows || !body.timestamp) {
      return NextResponse.json({ ok: false, error: "missing rows/timestamp" }, { status: 400 });
    }
    await writeFile(CACHE_FILE, JSON.stringify(body), "utf8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
