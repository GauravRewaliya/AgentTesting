// The agents' tools as one command (plan 5.2 / 23.3):
//   bun tools.ts <site_audit|ref_store|ref_assets|browser_status|browser_connect|browser_disconnect|browser_launch|browse|ref_compare|ref_capture|proto_init|delegate|wait|apply_patches|agents_list|agent_update|say|inbox|board_status|ledger_get|agent_stop|ls|read_file|grep|proto_check|fork_all|bg_start|bg_list|bg_log|bg_restart|get_public_url|bg_stop|proc_list|proc_stop> --flag value ...
//   ls / read_file / grep = READ-ONLY look at the shared workspace run_test/ (core/workspace_read.ts): the lead can check a result itself instead of asking a sub-agent to run commands.
// A stand-in for the mod's registered tools: same rules (agent.call), same registry, one line of JSON out.
// Identity comes from the environment set for THIS agent: HARNESS_STORE, HARNESS_TASK, HARNESS_AGENT, HARNESS_CWD, HARNESS_MAX_DEPTH, HARNESS_RUNNER.
// `delegate --async` returns at once and runs the callee in a detached process (`_run`), so one agent can start several callees in parallel and `wait` for them.
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { relWrites } from "./core/rel_writes.ts";
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
import { gateBlock, passPhase, phaseRows, reopenGates } from "./core/phases.ts";
import { peekAgent } from "./core/peek.ts";
import { attention, dueAutoStops, dueNudges, nudgeText, waitSeconds } from "./core/monitor.ts";
import { modelProblem } from "./core/models.ts";
import { locksFromEnv } from "./core/lockapi.ts";
import { customDef } from "./core/custom.ts";
import { FixtureGate } from "./core/fixture_gate.ts";
import { AGENTS_DIR } from "@core/config.ts";
import { homeLaunch } from "@core/userhome.ts";
import { wsGrep, wsLs, wsRead } from "./core/workspace_read.ts";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { imagesOn, memoryProjects, planBlurb, videoOffReason, writeMemory } from "./core/loops_ai.ts";

