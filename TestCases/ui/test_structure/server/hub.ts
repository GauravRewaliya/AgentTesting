// WebSocket hub: the page opens ONE socket (/api/ws) and never polls. The files the runners write cannot notify us,
// so ONE server-side loop (not one per browser) re-reads them while at least one page is connected and pushes a topic only when its JSON changed.
// Client -> server: {sub:{task?,detail?,transcript?}} (what this page looks at) or {kick:1} (re-check now, e.g. after a POST).
// Server -> client: {t:"overview"|"live"|"chat"|"result"|"bg"|"detail"|"transcript", data}
import type { ServerWebSocket } from "bun";
import * as exp from "./experiment.ts";
import * as pv from "./preview.ts";

interface Sub { task?: string; detail?: string; transcript?: string }
export interface Client { sub: Sub; sent: Map<string, string> }
type Ws = ServerWebSocket<Client>;

const TICK_MS = Number(process.env.WS_TICK_MS) || 1500, OVERVIEW_EVERY = 4;   // the case list changes rarely: every 4th tick
const clients = new Set<Ws>();
let timer: ReturnType<typeof setInterval> | undefined, running = false, n = 0, ovCache: unknown = null;

function emit(ws: Ws, topic: string, data: unknown) {
  const s = JSON.stringify(data ?? null);
  if (ws.data.sent.get(topic) === s) return;
  ws.data.sent.set(topic, s); ws.send(`{"t":"${topic}","data":${s}}`);
  console.log(`[hub] -> push ${topic} ${s.length}B (${clients.size} client${clients.size === 1 ? "" : "s"})`);   // only real changes get here: an unchanged topic is skipped above
}
const safe = <T>(fn: () => T): T | { error: string } => { try { return fn(); } catch (e) { return { error: (e as Error).message }; } };

async function tick(force = false) {
  if (running || !clients.size) return; running = true;
  try {
    if (force || n++ % OVERVIEW_EVERY === 0) ovCache = await exp.overview();
    const lv = exp.live(), results = new Map<string, unknown>();
    for (const ws of clients) {
      const { task, detail, transcript } = ws.data.sub, s = task ? lv.find((x) => x.task === task) : undefined;
      emit(ws, "overview", ovCache); emit(ws, "live", lv);
      if (!task) continue;
      emit(ws, "chat", safe(() => exp.chat(task)));
      emit(ws, "bg", safe(() => pv.bgOf(task)));
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
      if (m.sub) { console.log("[hub] <- client now listens to", JSON.stringify(m.sub)); ws.data.sub = { task: m.sub.task || undefined, detail: m.sub.detail || undefined, transcript: m.sub.transcript || undefined }; ws.data.sent.clear(); }
      void tick(true);
    } catch { /* ignore junk */ }
  },
  close(ws: Ws) { clients.delete(ws); console.log(`[hub] client left (${clients.size})`); if (!clients.size && timer) { clearInterval(timer); timer = undefined; } },
};
export const newClient = (): Client => ({ sub: {}, sent: new Map() });
