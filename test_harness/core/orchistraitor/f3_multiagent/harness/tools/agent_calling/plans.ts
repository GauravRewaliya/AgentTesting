// COMMANDS: plan_* and phase_*: submit, run, replan, answer, pause, show, status, the phase gates, plan_lint.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { relWrites } from "../../core/rel_writes.ts";
import { stopAgent } from "../../core/agent_call.ts";
import { say } from "../../core/board.ts";
import { replan, validatePlan, type PlanTask } from "../../core/plan.ts";
import { passPhase, phaseRows, reopenGates } from "../../core/phases.ts";
import { waitSeconds } from "../../core/monitor.ts";
import { memoryProjects, planBlurb, writeMemory } from "../../core/loops_ai.ts";
import { HDIR, attentionSpread, cmd, cwd, defs, file, flag, inWs, locks, me, monitorTick, out, policy, projPath, realCwd, sleep, store, task } from "../ctx.ts";
import { execPlan } from "./core.ts";

export const COMMANDS = ["plan_submit", "plan_run", "_plan", "plan_replan", "plan_answer", "plan_pause", "plan_resume", "plan_show", "plan_status", "phase_status", "phase_pass", "plan_lint"];
export async function run(): Promise<void> {
if (cmd === "plan_submit") {
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
}
if (cmd === "plan_run") {
  let o: unknown;
  store.tx(() => { const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan")); if (!p) { o = { ok: false, reason: "no such plan; submit it first" }; return; } if (p.status !== "submitted") { o = { ok: false, reason: `plan is ${p.status}` }; return; } p.status = "running"; o = { ok: true, plan_id: p.plan_id, started: true, note: "use plan status --plan <id> --wait 300" }; });
  if ((o as { ok: boolean }).ok) spawn("bun", ["--smol", join(HDIR, "tools.ts"), "_plan", "--plan", flag("plan")!], { detached: true, stdio: "ignore", env: process.env }).unref();
  out(o);
}
if (cmd === "_plan") {
  await execPlan(flag("plan")!);
}
if (cmd === "plan_replan") {
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
}
if (cmd === "plan_answer") {   // the parent answers an agent that stopped to ask: the SAME agent continues with the answer
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
}
if (cmd === "plan_pause" || cmd === "plan_resume") {
  let o: unknown;
  store.tx(() => { const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan")); if (!p) { o = { ok: false, reason: "no such plan" }; return; } p.paused = cmd === "plan_pause"; store.ev(cmd === "plan_pause" ? "plan.paused" : "plan.resumed", task, me, { plan_id: p.plan_id }); o = { ok: true, plan_id: p.plan_id, paused: p.paused, note: p.paused ? "no NEW task starts; running ones finish" : "tasks start again" }; });
  out(o);
}
if (cmd === "plan_show") {
  store.reload(); const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan"));
  out(p ? { plan_id: p.plan_id, status: p.status, paused: !!p.paused, version: p.version ?? 1, changes: p.changes ?? [], tasks: p.tasks.map((t) => { const a = t.agent_id ? store.agent(task, t.agent_id) : undefined; return { id: t.id, role: t.role, status: t.status, deps: t.deps ?? [], writes: t.writes, objective: t.objective, agent_id: t.agent_id, agent_title: a?.title, agent_status: a?.status, activity: a?.activity, session_id: a?.session_id, note: t.note, error: t.error }; }) } : { ok: false, reason: "no such plan" });
}
if (cmd === "plan_status") {
  const limit = waitSeconds(Number(flag("wait") ?? 0)) * 1000, t0 = Date.now(), find = () => store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan"));
  const phaseKey = (pl: NonNullable<ReturnType<typeof find>>) => [...new Set(pl.tasks.map((t) => t.phase).filter((n): n is number => typeof n === "number"))].sort((a, b) => a - b).filter((n) => pl.tasks.filter((t) => t.phase === n).every((t) => t.status === "done")).join(","), failedKey = (pl: NonNullable<ReturnType<typeof find>>) => pl.tasks.filter((t) => t.status === "failed" || t.status === "skipped").map((t) => t.id).join(",");
  const p0 = find(), k0 = p0 ? phaseKey(p0) : "", f0 = p0 ? failedKey(p0) : "";
  for (;;) { store.reload(); const urgent = await monitorTick(); const p = find(); if (!p || ["done", "failed", "aborted"].includes(p.status) || Date.now() - t0 > limit || urgent || phaseKey(p) !== k0 || failedKey(p) !== f0) break; await sleep(1200); }   // ends EARLY on: the plan ending, a phase completing (the gate is the lead's), a failed task, or an agent that needs the lead
  const p = find();
  out(p ? { plan_id: p.plan_id, status: p.status, ...attentionSpread(), progress: `${p.tasks.filter((t) => t.status === "done").length}/${p.tasks.length} tasks done, ${p.tasks.filter((t) => t.status === "running").length} running`, elapsed_s: Math.round((Date.now() - p.created) / 1000), advice: p.status === "running" ? "healthy: nothing to do but wait; poll again with --wait 300 (it returns early when something needs you) (do not start other agents, they would only queue behind the pipeline)" : undefined, waves: p.waves, tasks: p.tasks.map((t) => ({ id: t.id, role: t.role, status: t.status, agent_id: t.agent_id, error: t.error, question: t.question, answer: t.status === "done" ? store.reports.find((r) => r.id === t.report_id)?.summary.slice(0, 500) : undefined })) } : { ok: false, reason: "no such plan" });
}
if (cmd === "phase_status") {   // the phases of a plan: state, done/total, gate evidence, what blocks the next one
  store.reload(); const p = store.plans.find((x) => x.task_id === task && x.plan_id === flag("plan"));
  out(p ? { ok: true, plan_id: p.plan_id, phases: phaseRows(p), note: "a task of phase N+1 starts only after phase N is finished AND its gate is passed (phase pass)" } : { ok: false, reason: "no such plan" });
}
if (cmd === "phase_pass") {   // the EXIT CHECK of a phase is done: record the gate so the scheduler may start the next phase. Refused while work is open or an earlier phase is not passed. The gate never runs QA: asking the QA agent is the master's choice.
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
}
if (cmd === "plan_lint") {   // FREE check that a plan folder can be built from alone (README sections, PHASES with Done-when, one owner per file, CONTEXT.txt, links, placeholders): the planner runs it before it reports
  const d = projPath(flag("dir") ?? "run_test/plan"); if (!inWs(d)) out({ ok: false, error: "the folder must be inside the workspace" }); else { const { lintPlan } = await import("../../core/plan_lint.ts"); store.reload(); const fetched = store.events.filter((e) => e.kind === "tool.used" && e.task_id === task && /^Web(Fetch|Search)$/.test(String((e.data as { tool?: string } | undefined)?.tool))).flatMap((e) => String((e.data as { activity?: string } | undefined)?.activity ?? "").match(/https?:\/\/\S+/g) ?? []); out(lintPlan(d, join(cwd, "run_test"), { fetched })); /* fetched = what the team really read: a cited source nobody fetched is flagged */ }
}
}
