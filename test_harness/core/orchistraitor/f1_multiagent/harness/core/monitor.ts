// MONITOR (free, no model call): which running sub-agents need the lead's attention, and what to do about each. The lead sees this in the output of `wait` and
// `plan_status` (its waits last 4 minutes and end early on any event that needs it, so it wakes up on its own without polling), and the harness itself sends ONE automatic status nudge to an agent that has
// run over 6 minutes. Born from pp_eiffel: a builder had answered but the CLI never exited; the lead sat in `wait`, nudged late, stopped late and started a
// replacement for finished work, and nobody recorded it. Everything here reads what the harness already records (agent rows and `tool.used` events).
import type { MStore } from "./board.ts";

export const SLOW_AFTER_S = 360;   // running longer than this: look at what it is doing
export const SILENT_AFTER_S = 120; // no tool call for this long: it may be stuck or thinking very long
export const STALLED_AFTER_S = 300; // no tool call for this long: stuck, act
export const AUTOSTOP_AFTER_S = 600; // no tool call for 10 min and nobody acted: the harness stops it itself (backstop; a single Bash call can not legitimately run that long)
export const MIN_WAIT_S = 240; // a wait the lead asks for (30 s or more) lasts at least this long: it returns EARLY when something needs it, so it never has to poll every 90 s (each poll is a paid model turn)
export interface Attention { agent_id: string; role: string; title?: string; level: "asks" | "stalled" | "silent" | "slow"; running_s: number | null; last_tool_s_ago: number | null; tool_calls: number; do: string }

export function attention(store: MStore, task: string, only?: string[], now = Date.now()): Attention[] {
  const out: Attention[] = [];
  for (const a of store.agentsOf(task)) {
    if (a.name === "lead" || (only && !only.includes(a.agent_id))) continue;
    if (a.needs_parent && a.status !== "running") { out.push({ agent_id: a.agent_id, role: a.role, title: a.title, level: "asks", running_s: null, last_tool_s_ago: null, tool_calls: 0, do: `${a.agent_id} is STOPPED and asks you: "${String(a.needs_parent).slice(0, 160)}". Answer by continuing it (delegate --session ${a.agent_id}).` }); continue; }
    if (a.status !== "running" && a.status !== "stalled") continue;
    const ts = store.events.filter((e) => e.task_id === task && e.agent_id === a.agent_id && e.kind === "tool.used" && e.t >= (a.started_at ?? 0)).map((e) => e.t);
    const running = a.started_at ? Math.round((now - a.started_at) / 1000) : null, since = ts.length ? Math.round((now - Math.max(...ts)) / 1000) : (running ?? 0);
    const base = { agent_id: a.agent_id, role: a.role, title: a.title, running_s: running, last_tool_s_ago: since, tool_calls: ts.length };
    const report = `Report it: report_issue_to_admin --agent ${a.agent_id} --kind <kind> --text "<what you saw, what you did>".`;
    if (since >= STALLED_AFTER_S) out.push({ ...base, level: "stalled", do: `No tool call for ${since}s: stuck, or it answered and the process hangs (the harness frees that case itself after 45 s of silence). Look once with agent_peek. If it is stuck: agent_stop, then CHECK its files yourself (read_file, proto_check, a check) before you start any replacement: it may already be complete. ${report}` });
    else if (since >= SILENT_AFTER_S) out.push({ ...base, level: "silent", do: `No tool call for ${since}s. Look with agent_peek; if it stays silent for 5 minutes, stop it and verify its files yourself first.` });
    else if (running !== null && running >= SLOW_AFTER_S) out.push({ ...base, level: "slow", do: `Running ${Math.round(running / 60)} min but still working (${ts.length} tool calls, last ${since}s ago). Look once with agent_peek to see WHAT it does: keep waiting unless it repeats the same step; say what you saw in your answer.` });
  }
  return out;
}

/** Agents that crossed SLOW_AFTER_S and were not nudged yet for THIS call (keyed by started_at). The caller sends the nudge and records `monitor.nudge`. */
export function dueNudges(store: MStore, task: string, now = Date.now()): { agent_id: string; started_at: number; running_s: number }[] {
  const out: { agent_id: string; started_at: number; running_s: number }[] = [];
  for (const a of store.agentsOf(task)) {
    if (a.name === "lead" || a.status !== "running" || !a.started_at) continue;
    const running = Math.round((now - a.started_at) / 1000);
    if (running < SLOW_AFTER_S) continue;
    if (store.events.some((e) => e.kind === "monitor.nudge" && e.task_id === task && e.agent_id === a.agent_id && (e.data as { started_at?: number } | undefined)?.started_at === a.started_at)) continue;
    out.push({ agent_id: a.agent_id, started_at: a.started_at, running_s: running });
  }
  return out;
}
export const nudgeText = (running_s: number) => `Status check from the harness: you have been running ${Math.round(running_s / 60)} minutes. When you finish your current step, write your progress in one line. If you are done, report now. If you are blocked, reply NEEDS_PARENT: <what you need>.`;

/** Agents silent for AUTOSTOP_AFTER_S (no tool call since they started or since the last one) that the lead has not dealt with: the harness stops and reports them. */
export function dueAutoStops(store: MStore, task: string, now = Date.now()): { agent_id: string; silent_s: number; running_s: number }[] {
  const out: { agent_id: string; silent_s: number; running_s: number }[] = [];
  for (const a of store.agentsOf(task)) {
    if (a.name === "lead" || a.status !== "running" || !a.started_at) continue;
    const ts = store.events.filter((e) => e.task_id === task && e.agent_id === a.agent_id && e.kind === "tool.used" && e.t >= a.started_at!).map((e) => e.t);
    const silent = Math.round((now - (ts.length ? Math.max(...ts) : a.started_at)) / 1000);
    if (silent >= AUTOSTOP_AFTER_S) out.push({ agent_id: a.agent_id, silent_s: silent, running_s: Math.round((now - a.started_at) / 1000) });
  }
  return out;
}
/** A requested wait of 30 s or more is stretched to MIN_WAIT_S (it ends early on any event that needs the lead); a short one (a quick look) is kept. */
export const waitSeconds = (asked: number) => (asked >= 30 ? Math.max(asked, MIN_WAIT_S) : asked);
