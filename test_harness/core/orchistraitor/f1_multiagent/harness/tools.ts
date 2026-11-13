// The agents' tools as one command (plan 5.2 / 23.3):
//   bun tools.ts <delegate|wait|apply_patches|agents_list|agent_update|say|inbox|board_status|ledger_get|agent_stop|ls|read_file|grep|qa_check|proto_check|qa_give_up|preview|preview_list|preview_stop|preview_restart|bg_start|bg_list|bg_log|bg_stop|proc_list|proc_stop> --flag value ...
//   ls / read_file / grep = READ-ONLY look at the shared workspace run_test/ (core/workspace_read.ts): the lead can check a result itself instead of asking a sub-agent to run commands.
// A stand-in for the mod's registered tools: same rules (agent.call), same registry, one line of JSON out.
// Identity comes from the environment set for THIS agent: HARNESS_STORE, HARNESS_TASK, HARNESS_AGENT, HARNESS_CWD, HARNESS_MAX_DEPTH, HARNESS_RUNNER.
// `delegate --async` returns at once and runs the callee in a detached process (`_run`), so one agent can start several callees in parallel and `wait` for them.
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { agentCall, defaultPolicy, stopAgent, type CallReq, type CallRes } from "./core/agent_call.ts";
import { DockerRunner } from "./core/base/docker_runner.ts";
import { loadAgents, RealRunner, ScriptRunner, transcriptExistsAnywhere, type Runner } from "./core/base.ts";
import { MStore, boardStatus, inbox, say, sessionStats } from "./core/board.ts";
import { SESSION_CAP } from "./core/session_run.ts";
import { runCallee } from "./core/callee.ts";
import { hookArgs } from "./core/hooks_settings.ts";
import { launchDef } from "./core/launch.ts";
import { release } from "./core/locks.ts";
import { applyQueue } from "./core/patches.ts";
import { depsBlock, replan, validatePlan, type PlanRow, type PlanTask } from "./core/plan.ts";
import { locksFromEnv } from "./core/lockapi.ts";
import { customDef } from "./core/custom.ts";
import { FixtureGate } from "./core/fixture_gate.ts";
import { wsGrep, wsLs, wsRead } from "./core/workspace_read.ts";
import { existsSync, readFileSync } from "node:fs";
import { MAX_SAME, giveUp, qaFailed, readQa, recordCheck, writeQa } from "./core/qa_loop.ts";
import { recordDevServer } from "../../../../infra/qa/web_dev_qa.ts";

const MAX_WAVE = 4;
const HDIR = dirname(fileURLToPath(import.meta.url)), TOOLS = `bun ${join(HDIR, "tools.ts")}`;
const [cmd, ...rest] = process.argv.slice(2);
const flag = (k: string) => { const i = rest.indexOf("--" + k); return i >= 0 ? rest[i + 1] : undefined; };
const E = process.env, file = E.HARNESS_STORE!, task = flag("task") ?? E.HARNESS_TASK!, me = E.HARNESS_AGENT ?? "";
const out = (o: unknown) => console.log(JSON.stringify(o));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
if (!file || !task) { out({ ok: false, reason: "tool environment missing (HARNESS_STORE/TASK)" }); process.exit(0); }

const store = new MStore(file), defs = loadAgents(join(HDIR, "agents"));
// per-agent model: HARNESS_MODELS='{"researcher":"sonnet"}' overrides agent.json for this launch
for (const [n, m] of Object.entries(JSON.parse(E.HARNESS_MODELS ?? "{}") as Record<string, string>)) { const d = defs.get(n); if (d) d.model = m; }
{ const only = E.HARNESS_LEAD_AGENTS, ld = defs.get("lead"); if (only !== undefined && ld) ld.agents = only.split(",").filter(Boolean); }   // a test case decides which agents its lead has
const locks = locksFromEnv(store);
const policy = defaultPolicy({ agentMaxDepth: Number(E.HARNESS_MAX_DEPTH ?? 1), maxInstancesPerRole: Number(E.HARNESS_MAX_INSTANCES ?? 4), externalLocks: locks.kind === "redis", lockTtlMs: Number(E.HARNESS_LOCK_TTL_MS ?? 120_000) });
const cwd = E.HARNESS_CWD ?? process.cwd();

