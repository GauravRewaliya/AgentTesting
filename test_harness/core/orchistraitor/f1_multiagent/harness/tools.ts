// The agents' tools as one command (plan 5.2 / 23.3):
//   bun tools.ts <delegate|wait|apply_patches|agents_list|agent_update|say|inbox|board_status|ledger_get|agent_stop|ls|read_file|grep|qa_check> --flag value ...
//   ls / read_file / grep = READ-ONLY look at the shared workspace run_test/ (core/workspace_read.ts): the lead can check a result itself instead of asking a sub-agent to run commands.
// A stand-in for the mod's registered tools: same rules (agent.call), same registry, one line of JSON out.
// Identity comes from the environment set for THIS agent: HARNESS_STORE, HARNESS_TASK, HARNESS_AGENT, HARNESS_CWD, HARNESS_MAX_DEPTH, HARNESS_RUNNER.
// `delegate --async` returns at once and runs the callee in a detached process (`_run`), so one agent can start several callees in parallel and `wait` for them.
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
} else if (cmd === "qa_check") {   // EARLY CHECK while developing (no video): type check + dev server + page errors/overlay/blank page, in a throwaway Docker container (2 GB, 1 CPU). Same check the QA video runs first.
  const dir = flag("dir") ?? "", pj = join(cwd, "run_test", dir.replace(/^run_test[\\/]?/, ""), "package.json");
  if (!dir || dir.startsWith("/") || dir.includes("..") || !existsSync(pj)) out({ ok: false, reason: `--dir must be an app folder inside run_test/ with a package.json (got "${dir}")` });
  else {
    const pk = JSON.parse(readFileSync(pj, "utf8")), deps = { ...pk.dependencies, ...pk.devDependencies };
    const kind = deps.expo ? { start: undefined, port: undefined } : deps.next ? { start: "corepack pnpm exec next dev -p 3000", port: 3000 } : deps.vite ? { start: "corepack pnpm exec vite --host 0.0.0.0 --port 5173", port: 5173 } : { start: pk.scripts?.dev ? "corepack pnpm run dev" : "corepack pnpm start", port: 3000 };
    const o = join(dirname(file), "qa", "check-" + Date.now());
    const r = recordDevServer({ appDir: dirname(pj), out: o, mode: "check", route: flag("route") ?? "/", ...kind });
    out({ ok: r.ok, stage: r.stage, reasons: (r.reasons ?? []).slice(0, 8), seconds: r.seconds, screenshot: r.screenshot ? "qa.png in " + o : undefined, next: r.ok ? "healthy: report done" : "NOT healthy: hand these exact reasons to the sub-agent to fix, then run qa_check again" });
  }
} else out({ ok: false, reason: `unknown command ${cmd}` });
