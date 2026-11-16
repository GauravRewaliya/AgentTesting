// A plain "status?" typed in the console is answered from the board, with NO model call. Why: resuming the lead for it re-reads its whole context (a cold cache after
// a pause re-bills ~60k tokens: $0.5 for a 6 s answer), and the board already knows everything the answer would say.
// Strict on purpose: only these exact short questions; anything longer ("status and continue", "why is x slow") still goes to the lead.
import type { MStore } from "./board.ts";
import { costOf } from "./agent_call.ts";

const ASKS = new Set(["status", "whats the status", "what is the status", "whats running", "what is running", "progress", "how is it going", "any update", "update", "where are we"]);
export const isStatusOnly = (text: string): boolean => ASKS.has(text.toLowerCase().replace(/['’]/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim());

const ago = (ms: number) => ms < 90_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60_000)} min`;
export function statusReply(store: MStore, task: string, now = Date.now()): string {
  store.reload();
  const all = store.agentsOf(task), lead = all.find((a) => a.name === "lead"), others = all.filter((a) => a.name !== "lead");
  const running = others.filter((a) => a.status === "running" || a.status === "stalled"), waiting = others.filter((a) => a.needs_parent);
  const lines = others.map((a) => {
    const evs = store.events.filter((e) => e.task_id === task && e.agent_id === a.agent_id && e.kind === "tool.used");
    const last = evs.length ? Math.round((now - Math.max(...evs.map((e) => e.t))) / 1000) : null;
    return `- ${a.agent_id}${a.title ? ` (${a.title})` : ""}: ${a.status}${a.activity ? `, ${a.activity}` : ""}${a.status === "running" && last !== null ? `, last tool ${last}s ago` : ""}${a.started_at && a.status === "running" ? `, running ${ago(now - a.started_at)}` : ""}`;
  });
  const head = !others.length ? "Nothing is running and no sub-agent has been started yet." : running.length ? `${running.length} agent(s) running, ${others.length - running.length} finished.` : `Nothing is running; ${others.length} agent(s) finished.`;
  return [head, ...lines, waiting.length ? `Waiting for your answer: ${waiting.map((a) => a.agent_id).join(", ")}.` : "", `Spent so far: $${(lead ? costOf(store, task, lead.agent_id) : 0).toFixed(2)}.`, "(Answered from the board, no model call. Ask in other words if you want the master to look deeper.)"].filter(Boolean).join("\n");
}
