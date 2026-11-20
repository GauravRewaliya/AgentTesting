// CALLING AGENTS: the machinery behind delegate / fork_all / wait / apply_patches / plan_run (grant a call, start the detached runner, run the callee, apply the patches, run a plan).
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { relWrites } from "../../core/rel_writes.ts";
import { agentCall, type CallReq, type CallRes } from "../../core/agent_call.ts";
import { DockerRunner } from "../../core/base/docker_runner.ts";
import { RealRunner, ScriptRunner, transcriptExistsAnywhere, type Runner } from "../../core/base.ts";
import { SESSION_CAP } from "../../core/session_run.ts";
import { runCallee } from "../../core/callee.ts";
import { hookArgs } from "../../core/hooks_settings.ts";
import { launchDef } from "../../core/launch.ts";
import { applyQueue } from "../../core/patches.ts";
import { depsBlock, replan, type PlanRow } from "../../core/plan.ts";
import { gateBlock } from "../../core/phases.ts";
import { customDef } from "../../core/custom.ts";
import { FixtureGate } from "../../core/fixture_gate.ts";
import { homeLaunch } from "@core/userhome.ts";
import { skillArgs } from "../../core/skills.ts";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { E, HDIR, MAX_WAVE, TOOLS, cmd, cwd, defs, file, flag, locks, me, out, policy, realCwd, sleep, store, task } from "../ctx.ts";


