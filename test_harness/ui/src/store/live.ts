// The Experiment page's live data: ONE WebSocket (/api/ws), no polling. The server pushes a topic only when it changed.
// Actions (send, stop, delete ...) stay plain POSTs; call kick() after one so the result shows at once.
import { ref, shallowRef } from "vue";
import type { SettingsState, UsageState } from "../../shared/settings";
import type { PtLive } from "../../shared/prompttests";
import type { BrowserOverview } from "./api";
import type { BugsOut, EvidenceOut, Transcript, AgentDetail, CaseResultOut, ChatOut, ExperimentOverview, LiveSession } from "../../shared/experiment";

export interface BgInfo { scripts: AgentDetail["scripts"] }
export type Sub = { task?: string; detail?: string; transcript?: string; settings?: boolean; usage?: boolean; browser?: boolean; prompttests?: boolean };

const ov = shallowRef<ExperimentOverview | null>(null), sessions = shallowRef<LiveSession[]>([]), chat = shallowRef<ChatOut | null>(null),
  result = shallowRef<CaseResultOut | null>(null), bg = shallowRef<BgInfo | null>(null), bugs = shallowRef<BugsOut | null>(null), evidence = shallowRef<EvidenceOut | null>(null), detail = shallowRef<AgentDetail | { error: string } | null>(null), transcript = shallowRef<Transcript | { error: string } | null>(null),
  settings = shallowRef<SettingsState | null>(null), prompttests = shallowRef<PtLive | null>(null), usage = shallowRef<UsageState | null>(null), browser = shallowRef<BrowserOverview | null>(null),
  up = ref(false), ready = ref(false);   // ready: the first live list has arrived

let sock: WebSocket | undefined, sub: Sub = {}, always: Sub = {}, users = 0, retry = 0, wait: ReturnType<typeof setTimeout> | undefined;
const sink: Record<string, (d: never) => void> = {
  overview: (d) => (ov.value = d), live: (d) => { sessions.value = d; ready.value = true; }, chat: (d) => (chat.value = d),
  result: (d) => (result.value = d), bg: (d) => (bg.value = d), bugs: (d) => (bugs.value = d), evidence: (d) => (evidence.value = d), detail: (d) => (detail.value = d), transcript: (d) => (transcript.value = d),
  settings: (d) => (settings.value = d), prompttests: (d) => (prompttests.value = d), usage: (d) => (usage.value = d), browser: (d) => (browser.value = d),
};
// EVERY socket event is printed, so useless traffic is easy to spot: `[live] ← topic size (#count)` for what we receive, `[live] → ...` for what we send.
// live.stats() (also window.liveStats()) prints a table per topic: how many times, total bytes. A topic that arrives often with a big size is the one to look at.
const seenStat = new Map<string, { n: number; bytes: number }>();
const kb = (n: number) => (n < 1024 ? n + "B" : (n / 1024).toFixed(1) + "kB");
const stats = () => { console.table(Object.fromEntries([...seenStat].map(([t, v]) => [t, { events: v.n, total: kb(v.bytes), avg: kb(Math.round(v.bytes / v.n)) }]))); };
if (typeof window !== "undefined") (window as unknown as { liveStats: () => void }).liveStats = stats;
const tx = (m: object) => { if (sock?.readyState === WebSocket.OPEN) { const s = JSON.stringify(m); console.log("[live] → send", s); sock.send(s); } };

function connect() {
  if (sock || !users) return;
  const s = (sock = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`));
  s.onopen = () => { up.value = true; retry = 0; console.log("[live] socket open, listening to:", JSON.stringify(sub)); tx({ sub: { ...always, ...sub } }); };
  s.onmessage = (e) => {
    const m = JSON.parse(e.data) as { t: string; data: never }, bytes = String(e.data).length, st = seenStat.get(m.t) ?? { n: 0, bytes: 0 };
    st.n++; st.bytes += bytes; seenStat.set(m.t, st);
    console.log(`[live] ← ${m.t} ${kb(bytes)} (#${st.n})${sink[m.t] ? "" : "  UNHANDLED topic"}`);
    sink[m.t]?.(m.data);
  };
  s.onclose = () => { console.log("[live] socket closed"); up.value = false; sock = undefined; if (users) wait = setTimeout(connect, Math.min(10_000, 500 * 2 ** retry++)); };   // the API restarted: come back by itself
}

export function useLive() {
  return {
    ov, sessions, chat, result, bg, bugs, evidence, detail, transcript, settings, prompttests, usage, browser, up, ready,
    /** topics every page wants (the header's browser chip): merged into each watch() */
    always(next: Sub) { always = next; tx({ sub: { ...always, ...sub } }); },
    /** open the socket for as long as the page is mounted */
    start() { if (!users++) connect(); },
    stop() { if (!--users) { clearTimeout(wait); sock?.close(); sock = undefined; } },
    /** tell the server which session / agent this page looks at; the old session's data is dropped at once */
    watch(next: Sub) {
      if (next.task !== sub.task) { chat.value = null; result.value = null; bg.value = null; bugs.value = null; evidence.value = null; }
      if (next.detail !== sub.detail) detail.value = null;
      if (next.transcript !== sub.transcript || next.task !== sub.task) transcript.value = null;
      sub = next; tx({ sub: { ...always, ...sub } });
    },
    /** re-check now (after a POST) */
    kick: () => tx({ kick: 1 }),
    /** console table of what arrived so far, per topic */
    stats,
  };
}
