// The loop (plan section 7): plan -> build -> review, a reviewer issue goes back to the planner then the builder,
// until satisfied or a person is needed. Replaces the chaining half of coding/stages/stage.ts.
import { brief, markSeen } from "./briefs.ts";
import { callAgent, type CallCtx } from "./call.ts";
import { runChecks } from "./checks.ts";
import { lastJson, norm } from "./parse.ts";
import { decide, stageActive, stagesFor } from "./stages.ts";
import type { AgentDef, AgentRow, Finding, Pipeline, Triage } from "./types.ts";

export interface TaskOpts {
  ctx: CallCtx; pipeline: Pipeline; task_id: string; cwd: string; checkCmd?: string;
  maxRounds?: number; costCap?: number; tier?: number; approved?: boolean;
}
export interface TaskResult { status: "done" | "waiting_person" | "halted"; reason: string; rounds: number; cost: number }

const TRIAGES: Triage[] = ["valid", "conflicts_with_request", "out_of_scope", "duplicate", "needs_person"];

export function roleRow(ctx: CallCtx, task_id: string, role: string, cwd: string): AgentRow {
  const def = [...ctx.defs.values()].find((d: AgentDef) => d.role === role);
  if (!def) throw new Error(`no agent has role ${role}`);
  return ctx.store.agentsOf(task_id).find((a) => a.name === def.name && a.instance_no === 1) ?? ctx.store.addAgent(task_id, def, { cwd });
}

export async function runTask(o: TaskOpts): Promise<TaskResult> {
  const { ctx, task_id, cwd } = o; const store = ctx.store;
  const maxRounds = o.maxRounds ?? o.pipeline.on_issue.max_rounds, tier = o.tier ?? 3;
  let round = 0, cost = 0, plan = "";
  const finish = (status: TaskResult["status"], reason: string): TaskResult => { store.ev("task.end", task_id, undefined, { status, reason, round, cost }); return { status, reason, rounds: round, cost }; };
  store.ev("task.start", task_id, undefined, { tier, maxRounds });

  for (;;) {
    round++;
    const stages = stagesFor(o.pipeline, round, { tier, hasFindings: store.openFindings(task_id).length > 0 });
    let checksOk = true, checkOut = "", builderSummary = "";
    let verdict: { pass: boolean; findings: { text: string; severity?: string }[] } | null = null;
    let before: Finding[] = [];

    for (const role of stages) {
      const row = roleRow(ctx, task_id, role, cwd);
      const base = { store, task_id, row, checkCmd: o.checkCmd };
      let out;
      if (role === "plan") {
        out = await callAgent(ctx, row, cwd, (first) => brief("plan", { ...base, first }), undefined, { round });
      } else if (role === "build") {
        out = await callAgent(ctx, row, cwd, (first) => brief("build", { ...base, first, plan }), undefined, { round });
      } else {
        const c = runChecks(o.checkCmd, cwd); checksOk = c.ok; checkOut = c.out;
        before = store.openFindings(task_id);
        out = await callAgent(ctx, row, cwd, (first) => brief("review", { ...base, first, builderSummary, checkOut, prevFindings: before }), undefined, { round });
      }
      cost += out.cost;
      if (!out.ok) return finish("halted", `agent_failed: ${row.agent_id} (${out.error})`);
      markSeen(store, task_id, row);
      const rep = store.addReport({ task_id, agent_id: row.agent_id, role, round, summary: out.reply.slice(0, 400), files: [], cost: out.cost });
      row.last_report_id = rep.id;
      if (o.costCap && cost > o.costCap) return finish("halted", `spend_cap (${cost.toFixed(4)} > ${o.costCap})`);

      if (role === "plan") {
        plan = out.reply;
        const tri = lastJson<{ id: string; triage: string }[]>(out.reply, "TRIAGE:") ?? [];
        for (const t of tri) {
          const f = store.findingsOf(task_id).find((x) => x.id === t.id);
          if (f && TRIAGES.includes(t.triage as Triage)) f.triage = t.triage as Triage;
          if (f && (f.triage === "duplicate" || f.triage === "out_of_scope")) f.status = "dropped";
        }
        store.save();
        const blocker = store.openFindings(task_id).find((f) => f.triage === "needs_person" || f.triage === "conflicts_with_request");
        if (blocker) return finish("waiting_person", `${blocker.triage}: ${blocker.text}`);
        if (o.pipeline.approval && !o.approved && round === 1 && stageActive(o.pipeline.approval.when, { tier, hasFindings: false }))
          return finish("waiting_person", "approval_needed: the plan awaits a person");
      } else if (role === "build") {
        const r = lastJson<{ summary?: string; files?: string[] }>(out.reply, "REPORT:");
        builderSummary = r?.summary ?? out.reply.slice(0, 200);
        rep.files = r?.files ?? [];
        const c = runChecks(o.checkCmd, cwd); checksOk = c.ok; checkOut = c.out;
      } else {
        verdict = lastJson(out.reply, "VERDICT:");
        if (!verdict) { store.ev("review.no_verdict", task_id, row.agent_id); verdict = { pass: false, findings: [{ text: "The reviewer gave no verdict line", severity: "major" }] }; }
        rep.summary = JSON.stringify(verdict).slice(0, 400);
      }
    }
    if (!verdict) return finish("halted", "pipeline has no review stage");

    // the checks decide too: a failing check becomes a finding
    const reported = verdict.findings.map((f) => ({ text: f.text, severity: f.severity ?? "major", source: "reviewer" as const }));
    if (!checksOk) reported.push({ text: `Checks failed: ${checkOut.split("\n").slice(0, 3).join(" | ")}`, severity: "blocker", source: "checks" as never });
    const stuck: Finding[] = [], matched = new Set<string>();
    for (const r of reported) {
      const m = before.find((b) => norm(b.text) === norm(r.text));
      if (m) { stuck.push(m); matched.add(m.id); continue; }
      const f = store.addFinding({ task_id, text: r.text, severity: r.severity, source: r.source, triage: "valid", status: "open", round });
      if (verdict.pass && r.severity === "minor") f.status = "dropped";   // a minor note on a pass is recorded, not blocking
    }
    for (const b of before) if (!matched.has(b.id)) b.status = "fixed";
    store.save();
    const d = decide({ pass: verdict.pass, checksOk, open: store.openFindings(task_id), stuck, round, maxRounds });
    store.ev("round.end", task_id, undefined, { round, decision: d.kind, pass: verdict.pass, checksOk, open: store.openFindings(task_id).length, stuck: stuck.length });
    if (d.kind === "done") return finish("done", "satisfied: reviewer passed, checks passed, no open findings");
    if (d.kind === "person") return finish("waiting_person", d.reason);
  }
}
