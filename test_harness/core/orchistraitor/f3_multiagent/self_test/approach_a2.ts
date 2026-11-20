// Offline check of approach 2 (free, no model call):  bun self_test/approach_a2.ts
// The adapter loads and is selectable; the hook answers a bad call with AGENT REFUSED and a good one through the real delegate path.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAgents } from "../harness/core/base.ts";
import { MStore } from "../harness/core/board.ts";
import { ensureRun } from "../harness/core/session_run.ts";
import { currentApproach } from "../approaches/index.ts";
import { overrides, resolve } from "../approaches/resolve.ts";
import { results, setSuite, t } from "./lib.ts";

setSuite("approach a2_native_hook");
const a2 = currentApproach("a2_native_hook");
t("a2.1", "a2 is selectable and says stock Agent tool = ok", a2.name === "a2_native_hook" && a2.capabilities.stock_lead_agent_tool === "ok");
t("a2.2", "a1 is still selectable", currentApproach("a1_team_cli").name === "a1_team_cli");
t("a2.3", "lead prompt resolves to the a2 file", resolve("prompts/lead.md", "a2_native_hook").layer === "approach");
t("a2.9", "a2_native_observe is selectable", currentApproach("a2_native_observe").name === "a2_native_observe");
t("a2.4", "no override is active by accident", overrides("a2_native_hook").length === 0);

