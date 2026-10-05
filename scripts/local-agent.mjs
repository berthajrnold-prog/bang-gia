// Home-machine agent: polls the VPS every 30s. When someone presses "Cào giá ngay",
// it scrapes FPT/TGDĐ (which block the VPS IP) via scripts/scrape-local.mjs.
// Started hidden at Windows login by Cai-dat-tu-dong-cao.bat; log: local-agent.log
import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const PROJECT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VPS_URL = process.env.VPS_URL ?? "http://45.76.162.76:3000";
const KEY = process.env.HISTORY_SHEET_ID;
const STATE_FILE = path.join(PROJECT_DIR, ".agent-state.json");
const PID_FILE = path.join(PROJECT_DIR, ".agent.pid");
const POLL_MS = 30_000;

const log = (...a) => console.log(new Date().toLocaleString("vi-VN"), ...a);

// Single instance: exit if another agent is already running
if (existsSync(PID_FILE)) {
  const pid = Number(readFileSync(PID_FILE, "utf8"));
  try {
    process.kill(pid, 0);
    log(`Agent đã chạy (pid ${pid}), thoát.`);
    process.exit(0);
  } catch {}
}
writeFileSync(PID_FILE, String(process.pid));

let lastHandled = null;
try {
  lastHandled = JSON.parse(readFileSync(STATE_FILE, "utf8")).lastHandled;
} catch {}

function runScrape() {
  return new Promise((resolve) => {
    const p = spawn("npx", ["tsx", "--env-file=.env.local", "scripts/scrape-local.mjs"], {
      cwd: PROJECT_DIR,
      shell: true,
      stdio: "inherit",
      windowsHide: true,
    });
    p.on("exit", resolve);
  });
}

log(`Agent bắt đầu, theo dõi ${VPS_URL}`);
for (;;) {
  try {
    const res = await fetch(`${VPS_URL}/api/local-request`, { headers: { "x-merge-key": KEY } });
    const { requestedAt } = await res.json();
    if (requestedAt && requestedAt !== lastHandled) {
      log(`Có yêu cầu cào lúc ${requestedAt} → cào FPT/TGDĐ`);
      await runScrape();
      lastHandled = requestedAt;
      writeFileSync(STATE_FILE, JSON.stringify({ lastHandled }));
    }
  } catch (e) {
    log("Không kết nối được VPS:", e.message);
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