/** A writer called without --writes would be refused by the lock hook on its first Write and cost a second call: default to the run_test/<project> folder the objective names. */
export function withWrites(req0: CallReq): CallReq {
  const req = req0.writes?.length ? { ...req0, writes: relWrites(req0.writes, [cwd, realCwd]) } : req0;
  if (req.writes?.length || !defs.get(req.role)?.writes) return req;
  const sa = req.session_arg ?? "", prev = sa && sa !== "new" && !sa.startsWith("fork:") ? [...store.calls].reverse().find((c) => c.task_id === task && c.callee_agent_id === sa && c.req?.writes?.length) : undefined;   // a RESUMED writer keeps what it was allowed to write (the lead forgot --writes and paid a second call)
  if (prev) return { ...req, writes: prev.req!.writes as string[] };
  const m = /run_test\/[\w.-]+/.exec(req.objective ?? ""); return m ? { ...req, writes: [m[0]] } : req;
}
export function spawnRun(call_id: string) {   // a detached process runs the callee; it survives the Bash call that started it
  spawn("bun", ["--smol", join(HDIR, "tools.ts"), "_run", "--call", call_id], { detached: true, stdio: "ignore", env: process.env }).unref();
}
/** Run one granted call (read from the registry, so a detached process can do it) and start any writer whose locks just freed. */
export async function runCall(call_id: string) {
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
  const def = launchDef(req.model ? { ...defs.get(req.role)!, model: req.model } : defs.get(req.role)!, defs, res.level, policy.agentMaxDepth, join(tmpdir(), "lf-launch"), "team");
  { const h = homeLaunch(req.role); if (h.allow.length) { def.allow = [...def.allow, ...h.allow]; } }   // user integrations ticked for THIS agent (Settings): nothing ticked, nothing added
  const sk = real ? skillArgs(req.role, req.objective ?? "") : { args: [] as string[], names: [] as string[] };   // skills.json: only the skills declared for THIS agent (and matching its hand-over) are mounted
  if (sk.names.length) store.tx(() => store.ev("skills.mounted", task, agent.agent_id, { skills: sk.names }));
  const epoch0 = agent.epoch ?? 0;
  const guard = setInterval(() => { store.reload(); if (store.aborted() || (store.agent(call.task_id, call.callee_agent_id!)?.epoch ?? 0) !== epoch0) runner.killAll?.(); }, 1000);   // the watchdog flag, or a stop (replan / cancel), ends this callee at once
  const r = await runCallee({ store, runner, defs: new Map(defs).set(req.role, def), sessionCap: SESSION_CAP, transcriptExists: real ? (_c, id) => transcriptExistsAnywhere(id) : undefined }, policy, res, req, def,
    { locks: locks.kind === "redis" ? locks : undefined, cwd, writerMode: E.HARNESS_WRITER_MODE === "worktree" ? "worktree" : "shared",
      env: { HARNESS_STORE: file, HARNESS_MAX_DEPTH: String(policy.agentMaxDepth), HARNESS_RUNNER: E.HARNESS_RUNNER ?? "fake", HARNESS_MODELS: E.HARNESS_MODELS ?? "{}",
        HARNESS_WRITER_MODE: E.HARNESS_WRITER_MODE ?? "shared", HARNESS_MAX_INSTANCES: E.HARNESS_MAX_INSTANCES ?? "4", HARNESS_FAKE_DELAY_MS: E.HARNESS_FAKE_DELAY_MS ?? "0", HARNESS_LOCKS_URL: E.HARNESS_LOCKS_URL ?? "", HARNESS_LOCKS_PREFIX: E.HARNESS_LOCKS_PREFIX ?? "lf", HARNESS_LOCK_TTL_MS: E.HARNESS_LOCK_TTL_MS ?? "120000", HARNESS_STRICT: E.HARNESS_STRICT ?? "0", HARNESS_CANARY: E.HARNESS_CANARY ?? "0" },
      extraArgs: () => (real ? [...hookArgs(HDIR), ...homeLaunch(req.role).args, ...sk.args] : []) });
  clearInterval(guard);
  for (const pc of r.promoted) spawnRun(pc);   // the queue driver: a finished writer starts the next waiting one
  return { res, r };
}
/** Put finished writers' files into the project. Runs under the @git lock, so it never collides with an agent running git. */
export async function applyPatchesCmd(): Promise<{ applied: number; rejected: unknown[]; committed: boolean; blocked?: string }> {
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
export async function execPlan(plan_id: string) {
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
export async function grant(req0: CallReq, claim: boolean): Promise<CallRes> {
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
export const lastReport = (agent: string) => [...store.reports].reverse().find((r) => r.task_id === task && r.agent_id === agent);
/** A WEBSITE project (proto.json kit "site") is built by the pipeline (site_build), never by a lone builder: refuse a NEW builder that writes into it until a plan for it exists (a builder that is CONTINUED for a fix is always allowed). Found in a real run: "One file, one builder; skip the lookup to stay fast". */
export function siteGuard(req: CallReq): string | undefined {
  const sa = req.session_arg ?? "new"; if (req.role !== "builder" || !(sa === "new" || sa.startsWith("fork:"))) return undefined;
  const m = /^run_test\/([^/]+)\//.exec((req.writes ?? [])[0] ?? ""); if (!m) return undefined;
  let kit: unknown; try { kit = JSON.parse(readFileSync(join(cwd, "run_test", m[1]!, "proto.json"), "utf8")).kit; } catch { return undefined; }
  const hasRef = (() => { try { return readdirSync(join(cwd, "run_test", "_ref")).some((d) => existsSync(join(cwd, "run_test", "_ref", d, "STORE.md"))); } catch { return false; } })();
  if (!(hasRef && kit !== undefined)) return undefined;   // once a reference was captured, a clone (site OR admin app) is built by the pipeline from briefs, never by a lone builder
  if (store.plans.some((p) => p.task_id === task && p.tasks.some((t) => (t.writes ?? []).some((x) => x.startsWith(`run_test/${m[1]}/`))))) return undefined;
  return `run_test/${m[1]} is a CLONE / website project: its pages are built by the PIPELINE, not by a single builder, so the layouts and briefs exist and several builders work in parallel. Run: site build --dir run_test/${m[1]} --ref <store made by ref capture> --request "<the person's words>"; follow it with plan status --plan <id> --wait 60. (A builder that is already working on it can still be continued with --session <its id> for a fix.)`;
}