function spawnRun(call_id: string) {   // a detached process runs the callee; it survives the Bash call that started it
  spawn("bun", ["--smol", join(HDIR, "tools.ts"), "_run", "--call", call_id], { detached: true, stdio: "ignore", env: process.env }).unref();
}
/** Run one granted call (read from the registry, so a detached process can do it) and start any writer whose locks just freed. */
async function runCall(call_id: string) {
  store.reload();
  const call = store.calls.find((x) => x.id === call_id);
  if (!call?.req) throw new Error(`no such call ${call_id}`);
  const req = call.req as unknown as CallReq, agent = store.agent(call.task_id, call.callee_agent_id!)!, s = call.session_arg;
  const kind = s === "new" ? "new" : s.startsWith("fork:") ? "fork" : "resume";
  const res: Extract<CallRes, { ok: true }> = { ok: true, call_id, agent, level: call.level, kind, forkFrom: kind === "fork" ? store.agent(call.task_id, s.slice(5)) : undefined };
  const real = E.HARNESS_RUNNER === "real";
  const inner: Runner = real ? (E.HARNESS_SANDBOX === "docker" ? new DockerRunner(600_000) : new RealRunner(600_000)) : new ScriptRunner(async (c) => { await sleep(Number(E.HARNESS_FAKE_DELAY_MS ?? 0)); if (c.prompt.includes("FAILME")) throw new Error("fake failure"); if (c.prompt.includes("ASKPARENT") && !c.prompt.includes("ANSWER FROM YOUR PARENT")) return "NEEDS_PARENT: which address should I use? I read the brief and found two."; return `FAKE REPLY from ${c.row.agent_id}: ${req.objective?.slice(0, 60)}`; });
  const runner: Runner = new FixtureGate(inner, () => store);   // agents with "fixtures": true are answered by recorded results (check_and_correction); every other agent runs as before
  if (!defs.has(req.role)) defs.set(req.role, customDef(req.role, req.title ?? req.role, !!req.writes?.length));   // a custom agent: rebuilt here from the call record
  const def = launchDef(defs.get(req.role)!, defs, res.level, policy.agentMaxDepth, join(tmpdir(), "lf-launch"), TOOLS);
  const epoch0 = agent.epoch ?? 0;
  const guard = setInterval(() => { store.reload(); if (store.aborted() || (store.agent(call.task_id, call.callee_agent_id!)?.epoch ?? 0) !== epoch0) runner.killAll?.(); }, 1000);   // the watchdog flag, or a stop (replan / cancel), ends this callee at once
  const r = await runCallee({ store, runner, defs: new Map(defs).set(req.role, def), sessionCap: SESSION_CAP, transcriptExists: real ? (_c, id) => transcriptExistsAnywhere(id) : undefined }, policy, res, req, def,
    { locks: locks.kind === "redis" ? locks : undefined, cwd, writerMode: E.HARNESS_WRITER_MODE === "worktree" ? "worktree" : "shared",
      env: { HARNESS_STORE: file, HARNESS_MAX_DEPTH: String(policy.agentMaxDepth), HARNESS_RUNNER: E.HARNESS_RUNNER ?? "fake", HARNESS_MODELS: E.HARNESS_MODELS ?? "{}",
        HARNESS_WRITER_MODE: E.HARNESS_WRITER_MODE ?? "shared", HARNESS_MAX_INSTANCES: E.HARNESS_MAX_INSTANCES ?? "4", HARNESS_FAKE_DELAY_MS: E.HARNESS_FAKE_DELAY_MS ?? "0", HARNESS_LOCKS_URL: E.HARNESS_LOCKS_URL ?? "", HARNESS_LOCKS_PREFIX: E.HARNESS_LOCKS_PREFIX ?? "lf", HARNESS_LOCK_TTL_MS: E.HARNESS_LOCK_TTL_MS ?? "120000", HARNESS_STRICT: E.HARNESS_STRICT ?? "0", HARNESS_CANARY: E.HARNESS_CANARY ?? "0" },
      extraArgs: () => (real ? hookArgs(HDIR) : []) });
  clearInterval(guard);
  for (const pc of r.promoted) spawnRun(pc);   // the queue driver: a finished writer starts the next waiting one
  return { res, r };
}
/** Put finished writers' files into the project. Runs under the @git lock, so it never collides with an agent running git. */
async function applyPatchesCmd(): Promise<{ applied: number; rejected: unknown[]; committed: boolean; blocked?: string }> {
  const call = "apply_" + Date.now();
  let blocked = "";
  { const a = await locks.acquire({ task_id: task, agent_id: me || "scheduler", call_id: call, paths: ["@git"], ttlMs: 60_000 }); if (!a.ok) { blocked = a.heldBy.join(","); await locks.release(task, call, 60_000); } }
  if (blocked) { const o = { ok: false, blocked, reason: `@git is held by ${blocked}; try again when it finishes` }; if (cmd === "apply_patches") out(o); return { applied: 0, rejected: [], committed: false, blocked }; }
  let r!: ReturnType<typeof applyQueue>, committed = false;
  try {
    store.tx(() => { r = applyQueue(store, cwd, task); });
    const g = (a: string[]) => spawnSync("git", ["-C", cwd, "-c", "user.name=harness", "-c", "user.email=harness@local", ...a], { encoding: "utf8" });
    g(["add", "-A"]); committed = g(["commit", "-qm", "apply agent patches"]).status === 0;
  } finally { await locks.release(task, call, 60_000); }
  if (cmd === "apply_patches") out({ ok: true, applied: r.applied.length, rejected: r.rejected, committed });
  return { applied: r.applied.length, rejected: r.rejected, committed };
}
/** The live plan scheduler: every tick it re-reads the plan (so a replan or a pause by the project manager takes effect at once), collects finished tasks,
 *  skips tasks whose inputs can no longer arrive, and starts every ready task (at most MAX_WAVE at a time) with the answers of its dependencies. */
