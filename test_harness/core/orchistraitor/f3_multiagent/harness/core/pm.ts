// The Project Manager (plan 27.4): a persistent agent the USER talks to while the team works. It reads a live status digest, answers, and when the
// user changes the requirements it pauses, replans (the harness stops/continues/redoes the affected agents and tells everyone), and resumes.
// A message that arrives while it is busy is queued and read next. It has its own process slot, so it always answers even when the workers fill the machine.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { callAgent, levelOf, trace, type CallCtx, type CallOut } from "./base.ts";
import { MStore, inbox, say, type NoteRow } from "./board.ts";
import { ensureRun, touchRun } from "./session_run.ts";
import { phaseText } from "./phases.ts";

const HDIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const iso = (t?: number | null) => (t ? new Date(t).toISOString().slice(11, 19) : "-");

/** Keep a long block short: the PM sees this with every message, so its size is a token cost that must not grow with the team. */
const capLines = (s: string, max: number) => { const l = s.split("\n"); return l.length <= max ? s : [...l.slice(0, max), `  ... ${l.length - max} more lines (ask with agents_list / plan_show)`].join("\n"); };
export function planTable(store: MStore, task: string): string {
  return store.plans.filter((p) => p.task_id === task).map((p) => {
    const head = `PLAN ${p.plan_id} v${p.version ?? 1} status=${p.status}${p.paused ? " PAUSED" : ""} (${p.tasks.filter((t) => t.status === "done").length}/${p.tasks.length} done)`;
    const rows = p.tasks.map((t) => { const a = t.agent_id ? store.agent(task, t.agent_id) : undefined;
      return `  ${t.id.padEnd(8)} [${t.role}] ${t.status.padEnd(9)} ${(t.agent_id ?? "-").padEnd(13)} ${a ? `"${a.title}" ${a.activity}`.slice(0, 50) : ""} deps=[${(t.deps ?? []).join(",")}]${t.error ? " (" + t.error.slice(0, 50) + ")" : ""}${t.status === "blocked" && t.question ? `  << ASKS ITS PARENT: "${t.question.replace(/\s+/g, " ").slice(0, 100)}" (answer with plan_answer)` : ""}`; });
    const ph = phaseText(p), ch = (p.changes ?? []).slice(-3).map((c) => `  change ${c.summary} by ${c.by}: ${c.reason.slice(0, 80)}`);
    return [head, ...rows, ...(ph ? ["  phases:", ph] : []), ...ch].join("\n");
  }).join("\n");
}
export function chatLog(store: MStore, task: string): NoteRow[] { return store.notes.filter((n) => n.task_id === task && (n.from === "user" || n.to === "user")); }

/** What the PM sees with every message: the live team, the plan, and what went wrong lately. */
export function digest(store: MStore, task: string): string {
  const bad = store.events.filter((e) => e.task_id === task && levelOf(e.kind) !== "info").slice(-6)   // the same warn/error levels the live log uses
    .map((e) => `  ${iso(e.t)} ${e.kind} ${e.agent_id ?? ""} ${JSON.stringify(e.data ?? {}).slice(0, 90)}`);
  return [`TEAM (who, status, session, resumes, time, cost):`, capLines(trace.renderTree(store, task), 40) || "  (no agents yet)", capLines(planTable(store, task), 60) || "NO PLAN YET", bad.length ? "RECENT PROBLEMS:\n" + bad.join("\n") : "NO PROBLEMS REPORTED"].join("\n\n");
}
/** The user's own view: team tree with titles and descriptions, the plan, the conversation with the PM, the latest events. */
export function renderBoard(store: MStore, task: string): string {
  const agents = store.agentsOf(task).map((a) => `  ${a.agent_id.padEnd(13)} ${a.status.padEnd(8)} L${a.level} session=${(a.session_id ?? "-").slice(0, 8)} "${a.title}" - ${a.description.slice(0, 60)}${a.activity ? "  [" + a.activity.slice(0, 40) + "]" : ""}`);
  const chat = chatLog(store, task).slice(-12).map((n) => `  ${iso(n.t)} ${n.from === "user" ? "you" : "pm "}: ${n.text.replace(/\s+/g, " ").slice(0, 160)}`);
  const last = store.events.filter((e) => e.task_id === task).slice(-6).map((e) => `  ${iso(e.t)} ${e.kind.padEnd(18)} ${(e.agent_id ?? "").padEnd(12)} ${JSON.stringify(e.data ?? {}).slice(0, 70)}`);
  return [`== TEAM (task ${task}) ==`, trace.renderTree(store, task), "", "== AGENTS (title, description, session) ==", ...agents, "", "== PLAN ==", planTable(store, task) || "  none", "", "== CHAT WITH THE PROJECT MANAGER ==", ...(chat.length ? chat : ["  (nothing yet)"]), "", "== LATEST ==", ...last].join("\n");
}