const MAX_WAVE = 4;
const HDIR = dirname(fileURLToPath(import.meta.url)), TOOLS = `bun ${join(HDIR, "tools.ts")}`;
const [cmd, ...rest] = process.argv.slice(2);
const flag = (k: string) => { const i = rest.indexOf("--" + k); return i >= 0 ? rest[i + 1] : undefined; };
const E = process.env, file = E.HARNESS_STORE!, task = flag("task") ?? E.HARNESS_TASK!, me = E.HARNESS_AGENT ?? "";
const out = (o: unknown) => console.log(JSON.stringify(o));
/** A project folder / file named by an agent, from wherever it stands: its own shell folder, the workspace, or run_test/ (agents wrote `--dir .`, `run_test/x`, `x`, absolute paths: each of them works). Always inside the workspace. */
const inWs = (p: string) => p === resolve(cwd) || p.startsWith(resolve(cwd) + "/");
const projPath = (x: string, mustHave = "index.html") => { const c = [resolve(process.cwd(), x), resolve(cwd, x), resolve(cwd, "run_test", x.replace(/^\.?\/?(run_test\/)?/, ""))].filter(inWs); return c.find((d) => existsSync(join(d, mustHave))) ?? c.find((d) => existsSync(d)) ?? c[0] ?? resolve(cwd, "run_test"); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
if (!file || !task) { out({ ok: false, reason: "tool environment missing (HARNESS_STORE/TASK)" }); process.exit(0); }

const store = new MStore(file), defs = loadAgents();
/** An issue for the admins: append-only log next to the store (session id included) + an `admin.issue` event. Used by report_bug and by the harness backstop. */
const logIssue = (o: { agent?: string; kind: string; text: string; reporter: string; session_id?: string | null; severity?: string }) => {
  store.reload(); const a = o.agent ? store.agent(task, o.agent) : undefined, ts = a ? store.events.filter((e) => e.task_id === task && e.agent_id === a.agent_id && e.kind === "tool.used").map((e) => e.t) : [];
  const rec = { id: "iss_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: Date.now(), at: new Date().toISOString(), task, reporter: o.reporter, agent: o.agent || null, role: a?.role ?? null, session_id: o.session_id ?? a?.session_id ?? null, kind: o.kind, severity: o.severity ?? "medium", log_file: a?.log_file ?? null, status: a?.status ?? null, activity: a?.activity ?? null, running_s: a?.started_at && a.status === "running" ? Math.round((Date.now() - a.started_at) / 1000) : null, last_tool_s_ago: ts.length ? Math.round((Date.now() - Math.max(...ts)) / 1000) : null, tool_calls: ts.length, text: o.text.slice(0, 2000) };
  appendFileSync(join(dirname(file), "admin_issues.jsonl"), JSON.stringify(rec) + "\n");
  store.ev("admin.issue", task, o.reporter, { id: rec.id, agent: rec.agent, kind: o.kind, session_id: rec.session_id }); store.save(); return rec;
};
/** The harness watches while the lead is blocked in `wait` / `plan_status` (throttled to every 10 s, free): ONE status nudge to an agent over 6 min (core/monitor.ts), and a BACKSTOP: an agent with no tool call for 10 min is stopped, its locks released, and the issue logged + the lead told. Returns true when the lead is needed NOW. */
/** Has any WRITER (builder, ux-designer ... anything whose agent.json says writes) worked in THIS task? Without one there is nothing new to verify: the QA agent is not started unless the person asked (--user-asked). Resumed turns of the same task still count (the agents stay in the store). */
const writerRanInTask = () => store.agentsOf(task).some((a) => a.name !== "lead" && defs.get(a.name)?.writes === true && (a.runs ?? 0) > 0);
let lastMonitorTick = 0;
const monitorTick = async (only?: string[]): Promise<boolean> => {
  if (Date.now() - lastMonitorTick < 10_000) return false; lastMonitorTick = Date.now();
  try {
    for (const d of dueNudges(store, task)) store.tx(() => { say(store, task, "harness", d.agent_id, nudgeText(d.running_s)); store.ev("monitor.nudge", task, d.agent_id, { started_at: d.started_at, running_s: d.running_s }); });
    for (const d of dueAutoStops(store, task)) {
      let stopped: string[] = [];
      store.tx(() => { stopAgent(store, task, d.agent_id); stopped = store.calls.filter((x) => x.status === "failed" && x.reason === "stopped").map((x) => x.id); store.ev("monitor.autostop", task, d.agent_id, { silent_s: d.silent_s, running_s: d.running_s }); });
      for (const c of stopped) await locks.release(task, c, policy.lockTtlMs);
      logIssue({ agent: d.agent_id, kind: "stalled", reporter: "harness", text: `No tool call for ${d.silent_s}s (running ${d.running_s}s) and nobody acted: stopped by the harness backstop. Its files are kept; check them before starting a replacement.` });
      const lead = store.agentsOf(task).find((a) => a.name === "lead"); if (lead) store.tx(() => { say(store, task, "harness", lead.agent_id, `${d.agent_id} had no tool call for ${Math.round(d.silent_s / 60)} min and was STOPPED by the harness. Check its files yourself (read_file, a check) before you start a replacement: it may be complete.`); });
    }
    return attention(store, task, only).some((x) => x.level === "stalled" || x.level === "asks");
  } catch { return false; /* monitoring never breaks a command */ }
};
const attentionSpread = (only?: string[]) => { try { const x = attention(store, task, only); return x.length ? { attention: x } : {}; } catch { return {}; } };
// per-agent model: HARNESS_MODELS='{"researcher":"sonnet"}' overrides agent.json for this launch
for (const [n, m] of Object.entries(JSON.parse(E.HARNESS_MODELS ?? "{}") as Record<string, string>)) { const d = defs.get(n); if (d) d.model = m; }
{ const only = E.HARNESS_LEAD_AGENTS, ld = defs.get("lead"); if (only !== undefined && ld) ld.agents = only.split(",").filter(Boolean); }   // a test case decides which agents its lead has
const locks = locksFromEnv(store);
const policy = defaultPolicy({ agentMaxDepth: Number(E.HARNESS_MAX_DEPTH ?? 1), maxInstancesPerRole: Number(E.HARNESS_MAX_INSTANCES ?? 4), externalLocks: locks.kind === "redis", lockTtlMs: Number(E.HARNESS_LOCK_TTL_MS ?? 1_200_000), budgetUsd: Number(E.HARNESS_PROJECT_BUDGET_USD ?? 0) });
const cwd = E.HARNESS_CWD ?? process.cwd();
/** The QA agent works in a throwaway COPY (HARNESS_CWD = the copy); everything that must outlive the call (QA memory, videos, checkpoints) goes to the REAL workspace. */
const realCwd = E.HARNESS_REAL_CWD ?? cwd;
/** Video is the one heavy thing a project can switch off: .loopsAI/config.json { "qa_check": false }. Screenshots and everything else stay available. */
/** Where evidence goes (pictures, videos, reports): <session>/store/qa/<name>/. The workspace holds the person's project only; nothing agents record is written into it. */
const mediaRoot = join(dirname(file), "qa");
/** the pictures of a session folder, full paths, in the order taken: every `tab do` reply lists them, so an agent never hunts for a path (found: 3 extra calls to find them) */
const pictureFiles = (dir: string): string[] => { try { return readdirSync(dir).filter((f) => /^\d{2}_.+\.(png|jpe?g)$/.test(f)).sort().map((f) => join(dir, f)); } catch { return []; } };
const mediaOut = (rel: string) => { const r = rel.replace(/^(run_test|store|qa)[\\/]/, "").replace(/^\/+/, ""); return r && !r.split(/[\\/]/).includes("..") ? join(mediaRoot, r) : undefined; };
const videoOff = (): string | undefined => { const why = videoOffReason(join(realCwd, "run_test")); return why ? why + "; screenshots still work" : undefined; };

/** A writer called without --writes would be refused by the lock hook on its first Write and cost a second call: default to the run_test/<project> folder the objective names. */
function withWrites(req0: CallReq): CallReq {
  const req = req0.writes?.length ? { ...req0, writes: relWrites(req0.writes, [cwd, realCwd]) } : req0;
  if (req.writes?.length || !defs.get(req.role)?.writes) return req;
  const sa = req.session_arg ?? "", prev = sa && sa !== "new" && !sa.startsWith("fork:") ? [...store.calls].reverse().find((c) => c.task_id === task && c.callee_agent_id === sa && c.req?.writes?.length) : undefined;   // a RESUMED writer keeps what it was allowed to write (the lead forgot --writes and paid a second call)
  if (prev) return { ...req, writes: prev.req!.writes as string[] };
  const m = /run_test\/[\w.-]+/.exec(req.objective ?? ""); return m ? { ...req, writes: [m[0]] } : req;
}
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
  const def = launchDef(req.model ? { ...defs.get(req.role)!, model: req.model } : defs.get(req.role)!, defs, res.level, policy.agentMaxDepth, join(tmpdir(), "lf-launch"), TOOLS);
  { const h = homeLaunch(req.role); if (h.allow.length) { def.allow = [...def.allow, ...h.allow]; } }   // user integrations ticked for THIS agent (Settings): nothing ticked, nothing added
  const epoch0 = agent.epoch ?? 0;
  const guard = setInterval(() => { store.reload(); if (store.aborted() || (store.agent(call.task_id, call.callee_agent_id!)?.epoch ?? 0) !== epoch0) runner.killAll?.(); }, 1000);   // the watchdog flag, or a stop (replan / cancel), ends this callee at once
  const r = await runCallee({ store, runner, defs: new Map(defs).set(req.role, def), sessionCap: SESSION_CAP, transcriptExists: real ? (_c, id) => transcriptExistsAnywhere(id) : undefined }, policy, res, req, def,
    { locks: locks.kind === "redis" ? locks : undefined, cwd, writerMode: E.HARNESS_WRITER_MODE === "worktree" ? "worktree" : "shared",
      env: { HARNESS_STORE: file, HARNESS_MAX_DEPTH: String(policy.agentMaxDepth), HARNESS_RUNNER: E.HARNESS_RUNNER ?? "fake", HARNESS_MODELS: E.HARNESS_MODELS ?? "{}",
        HARNESS_WRITER_MODE: E.HARNESS_WRITER_MODE ?? "shared", HARNESS_MAX_INSTANCES: E.HARNESS_MAX_INSTANCES ?? "4", HARNESS_FAKE_DELAY_MS: E.HARNESS_FAKE_DELAY_MS ?? "0", HARNESS_LOCKS_URL: E.HARNESS_LOCKS_URL ?? "", HARNESS_LOCKS_PREFIX: E.HARNESS_LOCKS_PREFIX ?? "lf", HARNESS_LOCK_TTL_MS: E.HARNESS_LOCK_TTL_MS ?? "120000", HARNESS_STRICT: E.HARNESS_STRICT ?? "0", HARNESS_CANARY: E.HARNESS_CANARY ?? "0" },
      extraArgs: () => (real ? [...hookArgs(HDIR), ...homeLaunch(req.role).args] : []) });
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
  let t0 = Date.now();
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
        if (bad) { t.status = "skipped"; t.error = `dependency ${bad} did not finish`; continue; }
        const gb = gateBlock(p, t); if (gb?.dead) { t.status = "skipped"; t.error = gb.reason; }   // an earlier phase failed: this phase can never start
      }
    });
    const p = cur();
    if (!p.paused) {   // 3. start what is ready
      const room = Math.max(0, MAX_WAVE - p.tasks.filter((t) => t.status === "running").length);
      const ready = p.tasks.filter((t) => t.status === "pending" && (t.deps ?? []).every((d) => p.tasks.find((x) => x.id === d)?.status === "done") && !gateBlock(p, t)).slice(0, room);   // a phase waits for the gate of the one before it (phases.ts)
      for (const t of ready) {
        const req: CallReq = { task_id: task, caller_agent_id: p.owner, role: t.role, session_arg: t.session ?? "new", objective: (t.note ? t.note + "\n\n" : "") + t.objective + depsBlock(store, p, t), output: t.output, boundaries: t.boundaries, writes: t.writes, model: t.model, onBehalf: true };
        const res = await grant(req, true);
        store.tx(() => { const tt = cur().tasks.find((x) => x.id === t.id)!; if (!res.ok) { tt.status = "failed"; tt.error = res.reason; return; } tt.agent_id = res.agent.agent_id; tt.call_id = res.call_id; tt.status = "running"; delete tt.note; });
        if (res.ok && !res.queued) spawnRun(res.call_id);
      }
    }
    const q = cur(), active = q.tasks.some((t) => t.status === "running"), waiting = q.tasks.some((t) => t.status === "pending" || t.status === "blocked");   // a blocked task keeps the plan open until its parent answers
    if (!active && !waiting) break;
    if (!active && q.tasks.some((t) => t.status === "pending" && gateBlock(q, t))) t0 += 500;   // waiting for the person / lead to pass a phase gate does not use up the plan's time limit
    if (Date.now() - t0 > 1_800_000) { finishWith("failed"); return; }
    await sleep(500);
  }
  if (cur().tasks.some((t) => t.role && defs.get(t.role)?.writes && t.status === "done")) await applyPatchesCmd();
  finishWith(cur().tasks.every((t) => t.status === "done" || t.status === "cancelled") ? "done" : "failed");
}
/** agent.call + the locks, in order: validate and record, then take the locks (the agent never does), then claim the agent so it can start. */
async function grant(req0: CallReq, claim: boolean): Promise<CallRes> {
  const req: CallReq = req0.writes?.length ? { ...req0, writes: relWrites(req0.writes, [cwd, realCwd]) } : req0;   // EVERY grant (delegate, fork_all, plan tasks) holds its locks under workspace-relative paths, the form the write guard compares
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

/** A WEBSITE project (proto.json kit "site") is built by the pipeline (site_build), never by a lone builder: refuse a NEW builder that writes into it until a plan for it exists (a builder that is CONTINUED for a fix is always allowed). Found in a real run: "One file, one builder; skip the lookup to stay fast". */
function siteGuard(req: CallReq): string | undefined {
  const sa = req.session_arg ?? "new"; if (req.role !== "builder" || !(sa === "new" || sa.startsWith("fork:"))) return undefined;
  const m = /^run_test\/([^/]+)\//.exec((req.writes ?? [])[0] ?? ""); if (!m) return undefined;
  let kit: unknown; try { kit = JSON.parse(readFileSync(join(cwd, "run_test", m[1]!, "proto.json"), "utf8")).kit; } catch { return undefined; }
  const hasRef = (() => { try { return readdirSync(join(cwd, "run_test", "_ref")).some((d) => existsSync(join(cwd, "run_test", "_ref", d, "STORE.md"))); } catch { return false; } })();
  if (!(hasRef && kit !== undefined)) return undefined;   // once a reference was captured, a clone (site OR admin app) is built by the pipeline from briefs, never by a lone builder
  if (store.plans.some((p) => p.task_id === task && p.tasks.some((t) => (t.writes ?? []).some((x) => x.startsWith(`run_test/${m[1]}/`))))) return undefined;
  return `run_test/${m[1]} is a CLONE / website project: its pages are built by the PIPELINE, not by a single builder, so the layouts and briefs exist and several builders work in parallel. Run: site_build --dir run_test/${m[1]} --ref <store made by ref_capture> --request "<the person's words>"; follow it with plan_status --plan <id> --wait 60. (A builder that is already working on it can still be continued with --session <its id> for a fix.)`;
}
const JOB_TOOLS = new Set(["ref_capture", "ref_compare", "site_audit", "browse", "tab", "ref_assets", "proto_check", "preview"]);
if (JOB_TOOLS.has(cmd ?? "") && rest.includes("--async") && !E.HARNESS_JOB) {   // BACKGROUND JOB: the slow tool runs by itself and this call returns at once; `wait --any --agents job_..` (also with agent ids) hands the result over the moment it is ready
  const jd = join(cwd, "run_test", "_jobs"), { mkdirSync } = await import("node:fs"), id = "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  mkdirSync(jd, { recursive: true });
  const q = (x: string) => "'" + x.replace(/'/g, "'\\''") + "'", args = [cmd!, ...rest.filter((x) => x !== "--async")].map(q).join(" ");
  spawn("sh", ["-c", `bun --smol ${q(join(HDIR, "tools.ts"))} ${args} > ${q(join(jd, id + ".json"))} 2> ${q(join(jd, id + ".err"))}; echo $? > ${q(join(jd, id + ".done"))}`], { detached: true, stdio: "ignore", env: { ...process.env, HARNESS_JOB: id } }).unref();
  out({ ok: true, job_id: id, tool: cmd, status: "running", next: `Keep working. When you need the result: wait --any --agents ${id} (it can be mixed with agent ids: it returns the moment the first of them is done).` });
} else if (cmd === "delegate") {
  const asyncMode = rest.includes("--async");
  const req: CallReq = { task_id: task, caller_agent_id: me, role: flag("role") ?? "", session_arg: flag("session"), mode: flag("mode") === "ask" ? "ask" : "work",
    objective: flag("objective"), output: flag("output"), boundaries: flag("boundaries"), writes: flag("writes")?.split(",").filter(Boolean), title: flag("title"), model: flag("model") };
  const mp = modelProblem(req.role, req.model); if (mp) { out({ ok: false, reason: mp }); process.exit(0); }
  const sg = siteGuard(withWrites(req)); if (sg) { out({ ok: false, reason: sg }); process.exit(0); }
  if (req.role === "qa-reviewer" && !rest.includes("--user-asked") && !writerRanInTask()) { out({ ok: false, reason: "QA was NOT started: no builder or other writer has worked in this task, so there is nothing new to verify (a greeting, a question, a status, or a project that was only looked at). Answer the person. If the person explicitly asked you to check, test or run something, delegate again with --user-asked." }); process.exit(0); }
  const res = await grant(withWrites(req), asyncMode);   // asyncMode: claimed at once, so it counts as live and cannot be double-called
  if (!res.ok) out({ ok: false, reason: res.reason });
  else if (res.queued) out({ ok: true, queued: true, agent_id: res.agent.agent_id, position: res.queued.position, waiting_for: res.queued.heldBy, note: "its locks are held; it starts by itself when they free; use wait" });
  else if (asyncMode) { spawnRun(res.call_id); out({ ok: true, async: true, agent_id: res.agent.agent_id, call_id: res.call_id, status: "running", ...(res.reused ? { reused: `this role keeps ONE session per task: ${res.agent.agent_id} was continued (it remembers its earlier work), not started fresh` } : {}), note: "use wait --agents <ids> to get the answers" }); }
  else { const { r } = await runCall(res.call_id); out({ ok: r.ok, needs_parent: r.needs_parent, agent_id: res.agent.agent_id, session: res.kind, ...(res.reused ? { reused: `this role keeps ONE session per task: ${res.agent.agent_id} was continued (it remembers its earlier work), not started fresh` } : {}), mode: r.mode, report_id: r.report_id, patch_id: r.patch_id, summary: r.summary, violations: r.violations, error: r.error }); }
} else if (cmd === "fork_all") {   // N tasks for N agents, ALL STARTED AT ONCE (async): `fork_all --from builder#3 --role builder --tasks '[{"title":"..","writes":["run_test/p/js/pages/a.js"],"objective":".."}, ...]' [--output ..] [--boundaries ..]`, then ONE `wait --agents <ids>`. Parallel by construction: no per-call --async to forget.
  let tasks: { title?: string; writes?: string[] | string; model?: string; objective?: string; output?: string; boundaries?: string }[] = [];
  try { tasks = JSON.parse(flag("tasks") ?? "[]"); } catch (e) { out({ ok: false, reason: "--tasks is not valid JSON: " + String(e).slice(0, 80) }); process.exit(0); }
  if (!Array.isArray(tasks) || !tasks.length) { out({ ok: false, reason: "--tasks must be a non-empty JSON array of {title, writes, objective}" }); process.exit(0); }
  const from = flag("from"), role = flag("role") ?? "builder", started: Record<string, unknown>[] = [];
  for (const t of tasks) {
    const req: CallReq = { task_id: task, caller_agent_id: me, role, session_arg: from ? `fork:${from}` : "new", mode: "work", objective: t.objective, output: t.output ?? flag("output") ?? "Reply in 3 lines: the files you wrote, what you could not do, what you did not check.", boundaries: t.boundaries ?? flag("boundaries") ?? "Write only the files in your writes; edit nothing else. No server, no tests, no npm/pnpm, no build.",
      writes: (Array.isArray(t.writes) ? t.writes : String(t.writes ?? "").split(",")).map((w) => String(w).trim()).filter(Boolean), title: t.title, model: t.model ?? flag("model") };
    const mp = modelProblem(role, req.model); if (mp) { started.push({ title: t.title, ok: false, reason: mp }); continue; }
    const sg = siteGuard(withWrites(req)); if (sg) { started.push({ title: t.title, ok: false, reason: sg }); continue; }
    const res = await grant(withWrites(req), true);
    if (!res.ok) started.push({ title: t.title, ok: false, reason: res.reason });
    else if (res.queued) started.push({ title: t.title, ok: true, queued: true, agent_id: res.agent.agent_id, waiting_for: res.queued.heldBy });
    else { spawnRun(res.call_id); started.push({ title: t.title, ok: true, agent_id: res.agent.agent_id, status: "running" }); }
  }
  const ids = started.filter((x) => x.ok).map((x) => String(x.agent_id));
  if (ids.length > 1) store.tx(() => { for (const id of ids) say(store, task, "harness", id, `TEAM (started together): ${ids.filter((x) => x !== id).map((x) => { const t = started.find((y) => y.agent_id === x); return x + (t?.title ? ` (${t.title})` : ""); }).join(", ")}. Each owns its own files; reach one with team say --to <agent_id>.`); });   // every starter learns who its neighbours are (a builder that began before the others were granted would not see them)
  out({ ok: started.every((x) => x.ok), started, next: ids.length ? `All started together. Now wait --any --agents ${ids.join(",")}: it returns as soon as ONE finishes, with a browser check of its pages; fix that builder at once if needed, then wait --any again with the ones still running (a timeout is NOT a failure: still_running shows each agent last_tool_s_ago; keep waiting while it is under 120 s, a big builder can write for 6+ minutes; answer the person only when an agent shows no tool use for 5 minutes).` : "Nothing started: fix the reasons above." });
} else if (cmd === "_run") {
  await runCall(flag("call")!);
} else if (cmd === "wait") {
  const names = (flag("agents") ?? "").split(",").filter(Boolean), limit = waitSeconds(Number(flag("timeout") ?? 300)) * 1000, t0 = Date.now(); let leadNeeded = false;
  const jobDone = (n: string) => existsSync(join(cwd, "run_test", "_jobs", n + ".done")), pending = () => names.filter((n) => { if (n.startsWith("job_")) return !jobDone(n); const a = store.agent(task, n); return !a || a.status === "running" || store.calls.some((c) => c.task_id === task && c.callee_agent_id === n && c.status === "granted"); });   // running, or granted and waiting for its locks
  // a message the person sent while this turn runs: stop waiting so the PostToolUse hook (activity.ts) hands it to the master NOW; it is not marked read here
  const userMsgs = () => store.notes.filter((n) => n.task_id === task && n.from === "user" && (n.to === me || n.to === "all") && !n.read_by.includes(me)).length;
  let interrupted = false;
  const any = rest.includes("--any");   // --any: return as soon as ONE of them has finished (the master reacts to it at once while the others keep working), with the harness's own check of that agent's pages
  for (;;) { store.reload(); if (await monitorTick(names.filter((n) => !n.startsWith("job_")))) { leadNeeded = true; break; } const left = pending().length; if (any ? left < names.length : !left) break; if (Date.now() - t0 > limit) break; if (userMsgs()) { interrupted = true; break; } await sleep(400); }
  /** what a finished writer left behind, checked by the harness in a real browser (no model call): proto_check of its project + every page of ITS files opened (stub, dead link, JS error, undefined/NaN) */
  const checkWork = async (n: string) => {
    try {
      const writes = store.calls.filter((c) => c.task_id === task && c.callee_agent_id === n).flatMap((c) => c.req?.writes ?? []), m = writes.map((w) => /^run_test\/([^/]+)\//.exec(w)).find(Boolean); if (!m) return undefined;
      const proj = join(cwd, "run_test", m[1]!); if (!existsSync(join(proj, "proto.json")) || !existsSync(join(proj, "index.html")) || existsSync(join(proj, "package.json"))) return undefined;   // only a KIT prototype (proto.json): a three.js page or a plain wireframe is not one and proto_check would report false problems
      const { protoCheck } = await import("./core/proto_check.ts"), { smokeRoutes } = await import("./core/preview.ts"), pc = protoCheck(proj);
      let routes: { id: string; file?: string }[] = [], all: string[] = []; try { const rr = JSON.parse(readFileSync(join(proj, "proto.json"), "utf8")).routes as { id: string; file?: string }[]; all = rr.map((r) => r.id); routes = rr.filter((r) => writes.some((w) => w.endsWith(`js/screens/${r.file}.js`))); } catch { /* not a kit prototype */ }
      const bad = routes.length ? await smokeRoutes("file://" + join(proj, "index.html"), routes, 6_000, all) : [];
      return { agent_id: n, project: "run_test/" + m[1], pages_checked: routes.map((r) => "#/" + r.id), proto_check: pc.ok ? "ok" : pc.problems.slice(0, 6), page_problems: bad.map((x) => `${x.route}: ${x.problems.join("; ")}`), verdict: pc.ok && !bad.length ? "CLEAN: its pages open and work" : "FIX: hand these problems to THIS builder now (delegate --session " + n + "), the others keep working" };
    } catch { return undefined; }
  };
  // when the agents are done, check every NO-BUILD prototype in run_test/ for the master (it does not have to remember to): files exist, scripts parse, screens/components defined, no unstyled classes
  let protos: { dir: string; ok: boolean; problems: string[] }[] | undefined;
  if (!pending().length) { try { const root = join(cwd, "run_test"), { protoCheck } = await import("./core/proto_check.ts"); protos = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(root, d.name, "proto.json")) && existsSync(join(root, d.name, "index.html")) && !existsSync(join(root, d.name, "package.json"))).map((d) => { const r = protoCheck(join(root, d.name)); return { dir: "run_test/" + d.name, ok: r.ok, problems: r.problems.slice(0, 6) }; }); if (!protos.length) protos = undefined; } catch { /* no run_test yet */ } }
  // a lookup agent finished: the HARNESS rebuilds the store index and the mind map (STORE.md, MAP.md) with its layouts and briefs linked in; nobody has to run ref_store (it needs the host, a sandboxed worker cannot)
  try { const { buildStore } = await import("./core/ref_store.ts"), seen = new Set<string>(); for (const n of names.filter((x) => !pending().includes(x))) for (const c of store.calls.filter((c) => c.task_id === task && c.callee_agent_id === n)) for (const w of c.req?.writes ?? []) { const m = /^run_test\/_ref\/([^/]+)\//.exec(w); if (m && !seen.has(m[1]!)) { seen.add(m[1]!); buildStore(join(cwd, "run_test", "_ref", m[1]!), m[1]!); } } } catch { /* the index is regenerated by ref_store */ }
  const finishedNow = names.filter((n) => !pending().includes(n)), checks = any && finishedNow.length ? (await Promise.all(finishedNow.map(checkWork))).filter(Boolean) : undefined;
  const jobs = names.filter((n) => n.startsWith("job_") && jobDone(n)).map((n) => { const f = join(cwd, "run_test", "_jobs", n); let res: unknown = null; try { const t = readFileSync(f + ".json", "utf8"); res = t.length > 3500 ? { truncated: true, head: t.slice(0, 3000) } : JSON.parse(t); } catch { res = null; } return { job_id: n, exit: readFileSync(f + ".done", "utf8").trim(), result: res, error: (() => { try { return readFileSync(f + ".err", "utf8").slice(0, 300) || undefined; } catch { return undefined; } })() }; });
  out({ ...(jobs.length ? { jobs } : {}), ...attentionSpread(names.filter((n) => !n.startsWith("job_"))), ...(any ? { finished_now: finishedNow, checks, next_step: pending().length ? `React to ${finishedNow.join(", ")} NOW (a FIX verdict goes back to that builder at once; CLEAN needs nothing), then wait --any --agents ${pending().join(",")}` : "everyone is done: run ref_compare / preview" } : {}), ...(interrupted ? { interrupted: "user_message", note: "the person sent you a message: it follows in your context; answer it, then call wait again for the same agents" } : {}), proto_check: protos, timed_out: pending().length > 0 && !interrupted, still_running: pending().map((n) => { const ts = store.events.filter((e) => e.kind === "tool.used" && e.task_id === task && e.agent_id === n).map((e) => e.t), st = store.agent(task, n); return { agent_id: n, last_tool_s_ago: ts.length ? Math.round((Date.now() - Math.max(...ts)) / 1000) : null, tool_calls: ts.length, running_s: st?.started_at ? Math.round((Date.now() - st.started_at) / 1000) : null, activity: st?.activity }; }), ...(pending().length > 0 && !interrupted ? { keep_waiting: "A timeout is not a failure. Keep waiting while an agent's last_tool_s_ago is under 120. Stop waiting only if no agent used a tool for 5 minutes." } : {}), agents: names.filter((n) => !n.startsWith("job_")).map((n) => { const a = store.agent(task, n), r = lastReport(n); return { agent_id: n, status: a?.status ?? "unknown", needs_parent: a?.needs_parent ?? undefined, report_id: r?.id, summary: r?.summary.slice(0, 600) ?? null, ...((r?.summary.length ?? 0) > 600 ? { truncated: true, read_full_with: `ledger_get --report ${r!.id}` } : {}), patch: store.patches.filter((p) => p.task_id === task && p.agent_id === n).map((p) => `${p.id}:${p.state}`).join(",") || null }; }) });
} else if (cmd === "apply_patches") {
  await applyPatchesCmd();
} else if (cmd === "site_build") {   // THE PIPELINE for a website clone, made by the harness (no script for the model to skip): a design worker + per screens file a brief worker (lookup-page) and a builder that depends ONLY on its own brief; the plan runner starts every task the moment its dependencies are done, 4 at a time.
  // `site_build --dir run_test/<project> --ref <store>[,<store2>] --request "<the person's words>"` -> returns plan_id; follow it with `plan_status --plan <id> --wait 60`
  const proj = projPath(flag("dir") ?? "."), refs = (flag("ref") ?? "").split(",").map((x) => x.trim().replace(/[^\w.-]+/g, "-")).filter(Boolean), request = (flag("request") ?? "the page as in the reference").slice(0, 600);
  let routes: { id: string; label?: string; file?: string }[] = []; try { routes = JSON.parse(readFileSync(join(proj, "proto.json"), "utf8")).routes; } catch { /* checked below */ }
  const rel = proj.slice(resolve(cwd).length + 1), R = (x: string) => `run_test/_ref/${refs[0]}/${x}`;
  if (!inWs(proj) || !routes.length || !refs.length || !existsSync(join(cwd, "run_test", "_ref", refs[0]!, "STORE.md"))) out({ ok: false, reason: "needs --dir run_test/<project> made by proto_init (proto.json) and --ref <store made by ref_capture> (run_test/_ref/<name>/STORE.md); several stores: --ref a,b (the first one receives the briefs)" });
  else {
    const stores = refs.map((r) => `run_test/_ref/${r}/`).join(" and "), byFile = new Map<string, typeof routes>(); for (const r of routes) byFile.set(r.file ?? "main", [...(byFile.get(r.file ?? "main") ?? []), r]);
    const tasks: PlanTask[] = [], first = [...byFile.keys()][0];
    for (const [f, pages] of byFile) {   // ONE lookup call per screens file (the first one also writes the design system: no extra call for it) + ONE builder per screens file that depends only on its own brief
      const design = f === first;
      tasks.push({ id: `brief-${f}`.slice(0, 24), role: "lookup", output: "REPORT line with the files", boundaries: "write only the files named here; terse; original copy only; every link target must be a route of PROTO.md", writes: [R(`briefs/BRIEF_${f}.md`), ...(design ? [R("briefs/BRIEF.md")] : []), ...pages.map((p) => R(`layouts/${p.id}.md`))],
        objective: `Pages ${pages.map((p) => p.label ?? p.id).join(" and ")} (screens file ${f}). Write ${pages.map((p) => `layouts/${p.id}.md`).join(" and ")} and briefs/BRIEF_${f}.md${design ? ", and ALSO briefs/BRIEF.md = the design system of the whole site" : ""}. Stores: ${stores}; project ${rel}/. Request: ${request}` });
      tasks.push({ id: `build-${f}`.slice(0, 24), role: "builder", deps: [`brief-${f}`.slice(0, 24)], output: "REPORT line with the files", boundaries: `write only ${rel}/js/screens/${f}.js and ${rel}/css/pages-${f}.css`, writes: [`${rel}/js/screens/${f}.js`, `${rel}/css/pages-${f}.css`],
        objective: `Pages ${pages.map((p) => p.label ?? p.id).join(" and ")} (screens file js/screens/${f}.js). Build exactly what briefs/BRIEF_${f}.md says (your complete context; briefs/BRIEF.md is the design system: read it when it exists). Store ${stores}; project ${rel}/. Request: ${request}` });
    }
    const nf = byFile.size, eta = Math.round(2 + 1.5 + 0.5 * Math.max(0, nf - 2)), expected = `about ${eta}-${eta + 2} min in total: the ${nf} brief call(s) run together (~1.5-2.5 min), each builder starts when ITS brief is done (~1-2 min each, overlapping), then your checks (~1 min). Nothing to do meanwhile: poll plan_status with --wait 300; do not start other agents.`;
    let o: unknown;
    store.tx(() => {
      const owner = store.agent(task, me), v = validatePlan(tasks, defs, owner?.name ?? "lead", policy, store, task);
      if (!v.ok) { store.ev("plan.rejected", task, me, { errors: v.errors.length }); o = { ok: false, errors: v.errors }; return; }
      const plan_id = "plan" + (store.plans.filter((p) => p.task_id === task).length + 1);
      store.plans.push({ task_id: task, plan_id, owner: me, waves: v.waves, status: "running", created: Date.now(), tasks: tasks.map((t) => ({ ...t, status: "pending" as const })) });
      store.ev("plan.submitted", task, me, { plan_id, tasks: tasks.length, waves: v.waves.length }); o = { ok: true, plan_id, tasks: tasks.map((t) => `${t.id} (${t.role}${t.deps ? " after " + t.deps.join(",") : ""})`), waves: v.waves, expected };
    });
    if ((o as { ok: boolean }).ok) { if (!E.HARNESS_PLAN_DRY) spawn("bun", ["--smol", join(HDIR, "tools.ts"), "_plan", "--plan", (o as { plan_id: string }).plan_id], { detached: true, stdio: "ignore", env: process.env }).unref(); (o as Record<string, unknown>).next = `The pipeline runs by itself (briefs and builds overlap, 4 at a time). Follow it: plan_status --plan ${(o as { plan_id: string }).plan_id} --wait 300 (repeat while it is running; no other calls meanwhile). When it is done start the checks together: ref_compare --async, site_audit --async, preview --async, then wait --any --agents <job ids>.`; }
    out(o);
  }
} else if (cmd === "plan_submit") {
  let tasks: PlanTask[];
  try { tasks = JSON.parse(flag("tasks") ?? "[]"); } catch (e) { out({ ok: false, errors: ["--tasks is not valid JSON: " + String(e).slice(0, 80)] }); process.exit(0); }
  tasks = tasks.map((x) => (x.writes?.length ? { ...x, writes: relWrites(x.writes, [cwd, realCwd]) } : x));   // the overlap check compares like with like
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
  store.tx(() => { const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan")); if (!p) { o = { ok: false, reason: "no such plan; submit it first" }; return; } if (p.status !== "submitted") { o = { ok: false, reason: `plan is ${p.status}` }; return; } p.status = "running"; o = { ok: true, plan_id: p.plan_id, started: true, note: "use plan_status --plan <id> --wait 300" }; });
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
    p.tasks = r.tasks; reopenGates(p) /* a passed phase with new open work is not passed any more */; p.version = v; (p.changes ??= []).push({ v, t: Date.now(), by: me, reason, summary: r.summary });
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
    const asker = t.agent_id ? store.agent(task, t.agent_id) : undefined;
    if (asker) { asker.needs_parent = null; asker.activity = "answer received, continuing"; }   // the question IS answered: a stale needs_parent made plan_status / wait report "STOPPED and asks you" and return at once, every time, until the scheduler's next tick (a paid poll each)
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
  const limit = waitSeconds(Number(flag("wait") ?? 0)) * 1000, t0 = Date.now(), find = () => store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan"));
  const phaseKey = (pl: NonNullable<ReturnType<typeof find>>) => [...new Set(pl.tasks.map((t) => t.phase).filter((n): n is number => typeof n === "number"))].sort((a, b) => a - b).filter((n) => pl.tasks.filter((t) => t.phase === n).every((t) => t.status === "done")).join(","), failedKey = (pl: NonNullable<ReturnType<typeof find>>) => pl.tasks.filter((t) => t.status === "failed" || t.status === "skipped").map((t) => t.id).join(",");
  const p0 = find(), k0 = p0 ? phaseKey(p0) : "", f0 = p0 ? failedKey(p0) : "";
  for (;;) { store.reload(); const urgent = await monitorTick(); const p = find(); if (!p || ["done", "failed", "aborted"].includes(p.status) || Date.now() - t0 > limit || urgent || phaseKey(p) !== k0 || failedKey(p) !== f0) break; await sleep(1200); }   // ends EARLY on: the plan ending, a phase completing (the gate is the lead's), a failed task, or an agent that needs the lead
  const p = find();
  out(p ? { plan_id: p.plan_id, status: p.status, ...attentionSpread(), progress: `${p.tasks.filter((t) => t.status === "done").length}/${p.tasks.length} tasks done, ${p.tasks.filter((t) => t.status === "running").length} running`, elapsed_s: Math.round((Date.now() - p.created) / 1000), advice: p.status === "running" ? "healthy: nothing to do but wait; poll again with --wait 300 (it returns early when something needs you) (do not start other agents, they would only queue behind the pipeline)" : undefined, waves: p.waves, tasks: p.tasks.map((t) => ({ id: t.id, role: t.role, status: t.status, agent_id: t.agent_id, error: t.error, question: t.question, answer: t.status === "done" ? store.reports.find((r) => r.id === t.report_id)?.summary.slice(0, 500) : undefined })) } : { ok: false, reason: "no such plan" });
} else if (cmd === "phase_status") {   // the phases of a plan: state, done/total, gate evidence, what blocks the next one
  store.reload(); const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan"));
  out(p ? { ok: true, plan_id: p.plan_id, phases: phaseRows(p), note: "a task of phase N+1 starts only after phase N is finished AND its gate is passed (phase_pass)" } : { ok: false, reason: "no such plan" });
} else if (cmd === "phase_pass") {   // the EXIT CHECK of a phase is done: record the gate so the scheduler may start the next phase. Refused while work is open or an earlier phase is not passed. The gate never runs QA: asking the QA agent is the master's choice.
  let o: unknown;
  store.tx(() => {
    const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan")), n = Number(flag("phase"));
    if (!p) { o = { ok: false, reason: "no such plan" }; return; }
    if (!Number.isInteger(n)) { o = { ok: false, reason: "--phase must be a whole number" }; return; }
    const r = passPhase(p, n, me || "lead", flag("evidence") ?? "");
    if (!r.ok) { store.ev("plan.phase_refused", task, me, { plan_id: p.plan_id, phase: n, errors: r.errors.length }); o = { ok: false, errors: r.errors, note: "the gate stays closed" }; return; }
    if (!r.already) store.ev("plan.phase_passed", task, me, { plan_id: p.plan_id, phase: n });
    try {   // every project that has a memory gets the new phase state in its README (a file write, no check is run)
      const rt = join(cwd, "run_test"), ph = phaseRows(p).map((x) => ({ phase: x.phase, state: x.state })), pb = planBlurb(rt);
      for (const d of memoryProjects(rt)) writeMemory(join(rt, d), { dir: d, phases: ph, planTitle: pb.title, planBlurb: pb.blurb });
    } catch { /* the memory is a convenience */ }
    o = { ok: true, phase: n, already: r.already, phases: phaseRows(p).map((x) => `${x.phase}:${x.state}`) };
  });
  out(o);
} else if (cmd === "report_bug") {   // ANY agent records a bug or a problem for the admins' bug tracker (UI block "Bug reports"): about ITSELF by default (a tool that failed, a broken plan, a blocker) or about another agent (--agent: stalled, hung, slow, lazy, bad output). The session id and the agent's log file are attached, so nobody has to dig. Append-only admin_issues.jsonl + an `admin.issue` event; the work carries on.
  const ag = flag("agent") || me, text = (flag("text") ?? "").trim(), kind = (flag("kind") ?? "bug").replace(/[^a-z_]/g, "").slice(0, 20) || "bug", sev = ["low", "medium", "high"].includes(flag("severity") ?? "") ? flag("severity")! : "medium";
  if (!text) out({ ok: false, reason: "--text is required: what happened, what you expected, what you did about it" });
  else { const rec = logIssue({ agent: ag, kind, text: text.slice(0, 2000), severity: sev, reporter: me || "unknown", session_id: flag("session") }); out({ ok: true, id: rec.id, logged: "admin_issues.jsonl", session_id: rec.session_id, next: "Recorded in the admin bug tracker with your session id. Carry on with your task: reporting does not stop the work." }); }
} else if (cmd === "admin_issues") {   // the issues reported in this task (or --all tasks of this store), newest last
  const f = join(dirname(file), "admin_issues.jsonl"), rows = existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((x): x is { task: string } => !!x) : [];
  out({ ok: true, issues: rows.filter((r) => rest.includes("--all") || r.task === task).slice(-50) });
} else if (cmd === "agent_peek") {   // read-only look inside an agent: recent tool calls, silence, held files, notes, and a hint (wait / answer / stop)
  store.reload(); const r = peekAgent(store, task, flag("agent") ?? "", Number(flag("n") ?? 8)); out(r);
} else if (cmd === "cost") {   // what the team has spent so far, per agent, against the project budget
  store.reload();
  const per = store.agentsOf(task).map((a) => ({ agent_id: a.agent_id, usd: Number(store.reports.filter((r) => r.task_id === task && r.agent_id === a.agent_id).reduce((s, r) => s + r.cost, 0).toFixed(4)) })).filter((x) => x.usd > 0);
  const total = Number(per.reduce((s, x) => s + x.usd, 0).toFixed(4)); out({ ok: true, total_usd: total, budget_usd: policy.budgetUsd || null, left_usd: policy.budgetUsd ? Number(Math.max(0, policy.budgetUsd - total).toFixed(4)) : null, agents: per });
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
} else if (cmd === "chapter") {   // on-demand details: agents/<role>/chapters/<name>.md of the CALLER first (qa-reviewer: tab, planner: plan_format), then the lead's; the core CLAUDE.md of every agent stays short
  const mine = store.agent(task, me)?.name ?? "lead", dirs = [...new Set([join(AGENTS_DIR, mine, "chapters"), join(AGENTS_DIR, "lead", "chapters")])], n = (flag("name") ?? "").toLowerCase().replace(/[^a-z_]/g, ""), f = dirs.map((d) => join(d, n + ".md")).find((x) => n && existsSync(x)) ?? "";
  const names = [...new Set(dirs.flatMap((d) => existsSync(d) ? readdirSync(d).filter((x) => x.endsWith(".md")).map((x) => x.slice(0, -3)) : []))];
  if (f) { store.reload(); store.ev("chapter.read", task, me, { name: n }); store.save(); out({ ok: true, chapter: n, text: readFileSync(f, "utf8") }); }
  else out({ ok: false, reason: n ? `no chapter '${n}'` : "--name is required", chapters: names });
} else if (cmd === "grep") { out(wsGrep(join(cwd, "run_test"), flag("pattern") ?? "", flag("path")));
} else if (cmd === "ref_capture") {   // REAL reference of a website (raw html + css tokens + screenshots, no model call) for a "ditto" clone, or a screenshot of a local preview to compare: --url <https://..> --name <short-name>
  const url = flag("url") ?? "", nm = (flag("name") ?? new URL(url || "http://x").hostname).replace(/[^\w.-]+/g, "-");
  if (!/^https?:\/\//.test(url)) out({ ok: false, reason: "--url must start with http:// or https://" });
  else {
    const { refCapture } = await import("./core/ref_capture.ts"), { par } = await import("./core/browse.ts");
    const more = (flag("more") ?? "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const [u, n] = x.split("="); return { url: u!, name: (n ?? new URL(u!).pathname.replace(/\W+/g, "-").replace(/^-|-$/g, "") ?? "page").replace(/[^\w.-]+/g, "-") || "page" }; });   // --more "https://x.io=home,https://x.io/blog/post=article": several pages captured AT THE SAME TIME
    const jobs = [{ url, name: nm }, ...more].map((j) => () => refCapture({ url: j.url, name: j.name, dir: join(cwd, "run_test", "_ref", j.name) }));
    const res = await par(jobs); out(res.length === 1 ? res[0] : { ok: res.every((r) => (r as { ok?: boolean }).ok), captured: res });
  }
} else if (cmd === "browser_status" || cmd === "browser_connect" || cmd === "browser_disconnect" || cmd === "browser_launch" || cmd === "browser_toggle") {   // the CONNECTED browser (core/browser_conn.ts): a Chrome a person can see and log in to; agents use it instead of a private headless one
  const bc = await import("./core/browser_conn.ts");
  out(cmd === "browser_toggle" ? await bc.toggle(!rest.includes("--off")) : cmd === "browser_status" ? await bc.status() : cmd === "browser_disconnect" ? bc.disconnect() : cmd === "browser_connect" ? await bc.connect(flag("url") ?? `http://127.0.0.1:${flag("port") ?? 9222}`) : await bc.launch(Number(flag("port") ?? 9222), flag("open") ?? "about:blank"));
} else if (cmd === "ref_assets") {   // pull the pictures a captured reference uses (logo, hero, icons, favicon, css backgrounds) into run_test/_ref/<name>/assets/ + assets.json (no model call): --name <name used in ref_capture> [--max 30]
  const nm = (flag("name") ?? "").replace(/[^\w.-]+/g, "-"), rd = join(cwd, "run_test", "_ref", nm);
  if (!nm || !(existsSync(join(rd, "raw", "page.html")) || existsSync(join(rd, "page.html")))) out({ ok: false, reason: "--name must be a reference made by ref_capture (run_test/_ref/<name>/raw/page.html)" });
  else { const { refAssets } = await import("./core/ref_assets.ts"); out(await refAssets({ dir: rd, max: Number(flag("max") ?? 30) })); }
} else if (cmd === "site_audit") {   // the real browser checks OUR OWN site (a project folder or a url) and lists what to improve: --dir run_test/<p> | --url <https://..> [--name <n>]
  const { siteAudit, projectRoutes } = await import("./core/site_audit.ts"), u = flag("url"), proj = u ? "" : projPath(flag("dir") ?? ".");
  if (!u && (!inWs(proj) || !existsSync(join(proj, "index.html")))) out({ ok: false, reason: "give --dir run_test/<project> (with index.html) or --url https://.." });
  else { const nm = (flag("name") ?? (u ? new URL(u).hostname : proj.split("/").pop()!)).replace(/[^\w.-]+/g, "-"); out(await siteAudit({ base: u ?? "file://" + join(proj, "index.html"), routes: u ? [] : projectRoutes(proj), outDir: join(cwd, "run_test", "_audit", nm), name: nm })); }
} else if (cmd === "ref_store") {   // (re)build the index STORE.md and the mind map MAP.md of a reference store after anything was added (layouts, briefs, assets): --name <name>
  const nm = (flag("name") ?? "").replace(/[^\w.-]+/g, "-"), rd = join(cwd, "run_test", "_ref", nm);
  if (!nm || !existsSync(rd)) out({ ok: false, reason: "no such reference store: run_test/_ref/<name>" });
  else { const { buildStore } = await import("./core/ref_store.ts"); out({ ...buildStore(rd, nm), note: "STORE.md and MAP.md rebuilt" }); }
} else if (cmd === "browse") {   // a REAL browser (Chrome DevTools Protocol): --url <http(s)://..> | --file run_test/<p>/index.html [--route "/blog"] [--scheme light|dark] [--mobile] [--shots <prefix>] [--out <folder in run_test, default _shots>] [--steps '[{"name":"open menu","click":"Menu"},{"scroll":900},{"click":"Features"},{"shot":"a.png"},{"eval":"document.title"},{"outline":true}]']
  const { browse } = await import("./core/browse.ts"), { mkdirSync } = await import("node:fs"), f = flag("file"), isQa = /^qa-reviewer#/.test(me),
    // a QA agent works in ONE session folder (one report, one video, at most two pictures): `browse` is no way around that (it used to add a full-page picture and up to 12 section pictures in a folder of its own)
    outRel = isQa ? me.replace(/[^\w-]+/g, "-") : (flag("out") ?? "browse"), outDir = mediaOut(outRel) ?? "", wantVideo = rest.includes("--video"), vOff = wantVideo ? videoOff() : undefined;   // evidence goes to the REAL workspace (a QA agent works in a copy that is deleted)
  const ff = f ? projPath(f.replace(/\/?index\.html$/, "") || ".") : "", url = flag("url") ?? (f ? "file://" + join(ff, "index.html") + "#" + (flag("route") ?? "/") : "");
  if (!outDir) out({ ok: false, reason: "--out must be a plain folder name (for example --out eiffel-flows): evidence is stored in the session's store/qa folder" });
  else if ((!url && !flag("tab")) || (f && !inWs(ff))) out({ ok: false, reason: "give --url https://.. or --file run_test/<project>/index.html (inside the workspace)" });
  else { mkdirSync(outDir, { recursive: true }); let steps: unknown[] = []; try { steps = JSON.parse(flag("steps") ?? "[]"); } catch { /* none */ }
    const pre = flag("shots"), r = vOff ? { ok: false, reason: vOff, shots: [], results: [], console: [] } as Awaited<ReturnType<typeof browse>> : await browse({ video: wantVideo, url, tab: flag("tab"), clean: rest.includes("--no-clean") ? false : rest.includes("--clean") ? true : undefined, outDir, scheme: flag("scheme") === "dark" ? "dark" : "light", mobile: rest.includes("--mobile"), steps: steps as never, sectionShots: pre && !isQa ? 12 : 0, images: isQa ? imagesOn(join(realCwd, "run_test")) : undefined, tag: pre ?? "page" });
    out({ ok: r.ok, reason: r.reason, browser: r.via === "connected" ? "connected Chrome (visible)" : "private headless Chrome (invisible)", cleaned: r.cleaned?.length ? r.cleaned : undefined, pictures_in: `run_test/${outRel}/ (open them with Read)`, report: r.report ? join(outDir, "index.html") : undefined, steps: r.steps?.map((x) => `${x.n} ${x.ok ? "OK" : "FAIL"} ${x.name}${x.video_s !== undefined ? " @" + x.video_s + "s" : ""} -> ${join(outDir, x.shot ?? "")}`), video: r.video ? join(outDir, r.video.split("/").pop()!) : undefined, video_note: r.video_note, pictures: r.shots.map((x) => join(outDir, x.split("/").pop()!)), results: r.results, console_errors: r.console, outline: r.outline ? { theme: r.outline.theme, sections: r.outline.sections.map((x) => `#${x.i + 1} ${x.heading || x.tag} | ${x.cards ? x.cards + " cards" : "-"} | btn ${x.buttons.length} | img ${x.images}${x.animated ? " | animated" : ""}`), nav: r.outline.nav, fonts: r.outline.fonts } : undefined }); }
} else if (cmd === "tab") {   // ONE tab per agent, kept open between commands: tab open --url <u> | tab do --steps '[...]' [--video] [--keep-going] [--out <folder>] | tab status | tab close
  const sub = rest[0], tb = await import("./core/tab.ts"), { mkdirSync } = await import("node:fs");
  // ONE evidence folder (one report, one video) per agent, chosen by the tool: a second `--out` name used to start a second report and a second video (sakura, sakura2). `--out` is accepted and ignored.
  const outRel = me.replace(/[^\w-]+/g, "-"), outAsked = flag("out"), outNote = outAsked && outAsked.replace(/^(run_test|store|qa)[\\/]/, "") !== outRel ? `one report and one video per session: your --out ${outAsked} was not used, everything is in ${outRel}` : undefined;
  if (sub === "open") out(await tb.tabOpen({ task, agent: me, url: flag("url"), mobile: rest.includes("--mobile") }));
  else if (sub === "close") { const r = await tb.tabClose({ task, agent: me }), { waitVideos } = await import("./core/browse.ts"), v = await waitVideos(mediaRoot); out({ ...r, ...(v.videos.length ? { videos: v.videos, video_final: !v.pending, video_wait_s: v.waited_s } : {}), ...(v.pending ? { note: "a video is still encoding after 2 minutes: it will appear by itself; do not record it again" } : {}) }); }
  else if (sub === "status") out(await tb.tabStatus({ task, agent: me }));
  else if (sub === "result") {   // the outcome of a background script: tab result [--job <id>] (the newest when none is named)
    const { readdirSync, readFileSync, existsSync } = await import("node:fs"), root = mediaRoot, jobs: { f: string; t: number }[] = [];
    const walk = (d: string, depth = 0) => { try { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory() && depth < 3) walk(p, depth + 1); else if (/^job-[\w]+\.json$/.test(e.name)) jobs.push({ f: p, t: (existsSync(p) ? Number(e.name.match(/job-([\w]+)\.json/)![1] ? parseInt(e.name.match(/job-([\w]+)\.json/)![1]!, 36) : 0) : 0) }); } } catch { /* none */ } }; walk(root);
    const want = flag("job"), pick = want ? jobs.find((j) => j.f.includes("job-" + want + ".json")) : jobs.sort((a, b) => b.t - a.t)[0];
    out(pick ? JSON.parse(readFileSync(pick.f, "utf8")) : { ok: false, reason: "no background job found: start one with `tab do --background --steps ...`" });
  } else if (sub === "do") {
    let steps: unknown[] = []; try { steps = JSON.parse(flag("steps") ?? "[]"); } catch { out({ ok: false, reason: "--steps must be a JSON array" }); }
    const vOff = rest.includes("--video") ? videoOff() : undefined, outDir = mediaOut(outRel) ?? "", bgJob = flag("job-file");
    if (!outDir) out({ ok: false, reason: "--out must be a plain folder name (for example --out eiffel-flows)" });
    else if (rest.includes("--background") && !bgJob) {   // QUEUE: hand the script to a worker and go on at once; scripts of one tab run one after the other; the answer is in `tab result`
      const { spawn } = await import("node:child_process"), { writeFileSync } = await import("node:fs"), id = Date.now().toString(36), jf = join(outDir, `job-${id}.json`); mkdirSync(outDir, { recursive: true });
      writeFileSync(jf, JSON.stringify({ job: id, status: "queued", at: new Date().toISOString() }));
      spawn("bun", ["--smol", join(HDIR, "tools.ts"), ...process.argv.slice(2).filter((x) => x !== "--background" && x !== "--clear"), "--job-file", jf, "--keep-going"], { detached: true, stdio: "ignore", env: process.env }).unref();
      out({ ok: true, job: id, status: "queued", note: "running in the background; you can do other things. Read the outcome with `tab result --job " + id + "` (steps stop at nothing: every step is tried, failures are listed)", result_file: jf, folder: outDir });
    } else { if (rest.includes("--clear") && !bgJob && tb.clearOnce({ task, agent: me, dir: outDir })) (await import("node:fs")).rmSync(outDir, { recursive: true, force: true });   // start this folder clean: the old pictures, video and report of that name are removed first
      mkdirSync(outDir, { recursive: true });
      const { writeFileSync, existsSync, readFileSync, rmSync } = await import("node:fs"), lock = join((await import("node:os")).tmpdir(), `agent-tab-${task}-${me || "agent"}`.replace(/[^\w.-]+/g, "_") + ".lock"), put = (o: unknown) => { if (bgJob) writeFileSync(bgJob, JSON.stringify(o, null, 1)); else out(o); };
      if (bgJob) { mkdirSync(dirname(lock), { recursive: true }); const alive = (p: number) => { try { process.kill(p, 0); return true; } catch { return false; } };   // one script at a time on a tab: wait for the one before
        for (let i = 0; i < 600; i++) { try { writeFileSync(lock, String(process.pid), { flag: "wx" }); break; } catch { try { if (!alive(Number(readFileSync(lock, "utf8")))) rmSync(lock, { force: true }); } catch { /* raced */ } await new Promise((r) => setTimeout(r, 300)); } }
        writeFileSync(bgJob, JSON.stringify({ status: "running", at: new Date().toISOString() })); }
      try { const r = await tb.tabDo({ task, agent: me, steps: steps as never, outDir, video: rest.includes("--video") && !vOff, tag: flag("name") ?? outRel.split("/").pop() ?? "tab", keepGoing: rest.includes("--keep-going"), images: imagesOn(join(realCwd, "run_test")) });
        const snap = r ? [...r.results].reverse().find((x) => (x as { snapshot?: unknown }).snapshot) as { snapshot?: unknown } | undefined : undefined, keep = r ? r.results.filter((x) => { const y = x as Record<string, unknown>; return y.eval !== undefined || y.why !== undefined || y.error !== undefined || y.found === false; }) : [];
        put(!r ? { ok: false, status: "done", reason: "no tab is open for you: run `tab open --url <address>` first" } : { ok: r.ok, status: "done", reason: r.reason, failed: r.failed, not_run: r.not_run, folder_note: outNote, pictures: pictureFiles(outDir), report: r.report ? join(outDir, "index.html") : undefined, video: r.video ? join(outDir, "session.webm") : undefined, video_note: vOff ?? undefined, steps: r.steps?.map((x) => `${x.n} ${x.ok ? "OK" : "FAIL"} ${x.name}${x.video_s !== undefined ? " @" + x.video_s + "s" : ""}${x.note ? " (" + x.note + ")" : ""}${x.shot ? " -> " + join(outDir, x.shot) : ""}`), page: snap?.snapshot, results: keep.length ? keep : undefined, console_errors: r.console.length ? r.console : "none" });
      } finally { if (bgJob) rmSync(lock, { force: true }); } }
  } else out({ ok: false, reason: "tab open --url <u> | tab do --steps '[...]' [--background] | tab result | tab status | tab close" });
} else if (cmd === "ref_compare") {   // does the clone match the reference captured by ref_capture? --ref <name> --dir run_test/<project> [--route "/"]
  const nm = flag("ref") ?? "", proj = projPath(flag("dir") ?? "."), dirRel = proj.slice(resolve(cwd).length + 1), idx = join(proj, "index.html");
  if (!nm || !inWs(proj) || !existsSync(idx)) out({ ok: false, reason: "--ref <name used in ref_capture> and --dir run_test/<project> (with index.html) are required" });
  else { const { refCompare } = await import("./core/ref_compare.ts"); out(await refCompare({ refDir: join(cwd, "run_test", "_ref", nm), url: "file://" + idx + "#" + (flag("route") ?? "/"), outDir: mediaOut("ref_compare") ?? join(cwd, "run_test", "_shots") })); }
} else if (cmd === "proto_init") {   // the STARTER of a no-build prototype, made by the harness (no model call): design kit + shell + one stub screen per nav item + PROTO.md. Builders then only write screens.
  const rel = (flag("dir") ?? "").replace(/^run_test[\\/]?/, ""), d = resolve(cwd, "run_test", rel);
  if (!rel || rel.includes("..") || !d.startsWith(resolve(cwd, "run_test") + "/")) out({ ok: false, reason: "--dir must be run_test/<project>" });
  else { const { protoInit, parseNav } = await import("./core/proto_init.ts"); out(protoInit(d, { title: flag("title") ?? rel, nav: parseNav(flag("nav") ?? ""), user: flag("user"), org: flag("org"), rel: "run_test/" + rel, kind: flag("kind") === "site" ? "site" : "app", extra: flag("extra") ? parseNav(flag("extra")!) : undefined, accent: flag("accent"), font: flag("font"), bgDark: flag("bg-dark"), tagline: flag("tagline") })); }
} else if (cmd === "proto_check") {   // a NO-BUILD prototype (index.html + plain scripts + Vue from a CDN): files exist, scripts parse, every screen / component used is defined. No install, no server: under a second.
  const d = projPath(flag("dir") ?? "."); if (!inWs(d)) { out({ ok: false, error: "the folder must be inside the workspace" }); } else { const { protoCheck } = await import("./core/proto_check.ts"); out(protoCheck(d)); }
} else if (cmd === "plan_lint") {   // FREE check that a plan folder can be built from alone (README sections, PHASES with Done-when, one owner per file, CONTEXT.txt, links, placeholders): the planner runs it before it reports
  const d = projPath(flag("dir") ?? "run_test/plan"); if (!inWs(d)) out({ ok: false, error: "the folder must be inside the workspace" }); else { const { lintPlan } = await import("./core/plan_lint.ts"); store.reload(); const fetched = store.events.filter((e) => e.kind === "tool.used" && e.task_id === task && /^Web(Fetch|Search)$/.test(String((e.data as { tool?: string } | undefined)?.tool))).flatMap((e) => String((e.data as { activity?: string } | undefined)?.activity ?? "").match(/https?:\/\/\S+/g) ?? []); out(lintPlan(d, join(cwd, "run_test"), { fetched })); /* fetched = what the team really read: a cited source nobody fetched is flagged */ }
} else if (cmd === "get_public_url") {   // PORT -> the address a PERSON's browser can open (localhost works only on this machine): --port <n> [--id <background task id>] [--path /x]. With --id the port is LINKED to that task (bg_list and the UI then show its addresses); with --id alone the task's port is used. Says whether anything answers on the port right now.
  const pv = await import("./core/preview.ts"), bgm = await import("./core/bg.ts"), sdir = dirname(file), id = flag("id"); let port = Number(flag("port") ?? 0), linked: string | undefined;
  if (!port && id) port = bgm.getBg(sdir, id)?.port ?? 0;
  else if (port && id) linked = bgm.linkPort(sdir, id, port) ? id : undefined;
  if (!port) out({ ok: false, reason: "give --port <n> (and --id <background task id> to link it to that task), or --id of a task that has a port" });
  else {
    const path = (flag("path") ?? "").replace(/^(?!\/)(.+)/, "/$1"), local = `http://127.0.0.1:${port}${path}`; let reachable = false;
    try { reachable = (await fetch(local, { signal: AbortSignal.timeout(2500) })).status < 500; } catch { /* nothing there */ }
    out({ ok: true, port, url: local, public_url: `http://${pv.publicHost()}:${port}${path}`, reachable, linked_task: linked, note: reachable ? "Give public_url to the person; url works only on this machine." : "Nothing answers on that port right now: start the server first (bg_start --port auto) or read bg_log." });
  }
} else if (cmd === "proc_list" || cmd === "proc_stop") {   // the host processes inside THIS workspace (dev servers, installs, leftover shells): any agent of the team may look at them and stop one (core/procs.ts)
  const pc = await import("./core/procs.ts");
  out(cmd === "proc_list" ? { ok: true, processes: pc.listTaskProcs(cwd) } : pc.stopTaskProc(cwd, Number(flag("pid"))));
} else if (cmd === "bg_start" || cmd === "bg_list" || cmd === "bg_log" || cmd === "bg_stop" || cmd === "bg_restart") {
  // BACKGROUND TASKS (core/bg.ts): `cmd &` with a record = a title (kind, default server_run), a description, a status and a log file. ANY command: a dev server, a static server for a wireframe, a back end, a watcher, a long build.
  // The harness does not know or decide what it runs: no project detection, no install, no page check, no time limit unless --timeout. The agent chooses the command and the folder; it looks at a web page with `browse`.
  const bgm = await import("./core/bg.ts"), pv = await import("./core/preview.ts"), sdir = dirname(file), by = flag("by") ?? (me || "agent"), iso = (t?: number) => (t ? new Date(t).toISOString() : undefined);
  const brief = (r: import("./core/bg.ts").BgRow) => ({ id: r.id, title: r.title ?? "server_run", description: r.label, status: r.status, cmd: r.cmd.slice(0, 200), dir: r.dir, pid: r.pid, port: r.port, url: r.port ? `http://127.0.0.1:${r.port}` : undefined, public_url: r.port ? `http://${pv.publicHost()}:${r.port}` : undefined, started: iso(r.started), ended_at: iso(r.ended_at), exit_code: r.exit_code, stopped_by: r.stopped_by, log_file: bgm.bgLogFile(sdir, r.id), log_bytes: r.log_bytes });
  if (cmd === "bg_list") { const rows = bgm.listBg(sdir, { all: rest.includes("--all") }); out({ ok: true, tasks: rows.map(brief), note: rest.includes("--all") ? undefined : "only the running ones; --all adds the finished ones" }); }
  else if (cmd === "bg_log") { const r = bgm.getBg(sdir, flag("id") ?? ""); out(r ? { ok: true, id: r.id, status: r.status, exit_code: r.exit_code, log_file: bgm.bgLogFile(sdir, r.id), log: bgm.bgLog(sdir, r.id, Number(flag("tail") ?? 60)) ?? "" } : { ok: false, reason: "no such background task" }); }
  else if (cmd === "bg_stop") out(bgm.stopBg(sdir, flag("id") ?? "", by));
  else if (cmd === "bg_restart") { const r = await bgm.restartBg(sdir, flag("id") ?? "", by); const row = "id" in r ? bgm.getBg(sdir, r.id) : undefined; out(row ? { ok: true, ...brief(row) } : { ok: false, reason: "reason" in r ? r.reason : "could not restart" }); }
  else {   // bg_start --cmd "<shell command>" [--dir <folder, default run_test>] [--label "<description>"] [--port auto|<n>] [--timeout <min>] [--wait <sec>]
    const command = flag("cmd") ?? "", dirArg = flag("dir"), full = dirArg ? projPath(dirArg, ".") : join(cwd, "run_test");
    if (!command.trim()) out({ ok: false, reason: '--cmd "<shell command>" is required' });
    else if (!inWs(full)) out({ ok: false, reason: "--dir must be a folder inside the workspace" });
    else {
      mkdirSync(full, { recursive: true });
      const pf = flag("port"), port = pf === "auto" ? await bgm.freePort(Number(pv.cfg("PREVIEW_PORT_FROM", "5300")), Number(pv.cfg("PREVIEW_PORT_TO", "5399"))) : pf && Number(pf) > 0 ? Number(pf) : undefined;
      const tmo = Number(flag("timeout") ?? 0), m = bgm.startBg(sdir, { task, cmd: command, dir: full, by, title: flag("title"), label: flag("label") ?? flag("description"), port, publicHost: port ? pv.publicHost() : undefined, timeoutMin: tmo > 0 ? tmo : undefined });
      const wait = Number(flag("wait") ?? 0); let ready: boolean | undefined;
      if (wait > 0 && port) ready = (await bgm.waitReady(sdir, m.id, `http://127.0.0.1:${port}/`, wait)).ready;
      else if (wait > 0) { for (let i = 0; i < wait && bgm.getBg(sdir, m.id)?.status === "running"; i++) await new Promise((ok) => setTimeout(ok, 1000)); }
      const row = bgm.getBg(sdir, m.id)!;
      out({ ok: true, ...brief(row), ready, ...(wait > 0 ? { log: bgm.bgLog(sdir, m.id, 20) ?? "" } : {}), next: port ? "Open the url with browse (public_url is for a person's browser). bg_log shows its output." : "bg_list / bg_log show it; bg_stop ends it." });
    }
  }
} else out({ ok: false, reason: `unknown command ${cmd}` });
