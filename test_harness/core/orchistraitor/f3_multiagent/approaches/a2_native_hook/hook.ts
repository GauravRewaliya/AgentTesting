// THE a2 HOOK: one entry for every hook event of the lead (settings built in adapter.ts). Claude Code runs `bun hook.ts` and sends the event as JSON on stdin; one function per event:
//   PreToolUse  Read|Glob|Grep|Bash     the LITE GUARD (harness/leadkit/guard.ts): no .env / keys, stay in the workspace, no `team agent <role>` in a shell. Deny = the reason goes to the model.
//   PreToolUse  Agent|Task|SendMessage  intercept mode: the call never reaches Claude's own sub-agent engine. It becomes the shared core's `bun harness/tools.ts delegate ...` (agentCall -> FixtureGate/runner -> store rows)
//                                       and the reply goes back to the lead as the DENY reason (the only way a hook can hand text back without running the tool). prompts/lead.md says `AGENT RESULT` is the answer, not an error.
//                                       observe mode (A2_MODE=observe): the native tools run for real; observe.ts only records and may refuse.
//   PostToolUse (observe mode) / SubagentStop   observe.ts closes the call and maps the native agentId.
//   UserPromptSubmit                    unread notes (and the person's new messages) are added to the turn.
//   Stop                                OFF unless adapter.ts lists it: refuses ONE end of the turn while a background agent still runs (stop_hook_active stops a loop).
// Identity (HARNESS_STORE/TASK/AGENT/CWD, HARNESS_GUARD) comes from the lead's environment.
// NOT_POSSIBLE: the exact output shape of the native Agent tool (agentId footer, usage block); `run_in_background` / parallel waits (every call blocks until answered).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MStore, inbox, noteContext } from "../../harness/core/board.ts";
import { loadAgents } from "../../harness/core/base.ts";
import { DEFAULT_GUARD, liteGuard, type GuardPolicy } from "../../harness/leadkit/guard.ts";