/** After a reset a conversation partner must not start blank: the last messages of the chat, from the record. `except` = the message being answered now. */
export function conversationBlock(store: MStore, task: string, except?: string): string {
  const msgs = chatLog(store, task).filter((n) => n.text !== except).slice(-12);
  if (!msgs.length) return "";
  return "THE CONVERSATION SO FAR (your own memory of it was reset, so here it is from the record; build on it, do not start over):\n" + msgs.map((n) => (n.from === "user" ? "person: " : "you: ") + n.text.replace(/\s+/g, " ").slice(0, 400)).join("\n");
}

export interface ChatOpts { task_id: string; repo: string; text: string; maxDepth?: number; runner?: "real" | "fake"; env?: Record<string, string> }
export type ChatOut = { queued: true; reply: string } | (CallOut & { queued?: false });
export async function chatPM(ctx: CallCtx & { store: MStore }, o: ChatOpts): Promise<ChatOut> {
  const { store, defs } = ctx, def = defs.get("pm");
  if (!def) throw new Error("no pm agent definition");
  let row = store.agentsOf(o.task_id).find((a) => a.name === "pm");
  let busy = false;
  store.tx(() => {
    row = store.agentsOf(o.task_id).find((a) => a.name === "pm") ?? store.addAgent(o.task_id, def, { level: 1, type: "root", cwd: o.repo });
    ensureRun(store, { task_id: o.task_id, repo: o.repo, config: { maxDepth: o.maxDepth ?? 4, runner: o.runner ?? "real", locks: process.env.HARNESS_LOCKS_URL ? "redis" : "store", locks_url: process.env.HARNESS_LOCKS_URL, strict: store.strict, canary: process.env.HARNESS_CANARY === "1", sessionCap: ctx.sessionCap } });
    say(store, o.task_id, "user", row.agent_id, o.text);   // the user's words are on record at once, busy or not
    busy = row.status === "running";
  });
  if (busy) return { queued: true, reply: "The project manager is answering an earlier message. Yours is queued and will be read next." };
  const tools = `bun --smol ${join(HDIR, "tools.ts")}`, pm = row!;
  const prompt = (first: boolean) => {
    const msgs = store.tx(() => inbox(store, o.task_id, pm.agent_id)).filter((n) => n.from === "user");   // this message and any queued earlier
    return [`TASK ${o.task_id}${first ? "" : " (continuing)"}`, first ? conversationBlock(store, o.task_id, o.text) : "", "TEAM STATUS NOW:\n" + digest(store, o.task_id),
      `COMMANDS (Bash, one per call, each prints one line of JSON; use the plan id shown above):
  ${tools} plan_show --plan <id>            ${tools} plan_pause --plan <id>        ${tools} plan_resume --plan <id>
  ${tools} plan_replan --plan <id> --reason "<why>" --tasks '<JSON list of the tasks you want: {id,role,objective,output,boundaries,deps?,writes?}>'
  ${tools} agent_info --agent <id>          ${tools} agents_list                   ${tools} say --to <agent_id|all> --text "<fact>"
  ${tools} plan_answer --plan <id> --item <plan task id> --text "<answer>"      (a task shown as blocked: its agent stopped to ask its parent; the same agent continues)`,
      "THE USER SAYS:\n" + (msgs.length ? msgs.map((n) => `- ${n.text}`).join("\n") : o.text)].join("\n\n");
  };
  const env = { HARNESS_STORE: store.file ?? "", HARNESS_TASK: o.task_id, HARNESS_AGENT: pm.agent_id, HARNESS_CWD: o.repo, HARNESS_MAX_DEPTH: String(o.maxDepth ?? 4), HARNESS_RUNNER: o.runner ?? "real", ...(o.env ?? {}) };
  const out = await callAgent(ctx, pm, o.repo, prompt, undefined, { intent: "resume" }, { env });
  if (!out.ok && out.error === "agent_busy") return { queued: true, reply: "The project manager just started answering another message. Yours is queued and will be read next." };   // a race, not an error: nothing is written as its answer
  store.tx(() => { say(store, o.task_id, pm.agent_id, "user", out.ok ? out.reply : `(the project manager could not answer: ${out.error})`); });
  store.tx(() => touchRun(store, o.task_id));
  return out;
}