const dir = mkdtempSync(join(tmpdir(), "a2-")), file = join(dir, "store.json"), store = new MStore(file), defs = loadAgents();
store.tx(() => ensureRun(store, { task_id: "t1", repo: dir, config: { maxDepth: 2, runner: "fake", locks: "store", strict: false, sessionCap: 60 } as never }));
const lead = store.agentsOf("t1").find((x) => x.name === "lead") ?? store.addAgent("t1", defs.get("lead")!, { level: 1, cwd: dir });
store.tx(() => { store.agent("t1", lead.agent_id)!.status = "running"; });
const hook = (tool_name: string, tool_input: object) => {
  const r = spawnSync("bun", ["--smol", join(import.meta.dir, "..", "approaches", "a2_native_hook", "hook.ts")], { input: JSON.stringify({ tool_name, tool_input }), encoding: "utf8",
    env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t1", HARNESS_AGENT: lead.agent_id, HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "2", HARNESS_RUNNER: "fake" } });
  try { return JSON.parse(r.stdout).hookSpecificOutput as { permissionDecision: string; permissionDecisionReason: string }; } catch { return { permissionDecision: "?", permissionDecisionReason: r.stdout + r.stderr }; }
};
const bad = hook("Agent", { subagent_type: "no-such-agent", prompt: "do it" });
t("a2.5", "unknown subagent_type -> deny with AGENT REFUSED naming the role", bad.permissionDecision === "deny" && /^AGENT REFUSED/.test(bad.permissionDecisionReason) && !/caller_not_live/.test(bad.permissionDecisionReason), bad.permissionDecisionReason);
const ok = hook("Agent", { subagent_type: "researcher", prompt: "Find the latest Bun version." });
t("a2.8", "a known role goes through the shared delegate path (AGENT RESULT or a core refusal, never a crash)", /^AGENT (RESULT|REFUSED)/.test(ok.permissionDecisionReason), ok.permissionDecisionReason.slice(0, 300));
const noType = hook("Agent", { prompt: "x" });
t("a2.6", "missing subagent_type -> AGENT REFUSED", /^AGENT REFUSED/.test(noType.permissionDecisionReason), noType.permissionDecisionReason);
const msg = hook("SendMessage", { to: "nobody#9", message: "hi" });
t("a2.7", "SendMessage to an unknown id -> AGENT REFUSED", /^AGENT REFUSED/.test(msg.permissionDecisionReason), msg.permissionDecisionReason);
// observe mode: real native tools, hooks only record
const obs = (o: object) => { const r = spawnSync("bun", ["--smol", join(import.meta.dir, "..", "approaches", "a2_native_hook", "hook.ts")], { input: JSON.stringify(o), encoding: "utf8",
  env: { ...process.env, A2_MODE: "observe", HARNESS_STORE: file, HARNESS_TASK: "t1", HARNESS_AGENT: lead.agent_id, HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "2" } }); return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason as string : "ALLOW"; };
const o1 = obs({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_use_id: "tu1", tool_input: { subagent_type: "planner", prompt: "plan it" } });
store.reload(); const call = store.calls.filter((c) => c.role === "planner").pop();
t("a2.10", "observe: a good Agent call is ALLOWED and recorded as a granted call", o1 === "ALLOW" && call?.status === "granted", o1);
obs({ hook_event_name: "PostToolUse", tool_name: "Agent", tool_use_id: "tu1", tool_input: {}, tool_response: { status: "async_launched", agentId: "abc123def" } });
store.reload(); t("a2.11a", "observe: an async launch keeps the call OPEN (granted)", store.calls.find((c) => c.id === call?.id)?.status === "granted");
obs({ hook_event_name: "SubagentStop", agent_id: "abc123def" });
store.reload(); const done = store.calls.find((c) => c.id === call?.id);
t("a2.11", "observe: PostToolUse closes the call and maps the native agentId", done?.status === "done" && store.agent("t1", done.callee_agent_id!)?.session_id === "abc123def");
const o2 = obs({ hook_event_name: "PreToolUse", tool_name: "SendMessage", tool_use_id: "tu2", tool_input: { to: "abc123def", message: "more" } });
store.reload(); t("a2.12", "observe: SendMessage to the native agentId resumes OUR agent row", o2 === "ALLOW" && store.calls.some((c) => c.role === "planner" && c.session_arg === done?.callee_agent_id), o2);
const o3 = obs({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_use_id: "tu3", tool_input: { subagent_type: "ghost-role", prompt: "x" } });
t("a2.13", "observe: an unknown role is refused by the shared policy", /^AGENT REFUSED/.test(o3), o3);
const bgr = hook("Agent", { subagent_type: "researcher", prompt: "Find the latest Node version.", run_in_background: true });
t("a2.14", "intercept: run_in_background starts the agent at once (AGENT STARTED + team wait hint)", /^AGENT STARTED/.test(bgr.permissionDecisionReason) && /team agent wait/.test(bgr.permissionDecisionReason), bgr.permissionDecisionReason);
// typed team commands (MCP server over harness/tools.ts)
import { TEAM_TOOLS, listed, toArgv } from "../approaches/a2_native_hook/team_mcp.ts";
t("a2.15", "team commands: delegate is NOT offered, wait/fork_all/plan_submit are", !TEAM_TOOLS.some((x) => x.name === "delegate") && ["wait", "fork_all", "plan_submit", "ls"].every((n) => TEAM_TOOLS.some((x) => x.name === n)));
const w = toArgv("wait", { agents: ["a#1", "b#2"], any: true, timeout: 30 }) as string[];
t("a2.16", "typed args -> flags (array joined, bare flag, number)", w.join(" ") === "wait --agents a#1,b#2 --any --timeout 30", w.join(" "));
const fa = toArgv("fork_all", { role: "builder", tasks: [{ title: "x", writes: ["run_test/p/a.js"], objective: "o" }] }) as string[];
t("a2.17", "objects become ONE JSON flag (no shell quoting involved)", fa[3] === "--tasks" && JSON.parse(fa[4]!)[0].title === "x", fa.join(" "));
t("a2.18a", "only the core tools are listed; the long tail is in team_tool's catalog", listed().length <= 16 && listed().every((x) => x.name !== "bg_start") && /bg_start\{/.test(listed().find((x) => x.name === "team_tool")!.description));
t("a2.18b", "a non-core command still works through team_tool", (toArgv("team_tool", { command: "bg_list", flags: { all: true } }) as string[]).join(" ") === "bg_list --all");
t("a2.18", "team_tool refuses delegate and internals", "error" in (toArgv("team_tool", { command: "delegate" }) as object) && "error" in (toArgv("team_tool", { command: "_run" }) as object));
{ // the real server over stdio: initialize, tools/list, one call
  const p = Bun.spawn(["bun", "--smol", join(import.meta.dir, "..", "approaches", "a2_native_hook", "team_mcp.ts")], { stdin: "pipe", stdout: "pipe", stderr: "ignore", env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t1", HARNESS_AGENT: lead.agent_id, HARNESS_CWD: dir } });
  const lines = (async () => { const out: any[] = []; const rd = p.stdout.getReader(); let b = ""; while (out.length < 3) { const { value, done } = await rd.read(); if (done) break; b += new TextDecoder().decode(value); let i; while ((i = b.indexOf("\n")) >= 0) { out.push(JSON.parse(b.slice(0, i))); b = b.slice(i + 1); } } return out; })();
  for (const m of [{ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 2, method: "tools/list" }, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "agents_list", arguments: {} } }]) p.stdin.write(JSON.stringify(m) + "\n");
  const got = await Promise.race([lines, new Promise<any[]>((r) => setTimeout(() => r([]), 20000))]); p.kill();
  t("a2.19", "MCP server: initialize + tools/list over stdio", got[0]?.result?.serverInfo?.name === "team" && got[1]?.result?.tools?.length === listed().length, JSON.stringify(got).slice(0, 200));
  t("a2.20", "MCP server: tools/call agents_list returns the store's JSON line", /lead#1/.test(got[2]?.result?.content?.[0]?.text ?? ""), JSON.stringify(got[2]).slice(0, 300));
}
// parallel builders: the WRITES: hint becomes the call's write paths; two builders with disjoint paths are both granted at once
const w1 = hook("Agent", { subagent_type: "builder", prompt: "Build screen A.\nWRITES: run_test/app/a.js, run_test/app/a.css", run_in_background: true });
const w2 = hook("Agent", { subagent_type: "builder", prompt: "Build screen B.\nWRITES: run_test/app/b.js", run_in_background: true });
store.reload(); const bcalls = store.calls.filter((c) => c.role === "builder");
t("a2.20x", "observe mode leaves no lock behind (a native writer must not block the next one)", store.locks.length === 0 || store.locks.every((l) => l.agent_id !== "planner#1"), JSON.stringify(store.locks));
t("a2.21", "WRITES: line -> the builder call carries exactly those paths", bcalls.some((c) => JSON.stringify(c.req?.writes) === JSON.stringify(["run_test/app/a.js", "run_test/app/a.css"])) && bcalls.some((c) => JSON.stringify(c.req?.writes) === JSON.stringify(["run_test/app/b.js"])), JSON.stringify(bcalls.map((c) => c.req?.writes)));
t("a2.22", "two background builders with disjoint WRITES both start at once (no queue)", /^AGENT STARTED/.test(w1.permissionDecisionReason) && /^AGENT STARTED/.test(w2.permissionDecisionReason) && !/queued/.test(w1.permissionDecisionReason + w2.permissionDecisionReason), w1.permissionDecisionReason + " | " + w2.permissionDecisionReason);
import { siblingsBlock } from "../harness/core/callee.ts";
store.reload(); const meB = bcalls[0]!.callee_agent_id!, sb = siblingsBlock(store, "t1", meB);
t("a2.23", "a builder is told who else is working, their files and how to message them", /OTHER AGENTS WORKING NOW/.test(sb) && /writes run_test\/app\/b\.js/.test(sb) && /team say --to/.test(sb) && !sb.includes(meB + " "), sb);
// ── the refactor: lite guard, the hook branches, and what each approach launches (free)
import { DEFAULT_GUARD, liteGuard } from "../harness/leadkit/guard.ts";
const G = { ...DEFAULT_GUARD, denyDelegateCommand: true }, gw = join(dir, "workspace");
const gv = (tool_name: string, tool_input: object) => liteGuard({ tool_name, tool_input }, G, { workspace: gw });
t("a2.30", "guard: .env, a key and a path outside the workspace are refused; run_test files and the sibling store are allowed",
  !gv("Read", { file_path: join(gw, ".env") }).allow && !gv("Read", { file_path: join(gw, "run_test/app/.env.local") }).allow && !gv("Read", { file_path: "/etc/passwd" }).allow && !gv("Read", { file_path: "../x/a.txt" }).allow
  && gv("Read", { file_path: join(gw, "run_test/app/index.html") }).allow && gv("Read", { file_path: join(dir, "store/qa/x.png") }).allow && gv("Glob", { pattern: "run_test/**/*.ts" }).allow && !gv("Glob", { pattern: "../**/*.ts" }).allow && !gv("Grep", { pattern: "k", path: "/home" }).allow);
t("a2.31", "guard: Bash cannot print .env or start an agent with `team agent <role>`; team wait/list/peek and plain team commands stay",
  !gv("Bash", { command: "cat run_test/app/.env" }).allow && !gv("Bash", { command: "team agent builder --objective x" }).allow && !gv("Bash", { command: "team delegate --role builder" }).allow
  && gv("Bash", { command: "team agent wait --agents builder#1" }).allow && gv("Bash", { command: "team agent list" }).allow && gv("Bash", { command: "team plan status --plan p1 --wait 30" }).allow && gv("Bash", { command: "ls ../store/qa" }).allow);
const hk = (o: object, env: Record<string, string> = {}) => spawnSync("bun", ["--smol", join(import.meta.dir, "..", "approaches", "a2_native_hook", "hook.ts")], { input: JSON.stringify(o), encoding: "utf8", env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t1", HARNESS_AGENT: lead.agent_id, HARNESS_CWD: gw, HARNESS_GUARD: JSON.stringify(G), ...env } }).stdout;
t("a2.32", "hook: a denied read is answered as a deny with the GUARD reason; an allowed one prints nothing", /"permissionDecision":"deny".*GUARD/.test(hk({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: join(gw, ".env") } })) && hk({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: join(gw, "run_test/a.js") } }).trim() === "");
store.tx(() => { store.notes.push({ id: "nx1", task_id: "t1", from: "user", to: lead.agent_id, text: "stop and tell me the status", refs: [], read_by: [], t: Date.now() } as never); });
const ups = hk({ hook_event_name: "UserPromptSubmit", prompt: "x" });
t("a2.33", "hook: UserPromptSubmit hands the person's unread message to the lead once", /UserPromptSubmit/.test(ups) && /stop and tell me the status/.test(ups) && hk({ hook_event_name: "UserPromptSubmit", prompt: "x" }).trim() === "");
const stopNone = hk({ hook_event_name: "Stop" });
store.reload(); const sub = store.agentsOf("t1").find((a) => a.caller_agent_id === lead.agent_id && a.status === "running");
t("a2.34", "hook: Stop lets the lead end when nothing runs; blocks once when a background agent runs; stop_hook_active ends the loop", stopNone.trim() === "" || !!sub);
if (sub) { t("a2.34b", "hook: Stop blocks with the agent ids", /"decision":"block"/.test(stopNone) && stopNone.includes(sub.agent_id)); t("a2.34c", "hook: Stop with stop_hook_active allows", hk({ hook_event_name: "Stop", stop_hook_active: true }).trim() === ""); }
import { currentApproach as ca } from "../approaches/index.ts";
import { teamCommands } from "../harness/leadkit/common.ts";
{ const d = loadAgents(), L1 = await ca("a1_team_cli").describeLaunch(d, { maxDepth: 2 }), L2 = await ca("a2_native_hook").describeLaunch(d, { maxDepth: 2 }), Lo = await ca("a2_native_observe").describeLaunch(d, { maxDepth: 2 });
  t("a2.35", "a1 keeps Bash(team *) and no Agent tool; a2 has Agent + SendMessage + the lead's own rules + Glob/Grep; no MCP yet", L1.allow.includes("Bash(team *)") && !L1.allow.includes("Agent") && L2.allow.includes("Agent") && L2.allow.includes("SendMessage") && L2.allow.includes("Bash(team *)") && !L2.allow.some((x) => /mcp__team/.test(x)) && !L2.extra({}).includes("--mcp-config"), JSON.stringify(L2.allow));
  t("a2.36", "a2 prompt: native tools + the same team command list as a1, without the `team agent <role>` line; a1 has that line", /team agent <role>/.test(L1.text + "") === false && /agent <role> --session/.test(L1.text) === false /* a1 shows it in the request, not the system prompt */ && !/agent <role> --session/.test(L2.text) && !/agent <role> --session/.test(teamCommands("team", "native")) && /team plan submit/.test(teamCommands("team", "native")) && /Agent types you may call/.test(L2.text));
  t("a2.37", "a2 settings: guard hook on Read|Glob|Grep|Bash|Agent with a 1800 s timeout, activity on every tool, UserPromptSubmit; no Stop; observe adds SubagentStop", (() => { const st = JSON.parse(L2.extra({})[1]!).hooks, so = JSON.parse(Lo.extra({})[1]!).hooks; return /Read\|Glob\|Grep\|Bash/.test(st.PreToolUse[0].matcher) && st.PreToolUse[0].hooks[0].timeout === 1800 && st.PostToolUse[0].matcher === "*" && !!st.UserPromptSubmit && !st.Stop && !!so.SubagentStop; })());
}
// ── STOP: a stop must end the whole chain (hook -> delegate -> callee) at once, so nothing keeps running or spending (free: the callee is a fake that would run 60 s)
{ const { spawnSync: ss } = await import("node:child_process");
  const ps = () => (ss("ps", ["-eo", "pid=,ppid=,args="], { encoding: "utf8" }).stdout ?? "").split("\n").map((l) => l.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).map((m) => ({ pid: +m![1]!, ppid: +m![2]!, args: m![3]! }));
  const tree = (root: number) => { const all = ps(), out = new Set([root]), todo = [root]; while (todo.length) { const id = todo.pop()!; for (const p of all) if (p.ppid === id && !out.has(p.pid)) { out.add(p.pid); todo.push(p.pid); } } return [...out]; };
  const child = Bun.spawn(["bun", "--smol", join(import.meta.dir, "..", "approaches", "a2_native_hook", "hook.ts")], { stdin: new Blob([JSON.stringify({ tool_name: "Agent", tool_input: { subagent_type: "researcher", prompt: "STOPTEST slow job" } })]), stdout: "pipe", stderr: "ignore",
    env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t1", HARNESS_AGENT: lead.agent_id, HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "2", HARNESS_RUNNER: "fake", HARNESS_FAKE_DELAY_MS: "60000" } });
  await Bun.sleep(3500);
  const before = tree(child.pid).length, t0 = Date.now();
  const { stopAgent } = await import("../harness/core/agent_call.ts");
  store.reload(); store.tx(() => { stopAgent(store, "t1", lead.agent_id); });   // the registry first (epoch bumped, calls failed), like the dashboard's stopSession
  for (const pid of tree(child.pid)) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }   // then the process tree under the lead's turn
  await Bun.sleep(500);
  const left = tree(child.pid).filter((p) => { try { process.kill(p, 0); return true; } catch { return false; } });
  t("a2.40", "stop: the hook, its `tools.ts delegate` and the callee are one process tree; killing it leaves nothing running, and the call row says stopped", before >= 2 && left.length === 0 && Date.now() - t0 < 3000 && store.calls.filter((c) => c.role === "researcher" && /STOPTEST/.test(String(c.req?.objective))).every((c) => c.status !== "granted"), `tree=${before} left=${left.length} calls=${JSON.stringify(store.calls.filter((c) => /STOPTEST/.test(String(c.req?.objective))).map((c) => c.status + "/" + c.reason))}`);
}
// ── MONITOR during a plain Agent call: an agent silent for 10 min is stopped by the harness while the hook waits (the lead is blocked and cannot run `wait`); the lead is told AGENT STOPPED
store.reload(); store.tx(() => { store.agent("t1", lead.agent_id)!.status = "running"; });   // the stop test above left the lead stopped
{ const h = Bun.spawn(["bun", "--smol", join(import.meta.dir, "..", "approaches", "a2_native_hook", "hook.ts")], { stdin: new Blob([JSON.stringify({ tool_name: "Agent", tool_input: { subagent_type: "researcher", prompt: "MONTEST slow job" } })]), stdout: "pipe", stderr: "ignore",
    env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t1", HARNESS_AGENT: lead.agent_id, HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "2", HARNESS_RUNNER: "fake", HARNESS_FAKE_DELAY_MS: "22000" } });
  await Bun.sleep(3000);
  store.reload(); const slow = store.calls.filter((c) => /MONTEST/.test(String(c.req?.objective))).map((c) => store.agent("t1", c.callee_agent_id!)).find(Boolean);
  if (slow) store.tx(() => { const a = store.agent("t1", slow.agent_id)!; a.started_at = Date.now() - 700_000; a.last_event_at = Date.now() - 700_000; });   // silent for 11 min
  const out = await new Response(h.stdout).text(); store.reload();
  t("a2.41", "monitor: during a plain foreground Agent call a 10-minute-silent agent is stopped by the harness (monitor.autostop) and the lead is told AGENT STOPPED", !!slow && store.events.some((e) => e.kind === "monitor.autostop" && e.agent_id === slow.agent_id) && /AGENT STOPPED/.test(out), JSON.stringify(store.events.filter((e) => /monitor|agent.stopped/.test(e.kind)).map((e) => e.kind + ":" + e.agent_id)) + " slow=" + JSON.stringify(slow?.agent_id) + " " + out.slice(0, 120));
}
writeFileSync(join(dir, ".done"), "");
const bad2 = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - bad2}/${results.length} passed`); process.exit(bad2 ? 1 : 0);