const TOOLS = join(import.meta.dir, "..", "..", "harness", "tools.ts");
const send = (o: object): never => { console.log(JSON.stringify(o)); process.exit(0); };
const say = (reason: string): never => send({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
const ev = JSON.parse(readFileSync(0, "utf8") || "{}") as { tool_name?: string; tool_input?: Record<string, unknown>; hook_event_name?: string; stop_hook_active?: boolean };
const event = ev.hook_event_name ?? "PreToolUse", tool = ev.tool_name ?? "", i = ev.tool_input ?? {};
const { HARNESS_STORE: file, HARNESS_TASK: task, HARNESS_AGENT: agent } = process.env;
const observing = process.env.A2_MODE === "observe";

// ── UserPromptSubmit: unread notes before the turn
if (event === "UserPromptSubmit") {
  if (file && task && agent) {
    const st = new MStore(file), ctx = noteContext(st.tx(() => inbox(st, task, agent)));
    if (ctx) { const j = JSON.parse(ctx); j.hookSpecificOutput.hookEventName = "UserPromptSubmit"; send(j); }
  }
  process.exit(0);
}
// ── Stop: do not let the lead answer while its background agents still work (once)
if (event === "Stop") {
  if (ev.stop_hook_active || !file || !task || !agent) process.exit(0);
  const running = new MStore(file).agentsOf(task).filter((a) => a.caller_agent_id === agent && a.status === "running").map((a) => a.agent_id);
  if (running.length) send({ decision: "block", reason: `Background agents are still running: ${running.join(", ")}. Collect their answers first: team agent wait --agents ${running.join(",")}. Then answer the person.` });
  process.exit(0);
}
// ── observe mode: PostToolUse / SubagentStop (and the Agent calls) are recorded by observe.ts
if (observing && (event !== "PreToolUse" || /^(Agent|Task|SendMessage)$/.test(tool))) {
  if (!file || !task) say("AGENT REFUSED: the harness environment is missing (HARNESS_STORE/TASK).");
  const { observe } = await import("./observe.ts"), r = observe(ev as never);
  if (r.deny) say(r.deny); process.exit(0);
}
// ── PreToolUse: the lite guard for everything that reads or runs
if (/^(Read|Glob|Grep|Bash)$/.test(tool)) {
  let policy: GuardPolicy = DEFAULT_GUARD; try { policy = JSON.parse(process.env.HARNESS_GUARD ?? "") as GuardPolicy; } catch { /* the default policy */ }
  const v = liteGuard({ tool_name: tool, tool_input: i }, policy, { workspace: process.env.HARNESS_CWD ?? process.cwd() });
  if (!v.allow) {
    if (file && task && agent) { try { const st = new MStore(file); st.tx(() => st.ev("guard.denied", task, agent, { tool, reason: v.reason.slice(0, 160) })); } catch { /* a log line never blocks */ } }
    say(v.reason);
  }
  process.exit(0);
}
// ── PreToolUse Agent / Task / SendMessage (intercept): the shared delegate path
if (!file || !task) say("AGENT REFUSED: the harness environment is missing (HARNESS_STORE/TASK).");
let role = "", session = "new", text = "";
if (tool === "SendMessage") {
  const to = String(i.to ?? ""), store = new MStore(file!), a = store.agentsOf(task!).find((x) => x.agent_id === to || x.name === to);
  if (!a) say(`AGENT REFUSED: no sub-agent "${to}" in this task. Use the agentId from an earlier result.`);
  role = a!.name; session = a!.agent_id; text = String(i.message ?? "");
} else { role = String(i.subagent_type ?? ""); text = String(i.prompt ?? ""); }
if (!role) say("AGENT REFUSED: subagent_type is missing. Use one of the listed agent types.");

// a native call has no `writes` field: a writer gets the project folder the hand-over names (the core also derives it), else run_test/ (the lock hook still guards the files)
const hint = /^\s*WRITES:\s*(.+)$/im.exec(text)?.[1]?.split(/[,\s]+/).map((x) => x.trim()).filter((x) => /^run_test\//.test(x)),   // the lead names the paths this builder owns, e.g. `WRITES: run_test/app/screens/a.js, run_test/app/screens/b.js`: two builders with different paths run IN PARALLEL (the lock hook only blocks a shared file)
  writes = hint?.length ? ["--writes", hint.join(",")] : loadAgents().get(role)?.writes && !/run_test\/[\w.-]+/.test(text) && !(session !== "new") ? ["--writes", "run_test"] : [];
const bg = i.run_in_background === true, model = ["sonnet", "haiku"].includes(String(i.model ?? "")) ? ["--model", String(i.model)] : [];   // native model aliases the core knows
// the call runs in a child; while it blocks, THIS process plays the part of `team agent wait`: every 15 s one monitor tick (a nudge to an agent over 6 min, a stop for one silent 10 min; core/monitor.ts), so a plain Agent call is watched as well as a background one
const child = Bun.spawn(["bun", "--smol", TOOLS, "delegate", "--role", role, "--session", session, "--objective", text,
  "--output", "Your final answer: what you did, the files you wrote, what you could not do or check.", "--boundaries", "As written in the hand-over; nothing else.", ...(bg ? ["--async"] : []), ...model, ...writes], { env: process.env, stdout: "pipe", stderr: "pipe" });
const tick = setInterval(() => { try { spawnSync("bun", ["--smol", TOOLS, "_tick"], { env: process.env, timeout: 60_000 }); } catch { /* monitoring never breaks a call */ } }, 15_000);
const limit = setTimeout(() => child.kill("SIGKILL"), 1_800_000);
const [outText, errText] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]); clearInterval(tick); clearTimeout(limit);
const r = { stdout: outText, stderr: errText };
const line = (r.stdout ?? "").trim().split("\n").filter(Boolean).pop() ?? "";
let j: { async?: boolean; queued?: boolean; ok?: boolean; reason?: string; summary?: string; error?: string; agent_id?: string; needs_parent?: string } = {};
try { j = JSON.parse(line); } catch { say(`AGENT REFUSED: the harness gave no answer (${(r.stderr ?? "").slice(0, 200) || "empty output"}).`); }
if (j.ok && (j.async || j.queued)) say(`AGENT STARTED in the background (agentId: ${j.agent_id}${j.queued ? ", queued: its files are locked by another agent, it starts by itself" : ""}). Keep working. Collect the answer with: team agent wait --agents ${j.agent_id} [--any]   (several agents: list all ids). Do NOT call it again.`);
if (j.ok === false && /stopped/.test(j.error ?? j.reason ?? "")) say(`AGENT STOPPED (${role}): it was stopped, by the harness after a long silence or by the person. Its files are kept: look at them (team ls / read_file) before you start another agent for the same work.`);
if (j.ok === false && !j.summary) say(`AGENT REFUSED: ${j.reason ?? j.error ?? "the call was refused"}`);
say(`AGENT RESULT (final answer of ${role}; agentId: ${j.agent_id ?? "?"}; this call is FINISHED, nothing to wait for; to continue it use SendMessage{to:"${j.agent_id ?? ""}"}; independent calls can be started together with run_in_background:true):\n${j.summary ?? ""}${j.needs_parent ? `\nNEEDS_PARENT: ${j.needs_parent}` : ""}${j.error ? `\n[error: ${j.error}]` : ""}`);
