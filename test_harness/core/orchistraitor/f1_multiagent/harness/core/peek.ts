// LOOK INSIDE A RUNNING AGENT (read-only, free): what it did last, how long it has been silent, which files it holds, what it said. The lead / PM uses it to
// decide "stop it", "tell it something" or "wait" without spending a model call, and the slash command /peek prints the same.
import type { MStore } from "./board.ts";
import { spans } from "./base/trace.ts";

export interface Peek {
  ok: true; agent_id: string; role: string; title: string; status: string; activity: string; running_s: number | null; silent_s: number | null; tool_calls: number;
  stuck: boolean; hint: string; recent: { ago_s: number; tool: string; what: string }[]; writes: string[]; patches: string[]; notes: { ago_s: number; from: string; to: string; text: string }[];
  needs_parent?: string; cost_usd: number;
}
export const STUCK_AFTER_S = 180;
export function peekAgent(store: MStore, task: string, agentId: string, n = 8, now = Date.now()): Peek | { ok: false; reason: string } {
  const a = store.agent(task, agentId);
  if (!a) return { ok: false, reason: `agent_not_in_task: ${agentId}` };
  const mine = store.events.filter((e) => e.task_id === task && e.agent_id === a.agent_id);
  const tools = mine.filter((e) => e.kind === "tool.used");
  const started = a.status === "running" ? (a.started_at ?? mine.find((e) => e.kind.startsWith("agent."))?.t ?? null) : null;
  const silent = a.status === "running" && a.last_event_at ? Math.round((now - a.last_event_at) / 1000) : null;
  const stuck = silent !== null && silent > STUCK_AFTER_S;
  const hint = a.needs_parent ? "it is STOPPED and asks its parent a question: answer it (continue the same agent)"
    : stuck ? `no tool call for ${silent}s: it may be stuck. Send a note (say), or agent_stop and hand the rest to a fresh agent`
    : a.status === "running" ? "working normally: wait" : `not running (${a.status})`;
  const rep = store.reports.filter((r) => r.task_id === task && r.agent_id === a.agent_id);
  return { ok: true, agent_id: a.agent_id, role: a.role, title: a.title, status: a.status, activity: a.activity, running_s: started ? Math.round((now - started) / 1000) : null, silent_s: silent,
    tool_calls: tools.length, stuck, hint,
    recent: tools.slice(-n).map((e) => ({ ago_s: Math.round((now - e.t) / 1000), tool: String(e.data?.tool ?? "?"), what: String(e.data?.activity ?? "").slice(0, 90) })),
    writes: store.locks.filter((l) => l.task_id === task && l.agent_id === a.agent_id).map((l) => l.path),
    patches: store.patches.filter((p) => p.task_id === task && p.agent_id === a.agent_id).map((p) => `${p.id}:${p.state}:${p.files.length}f`),
    notes: store.notes.filter((x) => x.task_id === task && (x.from === a.agent_id || x.to === a.agent_id)).slice(-3).map((x) => ({ ago_s: Math.round((now - x.t) / 1000), from: x.from, to: x.to, text: x.text.slice(0, 120) })),
    needs_parent: a.needs_parent ?? undefined, cost_usd: Number(rep.reduce((s, r) => s + r.cost, 0).toFixed(4)) };
}
export const peekText = (p: Peek): string => [
  `${p.agent_id} [${p.role}] "${p.title}" ${p.status}${p.running_s !== null ? ` for ${p.running_s}s` : ""}${p.silent_s !== null ? `, silent ${p.silent_s}s` : ""}, ${p.tool_calls} tool calls, $${p.cost_usd}`,
  `  now: ${p.activity || "-"}`, ...p.recent.map((r) => `  -${String(r.ago_s).padStart(4)}s ${r.tool} ${r.what}`),
  ...(p.writes.length ? [`  holds: ${p.writes.join(", ")}`] : []), ...(p.patches.length ? [`  patches: ${p.patches.join(", ")}`] : []),
  ...p.notes.map((x) => `  note ${x.from}->${x.to} (${x.ago_s}s ago): ${x.text}`), `  => ${p.hint}`].join("\n");

/** How long a task was ACTIVE: the time at least one agent was working (parallel agents count once, gaps between turns do not count).
 *  A call still open counts up to now while its agent is running, else up to that agent's last event (it ended without writing back). */
export function activeMs(store: MStore, task: string, now = Date.now(), agent?: string): number {   // agent: only that agent's own work
  const sp = spans(store, task).filter((s) => !agent || s.agent_id === agent);
  const iv: [number, number][] = sp.map((s) => [s.start, s.start + Math.max(0, s.ms)]);
  const closed = new Map<string, number>();
  for (const s of sp) closed.set(s.agent_id, (closed.get(s.agent_id) ?? 0) + 1);
  const starts = new Map<string, number[]>();
  for (const e of store.events) if (e.task_id === task && e.kind === "agent.start" && e.agent_id && (!agent || e.agent_id === agent)) starts.set(e.agent_id, [...(starts.get(e.agent_id) ?? []), e.t]);
  for (const [id, ts] of starts) {   // starts after the closed ones are still open
    const a = store.agent(task, id), last = Math.max(...store.events.filter((e) => e.task_id === task && e.agent_id === id).map((e) => e.t));
    for (const t0 of ts.slice(closed.get(id) ?? 0)) iv.push([t0, a?.status === "running" ? now : Math.max(t0, last)]);
  }
  iv.sort((x, y) => x[0] - y[0]);
  let total = 0, cur: [number, number] | undefined;
  for (const [a, b] of iv) { if (!cur || a > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [a, b]; } else cur[1] = Math.max(cur[1], b); }
  return cur ? total + cur[1] - cur[0] : total;
}
