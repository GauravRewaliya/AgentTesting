// Copies the Experiment runner's sessions (f1_multiagent/ui/.ui-data via experiment.ts) into .state (types: @core/state2/types.ts). The f1 ui folder itself stays untouched.
// The fixture runner (core/run.ts) does not need this: it writes .state directly (core/state2/record.ts).
import { currentWorkspace } from "@core/paths.ts";
import { openWorkspace, writeSession } from "@core/state2/store.ts";
import type { AgentRec, SessionRec, TurnRec } from "@core/state2/types.ts";
import { STATE2_VERSION } from "@core/state2/types.ts";
import { caseResult, live, sessionEvents } from "./experiment.ts";

const now = () => Date.now();
const ws = () => currentWorkspace();
const workspace = () => openWorkspace(ws(), "core/run.ts + f1 testrun");

/** 2nd runner: one live session of the Experiment page -> one session (same task id) */
export async function syncExperimentSession(task: string): Promise<boolean> {
  const s = live().find((x) => x.task === task); if (!s) return false;
  const w = workspace(), res = s.case ? await caseResult(s.case) : null;
  const rec1 = (a: NonNullable<typeof s.master>, level: number): AgentRec => ({ label: a.id, agent_id: a.id, role: a.name, caller: a.caller, level, claude_session: a.session ?? null, status: a.status, fixture: a.fixture ? "agent_fixture" : null, cost: a.cost, runs: a.runs });
  const turns: TurnRec[] = (res?.turns ?? []).map((t, i) => ({ n: i + 1, expected: t.expected.map((e) => e.kind + ":" + e.role), actual: t.calls.map((c) => c.kind + ":" + c.role), match: t.match, guard: !!t.guard, notfound: false, calls: t.calls.length, cost: 0 }));
  const verdict = !res ? "not_run" : res.state === "pass" ? "pass" : res.state === "fail" ? "fail" : "partial";
  const rec: SessionRec = { version: STATE2_VERSION, task, workspace: w, parent: null, runner: "experiment", case: s.case, suite: s.suite, title: s.title, state: s.state === "stalled" ? "stalled" : s.state === "active" ? "idle" : "running", verdict, master: s.master ? rec1(s.master, 1) : null, agents: s.agents.map((a) => rec1(a, a.level)), turns, cost: s.cost, workspace_files: 0, created: s.last, updated: now(), source: { kind: "ui-data", path: "test_harness/core/orchistraitor/f1_multiagent/ui/.ui-data/store.json", note: "copied; the f1 ui folder is not modified" } };
  writeSession(rec, sessionEvents(task).map((e) => ({ t: e.t, kind: e.kind, agent: e.agent, data: e.data })));
  return true;
}
/** copy every live Experiment session into .state (the fixture runner, core/run.ts, writes .state itself) */
export async function syncAll() {
  let experiment = 0;
  for (const s of live()) if (await syncExperimentSession(s.task).catch(() => false)) experiment++;
  return { workspace: ws(), experiment };
}
