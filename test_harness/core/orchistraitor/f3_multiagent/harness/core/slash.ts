// SLASH COMMANDS for the person at the console / chat (like Claude Code's /status): answered by the harness itself, NO model call, no credits.
//   /help  /status  /agents  /plan [id]  /phases [id]  /peek <agent> [n]  /cost  /bg  /pause [plan]  /resume [plan]  /stop <agent>  /say <agent|all> <text>
// Only KNOWN names are slash commands; anything else (a path like /mnt/x, "/api should ...") goes to the lead as normal text.
// Read-only commands read the store; the ones that change something run the same tools.ts command an agent would (one code path, same locks and rules).
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { trace } from "./base.ts";
import { MStore } from "./board.ts";
import { phaseText } from "./phases.ts";
import { peekAgent, peekText } from "./peek.ts";
import { planTable } from "./board_view.ts";

const TOOLS = join(dirname(fileURLToPath(import.meta.url)), "..", "tools.ts");
export const SLASH_COMMANDS: Record<string, string> = {
  help: "this list", status: "team, plan, phases and spend in one screen", agents: "every agent: status, what it does now", plan: "the plan table (/plan [id])", phases: "phase gates of a plan (/phases [id])",
  peek: "look inside a running agent (/peek <agent> [n])", cost: "spend so far and the budget left", bg: "background scripts and previews", pause: "stop NEW tasks of the plan starting (/pause [plan])",
  resume: "let the plan start tasks again (/resume [plan])", stop: "stop an agent and everything it called (/stop <agent>)", say: "send a note to an agent (/say <agent|all> <text>)",
};
/** The name of the slash command in `text`, or undefined when it is not one of ours. */
export const slashName = (text: string): string | undefined => { const m = /^\/([a-z]+)(?:\s|$)/.exec(text.trim()); return m && SLASH_COMMANDS[m[1]!] ? m[1] : undefined; };

export interface SlashCtx { store: MStore; task: string; storeFile: string; cwd: string; env?: Record<string, string> }
const money = (n: number) => `$${n.toFixed(4)}`;
export function spendOf(store: MStore, task: string) { return store.reports.filter((r) => r.task_id === task).reduce((s, r) => s + r.cost, 0); }
function tool(c: SlashCtx, args: string[]): string {
  const r = spawnSync("bun", ["--smol", TOOLS, ...args], { encoding: "utf8", env: { ...process.env, HARNESS_STORE: c.storeFile, HARNESS_TASK: c.task, HARNESS_AGENT: "user", HARNESS_CWD: c.cwd, HARNESS_RUNNER: process.env.HARNESS_RUNNER ?? "real", ...(c.env ?? {}) } });
  return (r.stdout.trim().split("\n").pop() ?? r.stderr.trim()).slice(0, 600);
}
const planOf = (c: SlashCtx, id?: string) => { const ps = c.store.plans.filter((p) => p.task_id === c.task); return id ? ps.find((p) => p.plan_id === id) : ps[ps.length - 1]; };

/** Run one slash command; returns the reply text. Call only when slashName(text) is defined. */
export function runSlash(c: SlashCtx, text: string): string {
  const [head, ...args] = text.trim().split(/\s+/), name = head!.slice(1), s = c.store; s.reload();
  const budget = Number(process.env.HARNESS_PROJECT_BUDGET_USD ?? 0);
  switch (name) {
    case "help": return "Slash commands (free, no model call):\n" + Object.entries(SLASH_COMMANDS).map(([k, v]) => `  /${k.padEnd(7)} ${v}`).join("\n");
    case "agents": return s.agentsOf(c.task).map((a) => `  ${a.agent_id.padEnd(14)} ${a.status.padEnd(8)} "${a.title}"${a.activity ? "  [" + a.activity.slice(0, 50) + "]" : ""}${a.needs_parent ? "  ASKS YOU: " + a.needs_parent.slice(0, 80) : ""}`).join("\n") || "no agents yet";
    case "plan": return planTable(s, c.task) || "no plan yet";
    case "phases": { const p = planOf(c, args[0]); return p ? `plan ${p.plan_id}:\n` + (phaseText(p) || "  this plan has no phases (tasks without a phase are not gated)") : "no such plan"; }
    case "peek": { if (!args[0]) return "usage: /peek <agent_id> [n]"; const r = peekAgent(s, c.task, args[0], Number(args[1] ?? 8)); return r.ok ? peekText(r) : r.reason; }
    case "cost": { const t = spendOf(s, c.task); return `spent ${money(t)}${budget ? ` of ${money(budget)} (left ${money(Math.max(0, budget - t))})` : " (no project budget set: HARNESS_PROJECT_BUDGET_USD)"}`; }
    case "bg": return tool(c, ["bg_list", "--all"]);
    case "status": {
      const bad = s.events.filter((e) => e.task_id === c.task && /failed|stalled|refused|violation/.test(e.kind)).slice(-3).map((e) => `  ! ${e.kind} ${e.agent_id ?? ""}`);
      return [trace.renderTree(s, c.task) || "no agents yet", planTable(s, c.task), runSlash(c, "/cost"), ...bad].filter(Boolean).join("\n");
    }
    case "pause": case "resume": { const p = planOf(c, args[0]); return p ? tool(c, [`plan_${name}`, "--plan", p.plan_id]) : "no plan to " + name; }
    case "stop": return args[0] ? tool(c, ["agent_stop", "--agent", args[0]]) : "usage: /stop <agent_id>";
    case "say": return args.length < 2 ? "usage: /say <agent_id|all> <text>" : tool(c, ["say", "--to", args[0]!, "--text", args.slice(1).join(" ")]);
  }
  return "unknown command, try /help";
}