async function execPlan(plan_id: string) {
  const cur = () => store.plans.find((x) => x.task_id === task && x.plan_id === plan_id)!;
  const finishWith = (status: PlanRow["status"]) => store.tx(() => { cur().status = status; store.ev("plan.end", task, cur().owner, { plan_id, status }); });
  const t0 = Date.now();
  for (;;) {
    store.reload();
    if (store.aborted()) { finishWith("aborted"); return; }
    store.tx(() => {
      const p = cur();
      for (const t of p.tasks) if (t.status === "running") {   // 1. collect what finished
        const c = store.calls.find((x) => x.id === t.call_id);
        if (c?.status === "done") { const ag = store.agent(task, t.agent_id!); t.report_id = lastReport(t.agent_id!)?.id; if (ag?.needs_parent) { t.status = "blocked"; t.question = ag.needs_parent; store.ev("plan.task_blocked", task, t.agent_id, { task: t.id }); } else t.status = "done"; } else if (c?.status === "failed") { t.status = "failed"; t.error = c.reason ?? "failed"; }
      }
      for (const t of p.tasks) if (t.status === "pending") {   // 2. nothing will ever arrive for these
        const bad = (t.deps ?? []).find((d) => ["failed", "skipped", "cancelled"].includes(p.tasks.find((x) => x.id === d)?.status ?? ""));
        if (bad) { t.status = "skipped"; t.error = `dependency ${bad} did not finish`; }
      }
    });
    const p = cur();
    if (!p.paused) {   // 3. start what is ready
      const room = Math.max(0, MAX_WAVE - p.tasks.filter((t) => t.status === "running").length);
      const ready = p.tasks.filter((t) => t.status === "pending" && (t.deps ?? []).every((d) => p.tasks.find((x) => x.id === d)?.status === "done")).slice(0, room);
      for (const t of ready) {
        const req: CallReq = { task_id: task, caller_agent_id: p.owner, role: t.role, session_arg: t.session ?? "new", objective: (t.note ? t.note + "\n\n" : "") + t.objective + depsBlock(store, p, t), output: t.output, boundaries: t.boundaries, writes: t.writes, onBehalf: true };
        const res = await grant(req, true);
        store.tx(() => { const tt = cur().tasks.find((x) => x.id === t.id)!; if (!res.ok) { tt.status = "failed"; tt.error = res.reason; return; } tt.agent_id = res.agent.agent_id; tt.call_id = res.call_id; tt.status = "running"; delete tt.note; });
        if (res.ok && !res.queued) spawnRun(res.call_id);
      }
    }
    const q = cur(), active = q.tasks.some((t) => t.status === "running"), waiting = q.tasks.some((t) => t.status === "pending" || t.status === "blocked");   // a blocked task keeps the plan open until its parent answers
    if (!active && !waiting) break;
    if (Date.now() - t0 > 1_800_000) { finishWith("failed"); return; }
    await sleep(500);
  }
  if (cur().tasks.some((t) => t.role && defs.get(t.role)?.writes && t.status === "done")) await applyPatchesCmd();
  finishWith(cur().tasks.every((t) => t.status === "done" || t.status === "cancelled") ? "done" : "failed");
}
/** agent.call + the locks, in order: validate and record, then take the locks (the agent never does), then claim the agent so it can start. */
async function grant(req: CallReq, claim: boolean): Promise<CallRes> {
  const claimNow = (r: Extract<CallRes, { ok: true }>) => { const ag = store.agent(task, r.agent.agent_id)!; ag.status = "running"; ag.activity = "starting"; ag.last_event_at = Date.now(); };
  let res!: CallRes;
  store.tx(() => { res = agentCall(store, defs, policy, req); if (res.ok && !res.queued && !res.needLocks && claim) claimNow(res); });
  if (res.ok && res.needLocks) {
    const g = res, lr = await locks.acquire({ task_id: task, agent_id: g.agent.agent_id, call_id: g.call_id, paths: g.needLocks!, ttlMs: policy.lockTtlMs });
    if (lr.ok) { if (claim) store.tx(() => claimNow(g)); }
    else { g.queued = { position: lr.position, heldBy: lr.heldBy }; store.tx(() => { const c = store.calls.find((x) => x.id === g.call_id); if (c) c.reason = `queued behind ${lr.heldBy.join(",")}`; }); }
  }
  return res;
}
const lastReport = (agent: string) => [...store.reports].reverse().find((r) => r.task_id === task && r.agent_id === agent);

