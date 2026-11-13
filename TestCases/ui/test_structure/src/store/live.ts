// The Experiment page's live data: ONE WebSocket (/api/ws), no polling. The server pushes a topic only when it changed.
// Actions (send, stop, delete ...) stay plain POSTs; call kick() after one so the result shows at once.
import { ref, shallowRef } from "vue";
import type { AgentDetail, CaseResultOut, ChatOut, ExperimentOverview, LiveSession } from "../../shared/experiment";

export interface BgInfo { scripts: AgentDetail["scripts"] }
export type Sub = { task?: string; detail?: string };

const ov = shallowRef<ExperimentOverview | null>(null), sessions = shallowRef<LiveSession[]>([]), chat = shallowRef<ChatOut | null>(null),
  result = shallowRef<CaseResultOut | null>(null), bg = shallowRef<BgInfo | null>(null), detail = shallowRef<AgentDetail | { error: string } | null>(null),
  up = ref(false), ready = ref(false);   // ready: the first live list has arrived

let sock: WebSocket | undefined, sub: Sub = {}, users = 0, retry = 0, wait: ReturnType<typeof setTimeout> | undefined;
const sink: Record<string, (d: never) => void> = {
  overview: (d) => (ov.value = d), live: (d) => { sessions.value = d; ready.value = true; }, chat: (d) => (chat.value = d),
  result: (d) => (result.value = d), bg: (d) => (bg.value = d), detail: (d) => (detail.value = d),
};
const tx = (m: object) => { if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify(m)); };

function connect() {
  if (sock || !users) return;
  const s = (sock = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`));
  s.onopen = () => { up.value = true; retry = 0; tx({ sub }); };
  s.onmessage = (e) => { const m = JSON.parse(e.data) as { t: string; data: never }; sink[m.t]?.(m.data); };
  s.onclose = () => { up.value = false; sock = undefined; if (users) wait = setTimeout(connect, Math.min(10_000, 500 * 2 ** retry++)); };   // the API restarted: come back by itself
}

export function useLive() {
  return {
    ov, sessions, chat, result, bg, detail, up, ready,
    /** open the socket for as long as the page is mounted */
    start() { if (!users++) connect(); },
    stop() { if (!--users) { clearTimeout(wait); sock?.close(); sock = undefined; } },
    /** tell the server which session / agent this page looks at; the old session's data is dropped at once */
    watch(next: Sub) {
      if (next.task !== sub.task) { chat.value = null; result.value = null; bg.value = null; }
      if (next.detail !== sub.detail) detail.value = null;
      sub = next; tx({ sub });
    },
    /** re-check now (after a POST) */
    kick: () => tx({ kick: 1 }),
  };
}
