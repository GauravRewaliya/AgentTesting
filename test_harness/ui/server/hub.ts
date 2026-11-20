// WebSocket hub: the page opens ONE socket (/api/ws) and never polls. The files the runners write cannot notify us,
// so ONE server-side loop (not one per browser) re-reads them while at least one page is connected and pushes a topic only when its JSON changed.
// Client -> server: {sub:{task?,detail?,transcript?}} (what this page looks at) or {kick:1} (re-check now, e.g. after a POST).
// Server -> client: {t:"overview"|"live"|"chat"|"result"|"bg"|"bugs"|"evidence"|"detail"|"transcript"|"runs"|..., data}
import type { ServerWebSocket } from "bun";
import * as exp from "./experiment.ts";
import * as pv from "./preview.ts";
import * as br from "./browser.ts";
import * as st from "./settings.ts";
import * as pt from "./prompttests.ts";
import * as runs from "./runs.ts";
import { usage } from "./usage.ts";

interface Sub { task?: string; detail?: string; transcript?: string; settings?: boolean; usage?: boolean; browser?: boolean; prompttests?: boolean; runs?: boolean; runLog?: string; runCase?: string }
export interface Client { sub: Sub; sent: Map<string, string> }
type Ws = ServerWebSocket<Client>;

const TICK_MS = Number(process.env.WS_TICK_MS) || 1500, OVERVIEW_EVERY = 4;   // the case list changes rarely: every 4th tick
const clients = new Set<Ws>();
let timer: ReturnType<typeof setInterval> | undefined, running = false, n = 0, ovCache: unknown = null, usageCache: unknown = null;

function emit(ws: Ws, topic: string, data: unknown) {
  const s = JSON.stringify(data ?? null);
  if (ws.data.sent.get(topic) === s) return;
  ws.data.sent.set(topic, s); ws.send(`{"t":"${topic}","data":${s}}`);
  console.log(`[hub] -> push ${topic} ${s.length}B (${clients.size} client${clients.size === 1 ? "" : "s"})`);   // only real changes get here: an unchanged topic is skipped above
}
const safe = <T>(fn: () => T): T | { error: string } => { try { return fn(); } catch (e) { return { error: (e as Error).message }; } };

let lastSweep = 0;
async function tick(force = false) {
  if (running || !clients.size) return; running = true;
  try {
    if (Date.now() - lastSweep > 20_000) { lastSweep = Date.now(); const freed = exp.sweepStale(); if (freed.length) console.log(`[hub] freed ${freed.length} stale agent(s) of killed runs: ${freed.slice(0, 6).join(", ")}`); }   // a killed run must not show as running
    if (force || n++ % OVERVIEW_EVERY === 0) ovCache = await exp.overview();
    const lv = exp.live(), results = new Map<string, unknown>();
    // Settings topics: computed ONCE per tick for everybody, and only when some page asked (the files are re-read on our own tick: they cannot notify us; usage parses a transcript once per mtime+size)
    const want = (k: "settings" | "usage" | "browser" | "prompttests" | "runs") => [...clients].some((c) => c.data.sub[k]);
    const settingsNow = want("settings") ? safe(() => st.state()) : undefined, usageNow = want("usage") && (!usageCache || n % 4 === 1) ? safe(() => usage()) : undefined, browserNow = want("browser") ? await br.overview().catch((e) => ({ error: String(e) })) : undefined;
    const ptNow = want("prompttests") ? safe(() => pt.live()) : undefined;
    const runsNow = want("runs") ? safe(() => runs.sessionRuns()) : undefined;   // the runs list: pushed when it changes (it replaces the page's own 1.5 s polling)
    if (usageNow) usageCache = usageNow;
    for (const ws of clients) {
      const { task, detail, transcript } = ws.data.sub, s = task ? lv.find((x) => x.task === task) : undefined;
      emit(ws, "overview", ovCache); emit(ws, "live", lv);
      if (ws.data.sub.settings && settingsNow) emit(ws, "settings", settingsNow);
      if (ws.data.sub.usage && (usageNow ?? usageCache)) emit(ws, "usage", usageNow ?? usageCache);
      if (ws.data.sub.browser && browserNow) emit(ws, "browser", browserNow);
      if (ws.data.sub.prompttests && ptNow) emit(ws, "prompttests", ptNow);
      if (ws.data.sub.runs && runsNow) { const { runLog, runCase } = ws.data.sub; emit(ws, "runs", { all: runsNow, log: runLog ? safe(() => runs.runLog(runLog)) : null, caseRuns: runCase ? await runs.caseRuns(runCase).catch(() => null) : null }); }
      if (!task) continue;
      emit(ws, "chat", safe(() => exp.chat(task)));
      emit(ws, "bg", safe(() => pv.bgOf(task)));
      emit(ws, "bugs", safe(() => pv.bugsOf(task)));
      emit(ws, "evidence", safe(() => pv.evidenceOf(task)));   // screenshots and videos agents made; pushed only when the list changed   // the admin bug tracker (store/admin_issues.jsonl), pushed only when the file changed
      if (transcript) emit(ws, "transcript", safe(() => exp.transcript(task, transcript)));
      if (detail) emit(ws, "detail", safe(() => exp.agentDetail(task, detail)));
      if (s?.case) { if (!results.has(s.case)) results.set(s.case, await exp.caseResult(s.case).catch(() => null)); emit(ws, "result", results.get(s.case)); } else emit(ws, "result", null);
    }
  } catch (e) { console.error("hub tick:", (e as Error).message); } finally { running = false; }
}

export const websocket = {
  open(ws: Ws) { clients.add(ws); console.log(`[hub] client connected (${clients.size})`); timer ??= setInterval(() => void tick(), TICK_MS); void tick(true); },
  message(ws: Ws, raw: string | Buffer) {
    try {
      const m = JSON.parse(String(raw)) as { sub?: Sub; kick?: number };
      if (m.sub) { console.log("[hub] <- client now listens to", JSON.stringify(m.sub)); ws.data.sub = { task: m.sub.task || undefined, detail: m.sub.detail || undefined, transcript: m.sub.transcript || undefined, settings: !!m.sub.settings, usage: !!m.sub.usage, browser: !!m.sub.browser, prompttests: !!m.sub.prompttests, runs: !!m.sub.runs, runLog: m.sub.runLog || undefined, runCase: m.sub.runCase || undefined }; ws.data.sent.clear(); }
      void tick(true);
    } catch { /* ignore junk */ }
  },
  close(ws: Ws) { clients.delete(ws); console.log(`[hub] client left (${clients.size})`); if (!clients.size && timer) { clearInterval(timer); timer = undefined; } },
};
export const newClient = (): Client => ({ sub: {}, sent: new Map() });