if (cmd === "delegate" && qaFailed(readQa(dirname(file)))) {
  out({ ok: false, reason: `the QA loop ended (${readQa(dirname(file)).reason}); the test is marked failed. Do not delegate again: give your final answer and say it failed and why.` });
} else if (cmd === "delegate") {
  const asyncMode = rest.includes("--async");
  const req: CallReq = { task_id: task, caller_agent_id: me, role: flag("role") ?? "", session_arg: flag("session"), mode: flag("mode") === "ask" ? "ask" : "work",
    objective: flag("objective"), output: flag("output"), boundaries: flag("boundaries"), writes: flag("writes")?.split(",").filter(Boolean), title: flag("title") };
  const res = await grant(req, asyncMode);   // asyncMode: claimed at once, so it counts as live and cannot be double-called
  if (!res.ok) out({ ok: false, reason: res.reason });
  else if (res.queued) out({ ok: true, queued: true, agent_id: res.agent.agent_id, position: res.queued.position, waiting_for: res.queued.heldBy, note: "its locks are held; it starts by itself when they free; use wait" });
  else if (asyncMode) { spawnRun(res.call_id); out({ ok: true, async: true, agent_id: res.agent.agent_id, call_id: res.call_id, status: "running", note: "use wait --agents <ids> to get the answers" }); }
  else { const { r } = await runCall(res.call_id); out({ ok: r.ok, needs_parent: r.needs_parent, agent_id: res.agent.agent_id, session: res.kind, mode: r.mode, report_id: r.report_id, patch_id: r.patch_id, summary: r.summary, violations: r.violations, error: r.error }); }
} else if (cmd === "_run") {
  await runCall(flag("call")!);
} else if (cmd === "wait") {
  const names = (flag("agents") ?? "").split(",").filter(Boolean), limit = Number(flag("timeout") ?? 90) * 1000, t0 = Date.now();
  const pending = () => names.filter((n) => { const a = store.agent(task, n); return !a || a.status === "running" || store.calls.some((c) => c.task_id === task && c.callee_agent_id === n && c.status === "granted"); });   // running, or granted and waiting for its locks
  for (;;) { store.reload(); if (!pending().length || Date.now() - t0 > limit) break; await sleep(1500); }
  out({ timed_out: pending().length > 0, still_running: pending(), agents: names.map((n) => { const a = store.agent(task, n), r = lastReport(n); return { agent_id: n, status: a?.status ?? "unknown", needs_parent: a?.needs_parent ?? undefined, report_id: r?.id, summary: r?.summary.slice(0, 600) ?? null, ...((r?.summary.length ?? 0) > 600 ? { truncated: true, read_full_with: `ledger_get --report ${r!.id}` } : {}), patch: store.patches.filter((p) => p.task_id === task && p.agent_id === n).map((p) => `${p.id}:${p.state}`).join(",") || null }; }) });
} else if (cmd === "apply_patches") {
  await applyPatchesCmd();
} else if (cmd === "plan_submit") {
  let tasks: PlanTask[];
  try { tasks = JSON.parse(flag("tasks") ?? "[]"); } catch (e) { out({ ok: false, errors: ["--tasks is not valid JSON: " + String(e).slice(0, 80)] }); process.exit(0); }
  let o: unknown;
  store.tx(() => {
    const owner = store.agent(task, me);
    const v = validatePlan(tasks, defs, owner?.name ?? "lead", policy, store, task);
    if (!v.ok) { store.ev("plan.rejected", task, me, { errors: v.errors.length }); o = { ok: false, errors: v.errors }; return; }   // nothing is stored, nothing starts
    const plan_id = "plan" + (store.plans.filter((p) => p.task_id === task).length + 1);
    store.plans.push({ task_id: task, plan_id, owner: me, waves: v.waves, status: "submitted", created: Date.now(), tasks: tasks.map((t) => ({ ...t, status: "pending" as const })) });
    store.ev("plan.submitted", task, me, { plan_id, tasks: tasks.length, waves: v.waves.length }); o = { ok: true, plan_id, waves: v.waves };
  });
  out(o);
} else if (cmd === "plan_run") {
  let o: unknown;
  store.tx(() => { const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan")); if (!p) { o = { ok: false, reason: "no such plan; submit it first" }; return; } if (p.status !== "submitted") { o = { ok: false, reason: `plan is ${p.status}` }; return; } p.status = "running"; o = { ok: true, plan_id: p.plan_id, started: true, note: "use plan_status --plan <id> --wait 90" }; });
  if ((o as { ok: boolean }).ok) spawn("bun", ["--smol", join(HDIR, "tools.ts"), "_plan", "--plan", flag("plan")!], { detached: true, stdio: "ignore", env: process.env }).unref();
  out(o);
} else if (cmd === "_plan") {
  await execPlan(flag("plan")!);
} else if (cmd === "plan_replan") {
  let wanted: PlanTask[];
  try { wanted = JSON.parse(flag("tasks") ?? "[]"); } catch (e) { out({ ok: false, errors: ["--tasks is not valid JSON: " + String(e).slice(0, 80)] }); process.exit(0); }
  const reason = (flag("reason") ?? "the requirements changed").slice(0, 400);
  let o: unknown, stoppedCalls: string[] = [], restart = false, planId = flag("plan") ?? "";
  store.tx(() => {
    const p = store.plans.find((x) => x.task_id === task && x.plan_id === planId);
    if (!p) { o = { ok: false, reason: "no such plan" }; return; }
    const r = replan(p, wanted, reason, defs, store.agent(task, p.owner)?.name ?? "lead", policy, store, task);
    if (!r.ok) { store.ev("plan.replan_refused", task, me, { errors: r.errors.length }); o = { ok: false, errors: r.errors, note: "NOTHING was changed" }; return; }   // a bad change is refused whole
    const v = (p.version ?? 1) + 1;
    p.tasks = r.tasks; p.version = v; (p.changes ??= []).push({ v, t: Date.now(), by: me, reason, summary: r.summary });
    for (const s2 of r.stop) { stopAgent(store, task, s2.agent_id); }   // running work that is no longer wanted stops now (its late result is discarded)
    stoppedCalls = store.calls.filter((c) => c.task_id === task && c.status === "failed" && c.reason === "stopped").map((c) => c.id);
    for (const a of r.affected_agents) say(store, task, me, a, `PLAN CHANGE ${r.summary}. Reason: ${reason}. Your task was changed or cancelled; read the new instruction you are given and drop work based on the old one.`);
    say(store, task, me, "all", `PLAN CHANGE ${r.summary}. Reason: ${reason}.`);
    store.ev("plan.replanned", task, me, { plan_id: planId, v, added: r.added.length, modified: r.modified.length, cancelled: r.cancelled.length, redo: r.redo.length });
    if (["done", "failed", "aborted"].includes(p.status) && p.tasks.some((t) => t.status === "pending")) { p.status = "running"; restart = true; }   // finished plan with new work: the scheduler runs again
    o = { ok: true, version: v, summary: r.summary, added: r.added, changed: r.modified, cancelled: r.cancelled, redone: r.redo, stopped: r.stop.map((x) => x.agent_id), told: r.affected_agents };
  });
  for (const c of stoppedCalls) await locks.release(task, c, policy.lockTtlMs);   // a stopped writer frees its locks at once
  if (restart) spawn("bun", ["--smol", join(HDIR, "tools.ts"), "_plan", "--plan", planId], { detached: true, stdio: "ignore", env: process.env }).unref();
  out(o);
} else if (cmd === "plan_answer") {   // the parent answers an agent that stopped to ask: the SAME agent continues with the answer
  let o: unknown;
  store.tx(() => {
    const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan")), t = p?.tasks.find((x) => x.id === flag("item"));   // --item = the plan task; --task is the harness task id (global)
    if (!p || !t) { o = { ok: false, reason: "no such plan or task" }; return; }
    if (t.status !== "blocked") { o = { ok: false, reason: "task " + t.id + " is " + t.status + ", not blocked: there is no question to answer" }; return; }
    const text = (flag("text") ?? "").trim();
    if (!text) { o = { ok: false, reason: "--text is empty" }; return; }
    t.status = "pending"; t.session = t.agent_id; t.question = undefined; t.call_id = undefined;
    t.note = "ANSWER FROM YOUR PARENT to your question: " + text.slice(0, 1500) + ". Continue the task with it.";
    store.ev("plan.answered", task, me, { plan_id: p.plan_id, task: t.id, agent: t.agent_id }); o = { ok: true, task: t.id, agent_id: t.agent_id, note: "it continues the same agent and its memory" };
  });
  out(o);
} else if (cmd === "plan_pause" || cmd === "plan_resume") {
  let o: unknown;
  store.tx(() => { const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan")); if (!p) { o = { ok: false, reason: "no such plan" }; return; } p.paused = cmd === "plan_pause"; store.ev(cmd === "plan_pause" ? "plan.paused" : "plan.resumed", task, me, { plan_id: p.plan_id }); o = { ok: true, plan_id: p.plan_id, paused: p.paused, note: p.paused ? "no NEW task starts; running ones finish" : "tasks start again" }; });
  out(o);
} else if (cmd === "plan_show") {
  store.reload(); const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan"));
  out(p ? { plan_id: p.plan_id, status: p.status, paused: !!p.paused, version: p.version ?? 1, changes: p.changes ?? [], tasks: p.tasks.map((t) => { const a = t.agent_id ? store.agent(task, t.agent_id) : undefined; return { id: t.id, role: t.role, status: t.status, deps: t.deps ?? [], writes: t.writes, objective: t.objective, agent_id: t.agent_id, agent_title: a?.title, agent_status: a?.status, activity: a?.activity, session_id: a?.session_id, note: t.note, error: t.error }; }) } : { ok: false, reason: "no such plan" });
} else if (cmd === "plan_status") {
  const limit = Number(flag("wait") ?? 0) * 1000, t0 = Date.now(), find = () => store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan"));
  for (;;) { store.reload(); const p = find(); if (!p || ["done", "failed", "aborted"].includes(p.status) || Date.now() - t0 > limit) break; await sleep(1200); }
  const p = find();
  out(p ? { plan_id: p.plan_id, status: p.status, waves: p.waves, tasks: p.tasks.map((t) => ({ id: t.id, role: t.role, status: t.status, agent_id: t.agent_id, error: t.error, question: t.question, answer: t.status === "done" ? store.reports.find((r) => r.id === t.report_id)?.summary.slice(0, 500) : undefined })) } : { ok: false, reason: "no such plan" });
} else if (cmd === "agents_list") {
  store.reload();
  out(store.agentsOf(task).map((a) => ({ agent_id: a.agent_id, role: a.role, title: a.title, description: a.description, status: a.status, activity: a.activity, session: a.session_id ? "live" : "none", session_id: a.session_id, resume_count: a.resume_count, ...sessionStats(store, task, a.agent_id), level: a.level, needs_parent: a.needs_parent ?? undefined, called_by: a.caller_agent_id, parent_type: a.parent_type, finished_at: a.finished_at ? new Date(a.finished_at).toISOString() : null })));
} else if (cmd === "agent_info") {
  store.reload(); const a = store.agent(task, flag("agent") ?? "");
  if (!a) out({ ok: false, reason: `agent_not_in_task: ${flag("agent")}` });
  else out({ agent_id: a.agent_id, role: a.role, title: a.title, description: a.description, status: a.status, activity: a.activity, level: a.level, needs_parent: a.needs_parent ?? undefined,
    session: { id: a.session_id, cwd: a.cwd, resume_count: a.resume_count, runs: a.runs ?? 0, parent_type: a.parent_type, parent_session_id: a.parent_session_id, parent_agent_id: a.parent_agent_id, called_by: a.caller_agent_id },
    started_at: a.started_at ? new Date(a.started_at).toISOString() : null, finished_at: a.finished_at ? new Date(a.finished_at).toISOString() : null,
    final_response: (a.final_response ?? "").slice(0, 4000), last_report_id: a.last_report_id,
    sub_agents: store.agentsOf(task).filter((x) => x.caller_agent_id === a.agent_id).map((x) => ({ agent_id: x.agent_id, role: x.role, status: x.status, session_id: x.session_id })),
    calls_made: store.calls.filter((c) => c.task_id === task && c.caller_agent_id === a.agent_id).map((c) => `${c.callee_agent_id ?? "(denied)"} ${c.status}${c.reason ? " (" + c.reason.slice(0, 60) + ")" : ""}`),
    calls_received: store.calls.filter((c) => c.task_id === task && c.callee_agent_id === a.agent_id).map((c) => `${c.caller_agent_id} ${c.session_arg} ${c.status}`) });
} else if (cmd === "agent_update") {
  let o: unknown;
  store.tx(() => { const a = store.agent(task, flag("agent") ?? ""); if (!a) { o = { ok: false, reason: `agent_not_in_task: ${flag("agent")}` }; return; }
    const t = flag("title"), d = flag("description"); if (t) a.title = t.slice(0, 80); if (d) a.description = d.slice(0, 300);
    store.ev("agent.updated", task, me, { agent: a.agent_id }); o = { ok: true, agent_id: a.agent_id, title: a.title, description: a.description }; });
  out(o);
} else if (cmd === "say") {
  const to = flag("to") ?? ""; let o: unknown;
  store.tx(() => { if (to !== "all" && !store.agent(task, to)) { o = { ok: false, reason: `agent_not_in_task: ${to}` }; return; } say(store, task, me, to, flag("text") ?? ""); o = { ok: true }; });
  out(o);
} else if (cmd === "inbox") { out(store.tx(() => inbox(store, task, me)).map((n) => ({ from: n.from, text: n.text })));
} else if (cmd === "board_status") { store.reload(); out(locks.kind === "redis" ? boardStatus(store, task, await locks.holders(task), await locks.waiting(task)) : boardStatus(store, task));
} else if (cmd === "ledger_get") { store.reload(); const r = store.reports.find((x) => x.id === flag("report")); out(r ? { id: r.id, agent: r.agent_id, text: r.reply ?? r.summary, files: r.files } : { ok: false, reason: "no such report" });
} else if (cmd === "agent_stop") {
  let rows: { agent_id: string }[] = [], stopped: string[] = [];
  store.tx(() => { rows = stopAgent(store, task, flag("agent") ?? ""); stopped = store.calls.filter((x) => x.status === "failed" && x.reason === "stopped").map((x) => x.id); });
  for (const c of stopped) await locks.release(task, c, policy.lockTtlMs);
  out({ ok: true, stopped: rows.map((r) => r.agent_id) });
} else if (cmd === "ls") { out(wsLs(join(cwd, "run_test"), flag("path")));
} else if (cmd === "read_file") { out(wsRead(join(cwd, "run_test"), flag("path") ?? "", Number(flag("offset") ?? 1), Number(flag("limit") ?? 200)));
} else if (cmd === "grep") { out(wsGrep(join(cwd, "run_test"), flag("pattern") ?? "", flag("path")));
} else if (cmd === "proto_check") {   // a NO-BUILD prototype (index.html + plain scripts + Vue from a CDN): files exist, scripts parse, every screen / component used is defined. No install, no server: under a second.
  const d = resolve(cwd, flag("dir") ?? ""); if (!d.startsWith(resolve(cwd))) { out({ ok: false, error: "the folder must be inside the workspace" }); } else { const { protoCheck } = await import("./core/proto_check.ts"); out(protoCheck(d)); }
} else if (cmd === "qa_check") {   // EARLY CHECK while developing (no video): type check + dev server + page errors + dev log, in a throwaway Docker container (2 GB, 1 CPU). On a failure it first CHECKPOINTS the workspace (git commit), then tells the master what to hand to the sub-agent. Same issue 3 times in a row = STOP, the test is marked failed (harness/core/qa_loop.ts).
  const qdir = dirname(file), qs = readQa(qdir), dir = flag("dir") ?? "", pj = join(cwd, "run_test", dir.replace(/^run_test[\\/]?/, ""), "package.json");
  if (existsSync(join(qdir, "qa_disabled"))) out({ ok: false, disabled: true, next: "qa_check is switched off for this task by the test setup. Do not run it again and do not treat this as a failure: judge only the delegation, then give your final answer." });
  else if (qaFailed(qs)) out({ ok: false, stop: true, reason: `the QA loop already ended (${qs.status}): ${qs.reason}. The test is marked failed. Do not call anything else: give your final answer and say it failed and why.` });
  else if (!dir || dir.startsWith("/") || dir.includes("..") || !existsSync(pj)) out({ ok: false, reason: `--dir must be an app folder inside run_test/ with a package.json (got "${dir}")` });
  else {
    const pk = JSON.parse(readFileSync(pj, "utf8")), deps = { ...pk.dependencies, ...pk.devDependencies };
    const kind = deps.expo ? { start: undefined, port: undefined } : deps.next ? { start: "corepack pnpm exec next dev -p 3000", port: 3000 } : deps.vite ? { start: "corepack pnpm exec vite --host 0.0.0.0 --port 5173", port: 5173 } : { start: pk.scripts?.dev ? "corepack pnpm run dev" : "corepack pnpm start", port: 3000 };
    const o = join(qdir, "qa", "check-" + Date.now());
    const r = recordDevServer({ appDir: dirname(pj), out: o, mode: "check", route: flag("route") ?? "/", ...kind });
    let checkpoint: string | undefined;
    if (!r.ok) {   // BEFORE any fix: commit what is there now, so every attempt can be compared with / returned to this state
      const g = (a: string[]) => spawnSync("git", ["-C", cwd, "-c", "user.name=harness", "-c", "user.email=harness@local", ...a], { encoding: "utf8" });
      g(["add", "-A"]); g(["commit", "-qm", `qa checkpoint before fix: ${r.stage ?? "?"}: ${(r.reasons?.[0] ?? "").slice(0, 80)}`]);
      checkpoint = g(["rev-parse", "--short", "HEAD"]).stdout.trim() || undefined;
    }
    const v = recordCheck(qs, { ok: r.ok, stage: r.stage ?? "?", reasons: r.reasons ?? [], checkpoint }); writeQa(qdir, qs);
    const reasons = (r.reasons ?? []).slice(0, 8);
    if (r.ok) out({ ok: true, stage: r.stage, seconds: r.seconds, screenshot: r.screenshot ? "qa.png in " + o : undefined, next: "healthy: you may report done" });
    else if (v.stop) out({ ok: false, stop: true, stage: r.stage, reasons, same_issue_count: v.n, checkpoint, next: `STOP: the same issue failed ${v.n} times in a row. The test is marked failed. Do not delegate again: give your final answer, say it failed, and name the error.` });
    else out({ ok: false, stage: r.stage, reasons, seconds: r.seconds, attempt: v.n, of: MAX_SAME, checkpoint,
      hand_over: `The app in run_test/${dir} fails its automatic check (${r.stage}). Fix THIS, whoever caused it (pre-existing code counts: the app must pass). Errors: ${reasons.join(" | ")}. Change only what is needed; do not delete features. Say which files you changed. (Checkpoint before your change: git ${checkpoint ?? "?"}.)`,
      next: `NOT healthy (the same issue ${v.n} of ${MAX_SAME}). Delegate the fix with the hand_over text (add PLAN.md and the folder as your agent needs), then run qa_check again. A DIFFERENT error next time is fine. If you judge it cannot be fixed, run qa_give_up --reason "...": that is allowed, the test is then marked failed.` });
  }
} else if (cmd === "proc_list" || cmd === "proc_stop") {   // the host processes inside THIS workspace (dev servers, installs, leftover shells): any agent of the team may look at them and stop one (core/procs.ts)
  const pc = await import("./core/procs.ts");
  out(cmd === "proc_list" ? { ok: true, processes: pc.listTaskProcs(cwd) } : pc.stopTaskProc(cwd, Number(flag("pid"))));
} else if (cmd === "bg_start" || cmd === "bg_list" || cmd === "bg_log" || cmd === "bg_stop" || cmd === "preview" || cmd === "preview_list" || cmd === "preview_stop" || cmd === "preview_restart") {
  // BACKGROUND SCRIPTS (core/bg.ts), run by the harness on the host in this workspace, with a record: status running | succeeded | failed | stopped | interrupted, exit code, log file.
  // `preview` = a dev server as a background script with a free port and a public_url (core/preview.ts). The master sees only the RUNNING ones by default; finished ones with `bg_list --all` or `bg_log --id`.
  const bgm = await import("./core/bg.ts"), pv = await import("./core/preview.ts"), sdir = dirname(file), by = flag("by") ?? (me || "master");
  const brief = (r: import("./core/bg.ts").BgRow) => ({ user_requested: r.user_requested || undefined, last_checked: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : undefined, closes_at: r.status === "running" && r.expires_at ? new Date(r.expires_at).toISOString() : undefined, id: r.id, kind: r.kind, status: r.status, label: r.label, cmd: r.cmd.slice(0, 120), dir: r.dir.slice(cwd.length + 1) || ".", pid: r.pid, started: new Date(r.started).toISOString(), ended: r.ended_at ? new Date(r.ended_at).toISOString() : undefined, exit_code: r.exit_code, stopped_by: r.stopped_by, public_url: r.public_url, log_bytes: r.log_bytes });
  // THE PREVIEW IS CHECKED, not just started: a server that answers can still show a blank page. A failed preview (script ended, JavaScript error, blank page) goes through the SAME repair loop as qa_check:
  // recorded with a signature, checkpointed (git), the broken preview stopped, a hand_over for the sub-agent returned; the same issue 3 times in a row ends the loop and the test is marked failed; qa_give_up closes it with evidence.
  const previewGate = (r: Extract<Awaited<ReturnType<typeof pv.startPreview>>, { ok: true }>, dirRel: string) => {
    const qdir = dirname(file), qs = readQa(qdir);
    if (qaFailed(qs)) return { ok: false, stop: true, reason: `the QA loop already ended (${qs.status}): ${qs.reason}. The test is marked failed. Do not delegate again: give your final answer and say it failed and why.` };
    const run = bgm.getBg(sdir, r.id), reasons: string[] = [];
    if (run && run.status !== "running") reasons.push(`the preview script ended: ${run.status}${run.exit_code !== undefined ? ` (exit ${run.exit_code})` : ""}. ${(bgm.bgLog(sdir, r.id, 25) ?? "").split("\n").filter((x) => /error|ERR_|failed|cannot find|not found|unable/i.test(x)).slice(-4).join(" | ")}`);
    else if (r.page?.checked && r.page.renders === false) reasons.push(...(r.page.errors.length ? r.page.errors : [r.page.why ?? "the page is blank"]));
    else if (!r.ready) return undefined;   // still starting (install can take minutes): no verdict yet
    if (!reasons.length) { recordCheck(qs, { ok: true, stage: "preview", reasons: [] }); writeQa(qdir, qs); return undefined; }
    const g = (a: string[]) => spawnSync("git", ["-C", cwd, "-c", "user.name=harness", "-c", "user.email=harness@local", ...a], { encoding: "utf8" });
    g(["add", "-A"]); g(["commit", "-qm", `preview checkpoint before fix: ${reasons[0]!.slice(0, 80)}`]);
    const checkpoint = g(["rev-parse", "--short", "HEAD"]).stdout.trim() || undefined, v = recordCheck(qs, { ok: false, stage: "preview", reasons, checkpoint }); writeQa(qdir, qs);
    bgm.stopBg(sdir, r.id, "harness", { userAsked: true });   // a broken preview is not left running
    if (v.stop) return { ok: false, stop: true, stage: "preview", reasons, same_issue_count: v.n, checkpoint, next: `STOP: the same issue failed ${v.n} times in a row. The test is marked failed. Do not delegate again: give your final answer, say it failed, why, and what you tried.` };
    return { ok: false, stage: "preview", reasons, attempt: v.n, of: MAX_SAME, checkpoint, preview_stopped: true,
      hand_over: `The app in run_test/${dirRel} starts, but it is BROKEN in a browser (${reasons.join(" | ")}). Fix THIS, whoever caused it (pre-existing code counts: the app must work). Native-only packages (react-native-pulsar, keyboard-controller) are already stubbed on web by the preview, so look for the cause in the app code or its imports. Change only what is needed; do not delete features. Say which files you changed and why.`,
      next: `The preview is NOT working (attempt ${v.n} of ${MAX_SAME}): do not give the person a link or call it done. Delegate the fix with hand_over (add PLAN.md and the folder), then run preview --dir ${dirRel} again. A DIFFERENT error next time is fine. If you judge it cannot be fixed, run qa_give_up --reason "<evidence>": that records it as an error you caught.` };
  };
  if (cmd === "bg_list" || cmd === "preview_list") {
    const all = bgm.listBg(sdir, { all: true }), shown = flag("all") !== undefined || rest.includes("--all") ? all : all.filter((r) => r.status === "running");
    bgm.touchBg(sdir, all.filter((r) => r.status === "running").map((r) => r.id));   // the master looked: the 10-minute check clock restarts
    // a running PREVIEW is shown with a live browser check: "running" is not "works" (a blank page, a JavaScript error)
    const withPage = shown.map((r) => ({ ...brief(r), page_check: r.kind === "preview" && r.status === "running" && r.port && pv.cfg("PREVIEW_PAGE_CHECK", "1") !== "0" ? (() => { const c = pv.checkPage(`http://127.0.0.1:${r.port}`, 12_000); return { renders: c.renders, errors: c.errors, why: c.why }; })() : undefined }));
    const broken = withPage.filter((x) => x.page_check && x.page_check.renders === false);
    out({ ok: true, scripts: withPage, broken_previews: broken.length ? broken.map((x) => x.id) : undefined, warning: broken.length ? "A preview is running but its page is BROKEN in a browser (see page_check). Do not present it as working: run preview --dir <folder> again for the repair loop (it returns a hand_over for the sub-agent), or qa_give_up with the evidence." : undefined, running: all.filter((r) => r.status === "running").length, finished: all.filter((r) => r.status !== "running").length, next: shown.length === all.length ? undefined : "Only running scripts are shown. `bg_list --all` also shows finished ones (succeeded/failed/stopped/interrupted); `bg_log --id <id>` reads any script's log." });
  } else if (cmd === "bg_log") { const r = bgm.getBg(sdir, flag("id") ?? ""); if (r) bgm.touchBg(sdir, [r.id]); out(r ? { ok: true, ...brief(r), log: bgm.bgLog(sdir, r.id, Number(flag("tail") ?? 60)) ?? "" } : { ok: false, reason: "no such background script (bg_list --all shows every one)" }); }
  else if (cmd === "bg_stop" || cmd === "preview_stop") out(bgm.stopBg(sdir, flag("id") ?? "", by, { userAsked: rest.includes("--user-asked") }));
  else if (cmd === "bg_start") {
    const d = flag("dir") ?? "run_test", full = d.startsWith("/") ? d : join(cwd, d.replace(/^\.?\//, ""));
    if (d.includes("..") || !(full === cwd || full.startsWith(cwd + "/"))) out({ ok: false, reason: "--dir must be a folder inside the workspace" });
    else if (!flag("cmd")) out({ ok: false, reason: "--cmd is required" });
    else {
      const port = flag("port") ? await bgm.freePort(Number(pv.cfg("PREVIEW_PORT_FROM", "5300")), Number(pv.cfg("PREVIEW_PORT_TO", "5399"))) : undefined;
      const m = bgm.startBg(sdir, { task, cmd: flag("cmd")!, dir: full, by, port, publicHost: pv.publicHost(), label: flag("label"), timeoutMin: flag("timeout") !== undefined ? Number(flag("timeout")) : undefined, userRequested: rest.includes("--user-asked") });
      out({ ok: true, id: m.id, pid: m.pid, public_url: m.public_url, closes_at: m.expires_at ? new Date(m.expires_at).toISOString() : undefined, next: `Running in the background (recorded); it closes itself at ${m.expires_at ? new Date(m.expires_at).toISOString() : "never"} (default 20 min, --timeout <minutes> up to 120; there is no unlimited run). bg_log --id ${m.id} reads its output, bg_list shows it, bg_stop --id ${m.id} ends it.${port ? " The command's {port} (also env PORT) is " + port + "." : ""}` });
    }
  } else if (cmd === "preview") {
    const d = flag("dir") ?? "", rel = d.replace(/^run_test[\\/]?/, "");
    if (!d || d.includes("..")) out({ ok: false, reason: "--dir must be an app folder inside run_test/ (or the workspace), no .." });
    else {
      const full = d.startsWith("/") ? d : existsSync(join(cwd, "run_test", rel)) ? join(cwd, "run_test", rel) : join(cwd, rel);
      const r = await pv.startPreview({ storeDir: sdir, task, dir: full, allowedRoot: cwd, by, waitSec: Number(flag("wait") ?? 90), timeoutMin: flag("timeout") !== undefined ? Number(flag("timeout")) : undefined, userRequested: !rest.includes("--master-own") });
      out((r.ok ? previewGate(r, rel) : undefined) ?? (r.ok ? { ok: true, id: r.id, page_check: r.page ? { renders: r.page.renders, errors: r.page.errors, why: r.page.why, checked: r.page.checked, webgpu_adapter: r.page.webgpu_adapter, note: r.page.note } : undefined, closes_at: r.expires_at ? new Date(r.expires_at).toISOString() : "never", public_url: r.public_url, url: r.url, status: r.status, ready: r.ready, log_tail: r.ready ? undefined : r.log,
        next: r.ready ? `Give the person public_url (${r.public_url}): it works from another machine; url (localhost) only on this one. Browser features that need a secure context (WebGPU, camera, clipboard) only work on url (http://localhost:<port>, on the machine that runs the preview) or over HTTPS: public_url is plain http on a LAN address, so a WebGPU/3D scene stays empty there; say that. READ page_check: if renders is false the page is BLANK or broken in a browser even though the server answers: tell the person that plainly with the errors, do not call it working. It runs as background script ${r.id} and closes itself at ${r.expires_at ? new Date(r.expires_at).toLocaleTimeString() : "never"} (20 min default, --timeout <minutes> up to 120). Leave it running, close it with bg_stop --id ${r.id} when the person asks.` : r.status === "running" ? `Still starting (install can take minutes): tell the person public_url ${r.public_url}, read bg_log --id ${r.id} and check again.` : `The script ended (${r.status}): read bg_log --id ${r.id} and tell the person why.` } : r));
    }
  } else {   // preview_restart
    const old = bgm.getBg(sdir, flag("id") ?? "");
    if (!old || old.kind !== "preview") out({ ok: false, reason: "no such preview (bg_list --all shows them)" });
    else { bgm.stopBg(sdir, old.id, by); await new Promise((ok) => setTimeout(ok, 800)); const r = await pv.startPreview({ storeDir: sdir, task, dir: old.dir, allowedRoot: cwd, by, waitSec: Number(flag("wait") ?? 90), userRequested: old.user_requested }); out((r.ok ? previewGate(r, old.dir.slice(cwd.length + 1).replace(/^run_test\//, "")) : undefined) ?? (r.ok ? { ok: true, restarted: true, id: r.id, public_url: r.public_url, ready: r.ready, status: r.status, log_tail: r.ready ? undefined : r.log } : r)); }
  }
} else if (cmd === "qa_give_up") {   // the master is never forced to keep trying
  const qdir = dirname(file), qs = readQa(qdir); giveUp(qs, flag("reason") ?? "no reason given"); writeQa(qdir, qs);
  out({ ok: true, recorded: true, next: "The test is marked failed. Give your final answer now: say it failed and why." });
} else out({ ok: false, reason: `unknown command ${cmd}` });
