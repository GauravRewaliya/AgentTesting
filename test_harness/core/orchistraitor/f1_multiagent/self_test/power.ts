// Tests for the "power" layer: phase gates in code, agent_peek, slash commands, project budget. Offline: fake agents, real harness code. No model calls.
//   bun self_test/power.ts
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { results, setSuite, t, writeReport } from "./lib.ts";
import { agentCall, defaultPolicy, type CallReq } from "../harness/core/agent_call.ts";
import { MStore } from "../harness/core/board.ts";
import { passPhase, gateBlock, phaseRows, reopenGates } from "../harness/core/phases.ts";
import { validatePlan, type PlanRow, type PlanTask } from "../harness/core/plan.ts";
import { peekAgent } from "../harness/core/peek.ts";
import { runSlash, slashName, SLASH_COMMANDS } from "../harness/core/slash.ts";
import { HARNESS_DIR, loadDefs } from "../harness/main.ts";

const defs = loadDefs(), pol = defaultPolicy({ agentMaxDepth: 4 });
const T = (id: string, role: string, o: Partial<PlanTask> = {}): PlanTask => ({ id, role, objective: `${id} do the ${role} work number ${id}`, output: "short", boundaries: "stay in scope", ...(role === "builder" ? { writes: [`${id}.html`] } : {}), ...o });
const row = (tasks: Partial<PlanRow["tasks"][number]>[]): PlanRow => ({ task_id: "t", plan_id: "plan1", owner: "lead#1", waves: [], status: "running", created: 0, tasks: tasks.map((x) => ({ role: "builder", objective: "o", output: "o", boundaries: "b", status: "pending", ...x })) as PlanRow["tasks"] });

