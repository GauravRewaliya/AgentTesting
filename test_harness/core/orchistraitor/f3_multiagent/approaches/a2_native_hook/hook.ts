// A2 hook: PreToolUse on the stock `Agent` / `Task` / `SendMessage` tools of the lead. The call never reaches Claude's own sub-agent engine:
// it is turned into the shared core's delegate call (`bun harness/tools.ts delegate ...` = agentCall -> FixtureGate/runner -> store rows), and the reply
// goes back to the lead as the DENY reason of the tool call (the only way a hook can hand text back without running the tool).
// The lead's prompt (prompts/lead.md) says a message starting `AGENT RESULT` is the answer, not an error. Identity (HARNESS_STORE/TASK/AGENT ...) comes from the lead's environment.
// NOT_POSSIBLE: the exact output shape of the native Agent tool (agentId footer, usage block); `run_in_background` / parallel waits (every call blocks until answered).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MStore } from "../../harness/core/board.ts";
import { loadAgents } from "../../harness/core/base.ts";

const TOOLS = join(import.meta.dir, "..", "..", "harness", "tools.ts");
const say = (reason: string) => { console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } })); process.exit(0); };
const ev = JSON.parse(readFileSync(0, "utf8") || "{}") as { tool_name?: string; tool_input?: Record<string, unknown>; hook_event_name?: string };
const i = ev.tool_input ?? {}, file = process.env.HARNESS_STORE, task = process.env.HARNESS_TASK;
if (!file || !task) say("AGENT REFUSED: the harness environment is missing (HARNESS_STORE/TASK).");
if (process.env.A2_MODE === "observe") {   // the native tools run for real; we only record and may refuse (observe.ts)
  const { observe } = await import("./observe.ts"), r = observe(ev as never);
  if (r.deny) say(r.deny); process.exit(0);
}

let role = "", session = "new", text = "";
if (ev.tool_name === "SendMessage") {
  const to = String(i.to ?? ""), store = new MStore(file!), a = store.agentsOf(task!).find((x) => x.agent_id === to || x.name === to);
  if (!a) say(`AGENT REFUSED: no sub-agent "${to}" in this task. Use the agentId from an earlier result.`);
  role = a!.name; session = a!.agent_id; text = String(i.message ?? "");
} else { role = String(i.subagent_type ?? ""); text = String(i.prompt ?? ""); }
if (!role) say("AGENT REFUSED: subagent_type is missing. Use one of the listed agent types.");

// a native call has no `writes` field: a writer gets the project folder the hand-over names (the core also derives it), else run_test/ (the lock hook still guards the files)
const hint = /^\s*WRITES:\s*(.+)$/im.exec(text)?.[1]?.split(/[,\s]+/).map((x) => x.trim()).filter((x) => /^run_test\//.test(x)),   // the lead names the paths this builder owns, e.g. `WRITES: run_test/app/screens/a.js, run_test/app/screens/b.js`: two builders with different paths run IN PARALLEL (the lock hook only blocks a shared file)
  writes = hint?.length ? ["--writes", hint.join(",")] : loadAgents().get(role)?.writes && !/run_test\/[\w.-]+/.test(text) && !(session !== "new") ? ["--writes", "run_test"] : [];
const bg = i.run_in_background === true, model = ["sonnet", "haiku"].includes(String(i.model ?? "")) ? ["--model", String(i.model)] : [];   // native model aliases the core knows
const r = spawnSync("bun", ["--smol", TOOLS, "delegate", "--role", role, "--session", session, "--objective", text,
  "--output", "Your final answer: what you did, the files you wrote, what you could not do or check.", "--boundaries", "As written in the hand-over; nothing else.", ...(bg ? ["--async"] : []), ...model, ...writes],
  { env: process.env, encoding: "utf8", timeout: 1_800_000 });
const line = (r.stdout ?? "").trim().split("\n").filter(Boolean).pop() ?? "";
let j: { async?: boolean; queued?: boolean; ok?: boolean; reason?: string; summary?: string; error?: string; agent_id?: string; needs_parent?: string } = {};
try { j = JSON.parse(line); } catch { say(`AGENT REFUSED: the harness gave no answer (${(r.stderr ?? "").slice(0, 200) || "empty output"}).`); }
if (j.ok && (j.async || j.queued)) say(`AGENT STARTED in the background (agentId: ${j.agent_id}${j.queued ? ", queued: its files are locked by another agent, it starts by itself" : ""}). Keep working. Collect the answer with: team wait --agents ${j.agent_id} [--any]   (several agents: list all ids). Do NOT call it again.`);
if (j.ok === false && !j.summary) say(`AGENT REFUSED: ${j.reason ?? j.error ?? "the call was refused"}`);
say(`AGENT RESULT (final answer of ${role}; agentId: ${j.agent_id ?? "?"}; this call is FINISHED, nothing to wait for; to continue it use SendMessage{to:"${j.agent_id ?? ""}"}; independent calls can be started together with run_in_background:true):\n${j.summary ?? ""}${j.needs_parent ? `\nNEEDS_PARENT: ${j.needs_parent}` : ""}${j.error ? `\n[error: ${j.error}]` : ""}`);