setSuite("phase gates (pure)");
{
  const p = row([{ id: "a", phase: 1, status: "done" }, { id: "b", phase: 2 }, { id: "c", phase: 3 }, { id: "free" }]);
  t("G1", "a task without a phase is never gated", gateBlock(p, p.tasks[3]!) === null);
  t("G2", "phase 2 task waits when phase 1 is done but its gate is not passed", /gate is not passed/.test(gateBlock(p, p.tasks[1]!)?.reason ?? ""));
  const r = passPhase(p, 1, "lead#1", "tsc ok, qa_check healthy");
  t("G3", "passPhase records the gate and opens phase 2", r.ok && gateBlock(p, p.tasks[1]!) === null && !!p.gates?.[1]);
  t("G4", "phase 3 still waits: phase 2 is not finished", /phase 2 is not finished/.test(gateBlock(p, p.tasks[2]!)?.reason ?? ""));
  const bad = passPhase(p, 2, "lead#1", "ok");
  t("G5", "passing a phase with open tasks, short evidence and no gate-1... is refused with every reason", !bad.ok && bad.errors.some((e) => /open tasks/.test(e)) && bad.errors.some((e) => /--evidence/.test(e)));
  const noQa = passPhase(row([{ id: "x", phase: 1, status: "done" }]), 1, "l", "ran all the checks", false);
  t("G6", "passing is refused while the last qa_check failed", !noQa.ok && noQa.errors.some((e) => /qa_check failed/.test(e)));
  const f = row([{ id: "a", phase: 1, status: "failed" }, { id: "b", phase: 2 }]);
  t("G7", "a failed phase makes later phases dead (skipped, never started)", gateBlock(f, f.tasks[1]!)?.dead === true);
  t("G8", "passing twice is idempotent", (passPhase(p, 1, "l", "again again again") as { already?: boolean }).already === true);
  p.tasks[0]!.status = "pending";
  t("G9", "a replan that reopens phase-1 work reopens the gate", reopenGates(p).includes(1) && !p.gates?.[1]);
  const rows = phaseRows(row([{ id: "a", phase: 1, status: "done" }, { id: "b", phase: 2 }]));
  t("G10", "phase_status states: ready_for_gate then waiting", rows[0]!.state === "ready_for_gate" && rows[1]!.state === "waiting");
}
setSuite("phase validation");
{
  const ok = validatePlan([T("a", "builder", { phase: 1 }), T("b", "builder", { phase: 2, deps: ["a"] })], defs, "lead", pol);
  t("V1", "a phased plan is accepted", ok.ok);
  const back = validatePlan([T("a", "builder", { phase: 1, deps: ["b"] }), T("b", "builder", { phase: 2 })], defs, "lead", pol);
  t("V2", "a task cannot depend on a later phase", !back.ok && back.errors.some((e) => /later phase/.test(e)));
  const num = validatePlan([T("a", "builder", { phase: 0 }), T("b", "builder", { phase: 1.5 })], defs, "lead", pol);
  t("V3", "phase must be a whole number 1..20", !num.ok && num.errors.length >= 2);
}
setSuite("scheduler enforces the gate (fake agents, real tools.ts)");
const dir = mkdtempSync(join(tmpdir(), "pw-")), file = join(dir, "s.json");
{ const st = new MStore(file); const l = st.addAgent("t", defs.get("lead")!, { level: 1 }); l.status = "running"; st.save(); }
const tool = (args: string[], env: Record<string, string> = {}) => new Promise<any>((res) => { const p = spawn("bun", [join(HARNESS_DIR, "tools.ts"), ...args], { env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "fake", HARNESS_MAX_INSTANCES: "8", ...env } }); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => { try { res(JSON.parse(o.trim().split("\n").pop()!)); } catch { res({ raw: o }); } }); });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
{
  const sub = await tool(["plan_submit", "--tasks", JSON.stringify([T("r1", "researcher", { phase: 1, objective: "list the screens of the checkout flow" }), T("r2", "researcher", { phase: 2, objective: "survey the database options for the order service" }), T("r3", "researcher", { phase: 3, objective: "compare hosting providers for deployment" })])]);
  if (!sub.ok) t("S0", "plan accepted", false, JSON.stringify(sub));
  await tool(["plan_run", "--plan", sub.plan_id]); await sleep(4000);
  let s = await tool(["plan_status", "--plan", sub.plan_id]);
  const st = (id: string) => s.tasks.find((x: any) => x.id === id)?.status;
  t("S1", "phase 1 runs by itself; phase 2 and 3 do NOT start while the gate is closed", st("r1") === "done" && st("r2") === "pending" && st("r3") === "pending", JSON.stringify(s.tasks.map((x: any) => x.id + ":" + x.status)));
  const early = await tool(["phase_pass", "--plan", sub.plan_id, "--phase", "2", "--evidence", "tried to skip ahead"]);
  t("S2", "phase_pass for phase 2 is refused (phase 1 gate missing, phase 2 not done)", early.ok === false && early.errors.length >= 2, JSON.stringify(early).slice(0, 200));
  const p1 = await tool(["phase_pass", "--plan", sub.plan_id, "--phase", "1", "--evidence", "exit check: r1 finished and reviewed"]);
  await sleep(4000); s = await tool(["plan_status", "--plan", sub.plan_id]);
  t("S3", "after phase_pass 1, phase 2 starts and finishes; phase 3 still waits", p1.ok && st("r2") === "done" && st("r3") === "pending", JSON.stringify(s.tasks.map((x: any) => x.id + ":" + x.status)));
  await tool(["phase_pass", "--plan", sub.plan_id, "--phase", "2", "--evidence", "exit check: r2 finished and reviewed"]);
  s = await tool(["plan_status", "--plan", sub.plan_id, "--wait", "30"]);
  t("S4", "after phase_pass 2 the plan finishes: every task done, plan done", s.status === "done" && s.tasks.every((x: any) => x.status === "done"), JSON.stringify(s).slice(0, 200));
  const ph = await tool(["phase_status", "--plan", sub.plan_id]);
  t("S5", "phase_status lists three passed/ready phases", ph.ok && ph.phases.length === 3 && ph.phases[0].state === "passed");
}
setSuite("agent_peek, cost, slash commands");
{
  const peek = await tool(["agent_peek", "--agent", "researcher#1"]);
  t("K1", "agent_peek answers for a known agent and says it is not running", peek.ok && peek.agent_id === "researcher#1" && /not running/.test(peek.hint), JSON.stringify(peek).slice(0, 160));
  const st = new MStore(file); const a = st.addAgent("t", defs.get("researcher")!, { level: 2 }); st.tx(() => { a.status = "running"; a.last_event_at = Date.now() - 400_000; a.activity = "Read x.ts"; st.ev("tool.used", "t", a.agent_id, { tool: "Read", activity: "x.ts" }); });
  const pk = peekAgent(new MStore(file), "t", a.agent_id);
  t("K2", "a running agent silent for 400 s is flagged stuck with the advice to nudge or stop", pk.ok && pk.stuck && /stuck/.test(pk.hint) && pk.recent.length === 1);
  t("K3", "agent_peek of an unknown agent is a clear error", (await tool(["agent_peek", "--agent", "nobody#9"])).ok === false);
  const cost = await tool(["cost"], { HARNESS_PROJECT_BUDGET_USD: "5" });
  t("K4", "cost reports total and the budget left", cost.ok && cost.budget_usd === 5 && cost.left_usd === 5 - cost.total_usd);
  const ctx = { store: new MStore(file), task: "t", storeFile: file, cwd: dir, env: { HARNESS_RUNNER: "fake" } };
  t("K5", "slashName knows our commands only: /status yes, a path or /api sentence no", slashName("/status") === "status" && slashName("/peek researcher#1 5") === "peek" && !slashName("/mnt/x/file") && !slashName("/api should list users") && !slashName("hello /status"));
  const help = runSlash(ctx, "/help");
  t("K6", "/help lists every command", Object.keys(SLASH_COMMANDS).every((k) => help.includes("/" + k)));
  const status = runSlash(ctx, "/status");
  t("K7", "/status shows the team, the plan with phases and the spend", /researcher#1/.test(status) && /phases:/.test(status) && /spent \$/.test(status), status.slice(0, 300));
  t("K8", "/phases and /plan and /agents answer", /phase 1/.test(runSlash(ctx, "/phases")) && /PLAN plan1/.test(runSlash(ctx, "/plan")) && /researcher#1/.test(runSlash(ctx, "/agents")));
  t("K9", "/peek without an agent gives usage; with one it answers", /usage/.test(runSlash(ctx, "/peek")) && /researcher#1/.test(runSlash(ctx, "/peek researcher#1")));
  const say = runSlash(ctx, "/say researcher#1 please hurry");
  t("K10", "/say puts a note from the user in the store", JSON.parse(say).ok !== false && new MStore(file).notes.some((n) => n.text === "please hurry" && n.from === "user"), say);
  const pause = runSlash(ctx, "/pause");
  t("K11", "/pause pauses the latest plan through the same tool an agent uses", /"paused":true/.test(pause), pause);
  t("K12", "/resume undoes it", /"paused":false/.test(runSlash(ctx, "/resume")));
  const stop = runSlash(ctx, "/stop " + a.agent_id);
  t("K13", "/stop stops the agent and /stop without an id gives usage", /"ok":true/.test(stop) && /usage/.test(runSlash(ctx, "/stop")), stop);
}
setSuite("project budget");
{
  const st = new MStore(file); const lead = st.agent("t", "lead#1")!; st.tx(() => { lead.status = "running"; });
  st.addReport({ task_id: "t", agent_id: "researcher#1", role: "researcher", round: 1, summary: "x", files: [], cost: 2.5 });
  const req: CallReq = { task_id: "t", caller_agent_id: "lead#1", role: "researcher", session_arg: "new", objective: "budget probe work", output: "x", boundaries: "x" };
  let over: ReturnType<typeof agentCall> | undefined, under: ReturnType<typeof agentCall> | undefined;
  st.tx(() => { over = agentCall(st, defs, defaultPolicy({ agentMaxDepth: 4, budgetUsd: 2 }), req); });
  t("B1", "a call is refused with budget_exceeded once the spend reaches the project budget", over?.ok === false && over.code === "budget_exceeded", JSON.stringify(over).slice(0, 200));
  st.tx(() => { under = agentCall(st, defs, defaultPolicy({ agentMaxDepth: 4, budgetUsd: 10, maxInstancesPerRole: 12 }), req); });
  t("B2", "the same call is allowed while under budget (and always when no budget is set)", under?.ok === true, JSON.stringify(under).slice(0, 200));
}
setSuite("model policy (sonnet everywhere, haiku for small jobs)");
{
  const { modelProblem } = await import("../harness/core/models.ts");
  t("M1", "every real role is sonnet in agent.json (lead, planner, pm, builder, researcher, reviewer, writer, ux-designer, qa-reviewer, package-researcher)", ["lead", "planner", "pm", "builder", "researcher", "reviewer", "writer", "ux-designer", "qa-reviewer", "package-researcher"].every((r) => defs.get(r)?.model === "sonnet"), [...defs].map(([k, v]) => k + ":" + v.model).join(" "));
  t("M2", "haiku is allowed for builder/researcher/writer/package-researcher only; lead, planner, pm, reviewer stay sonnet; unknown names refused", !modelProblem("builder", "haiku") && !modelProblem("researcher", "haiku") && !modelProblem("builder", "sonnet") && !!modelProblem("lead", "haiku") && !!modelProblem("reviewer", "haiku") && !!modelProblem("builder", "opus") && !modelProblem("builder", undefined));
  const v = validatePlan([T("a", "builder", { model: "haiku" }), T("b", "planner", { model: "haiku", deps: ["a"] })], defs, "lead", pol);
  t("M3", "a plan task may ask for haiku on a builder but not on a planner", !v.ok && v.errors.some((e) => /^b: planner always runs on sonnet/.test(e)) && !v.errors.some((e) => /^a:/.test(e)));
  const bad = await tool(["delegate", "--role", "planner", "--session", "new", "--model", "haiku", "--objective", "plan the checkout flow in detail", "--output", "x", "--boundaries", "x"]);
  t("M4", "delegate --model haiku to a planner is refused with the reason", bad.ok === false && /always runs on sonnet/.test(bad.reason), JSON.stringify(bad));
  const good = await tool(["delegate", "--role", "researcher", "--session", "new", "--model", "haiku", "--objective", "look up one short fact about the release process", "--output", "x", "--boundaries", "x"]);
  const call = new MStore(file).calls.find((c) => (c.req as { model?: string } | undefined)?.model === "haiku");
  t("M5", "delegate --model haiku to a researcher runs and the choice is kept on the call record", good.ok !== false && !!call, JSON.stringify(good).slice(0, 200));
}
setSuite("active time (experiment page)");
{
  const { activeMs } = await import("../harness/core/peek.ts");
  const st = new MStore(join(mkdtempSync(join(tmpdir(), "act-")), "s.json")), a = st.addAgent("t", defs.get("lead")!, { level: 1 }), b = st.addAgent("t", defs.get("builder")!, { level: 2 }), c = st.addAgent("t", defs.get("researcher")!, { level: 2 });
  const ev = (kind: string, agent: string, t: number) => { st.ev(kind, "t", agent); st.events[st.events.length - 1]!.t = t; };
  ev("agent.start", a.agent_id, 1000); ev("agent.done", a.agent_id, 11_000);                      // lead 10 s
  ev("agent.start", b.agent_id, 5000); ev("agent.done", b.agent_id, 20_000);                      // builder 5..20 overlaps the lead 5..11
  ev("agent.start", c.agent_id, 30_000); ev("agent.failed", c.agent_id, 32_000);                  // researcher 2 s after a gap
  t("A1", "active time = union of agent work: 1..20 s overlapping once (19 s) + 2 s; the gap 20..30 s does not count", activeMs(st, "t", 100_000) === 21_000, String(activeMs(st, "t", 100_000)));
  b.status = "running"; ev("agent.start", b.agent_id, 40_000);
  t("A2", "a call still running counts up to now", activeMs(st, "t", 45_000) === 26_000, String(activeMs(st, "t", 45_000)));
  b.status = "idle";
  t("A3", "a call that ended without writing back counts only up to the agent's last event, not for ever", activeMs(st, "t", 9_000_000) === 21_000, String(activeMs(st, "t", 9_000_000)));
  t("A4", "a task with no events is 0", activeMs(new MStore(), "none") === 0);
}
const failed = writeReport(join(import.meta.dirname, "power_report.md"), "Power layer: phase gates, agent_peek, slash commands, budget", "Offline: fake agents, real harness code, no model calls.");
process.exit(failed ? 1 : 0);
