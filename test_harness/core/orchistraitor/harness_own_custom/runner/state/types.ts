// .state/<version>/ = ONE place for the results of every runner (the version is set by hand in core/paths.ts; a new version starts fresh). Layout (see test_harness/ui/STRUCTURE.md):
//   current_pointer.json                                              {"current_workspace":"01"}
//   index.json                                                        IndexFile      the only index; rewritten atomically
//   data/<workspace>/workspace.json                                   WorkspaceRec
//   data/<workspace>/last/<case>.json                                 latest result of a case (the Flow page reads it)
//   data/<workspace>/cache/<case>.<n>/                                archived earlier runs of a case (a --rerun archives, never deletes)
//   data/<workspace>/runs/<run>.json|.log|.exit                       runs started from the UI
//   data/<workspace>/sessions/<parent>/session.json                   SessionRec  a PARENT session: its agent tree + per-turn verdict
//   data/<workspace>/sessions/<parent>/events.jsonl                   EventRec    one json per line
//   data/<workspace>/sessions/<parent>/workspace/                     the files the agents wrote, one per session, children too
//   data/<workspace>/sessions/<parent>/run/                           raw logs of the fixture runner (trace.jsonl, harness.jsonl, guard.json)
//   data/<workspace>/sessions/<parent>/children/<child>/…             a CHILD session (a case that continues the parent), same files
// Rule: no session without its workspace, no child without its parent (same workspace). index.json lists PARENTS only; children are nested in them.
// test_harness/core/orchistraitor/harness_own_custom/runner/run.ts (fixture runner) writes here directly through core/state/record.ts + store.ts; the Experiment runner keeps its own engine DB (f1 ui/.ui-data) and the UI server copies each session in.

export const STATE_VERSION = "02" as const;
/** which runner produced the session: `test_harness/core/orchistraitor/harness_own_custom/runner/run.ts` (sub-agents from agent_fixture) or the f1 multi-agent harness (Experiment page) */
export type Runner = "fixture" | "experiment";
export type SessionState = "running" | "done" | "stalled" | "failed" | "idle";

export interface AgentRec {
  label: string;               // "lead#1", "expo-go#3": role + instance number
  agent_id: string;            // runner's own id: "a00d537f…" (fixture, claude agent id) or "expo-go#3" (experiment)
  role: string;
  caller: string | null;       // label of the agent that called it (null = the master)
  level: number;               // 1 master, 2 sub-agent, 3 a sub-agent's sub-agent
  claude_session: string | null; // claude session id (the transcript file name)
  status: string;
  fixture: string | null;      // result id in agent_fixture that answered it; null = a real model run
  cost: number;
  runs: number;
}
export interface TurnRec {
  n: number;                   // 1-based
  user?: string;
  expected: string[];          // expected_agents_res (fixture) / "kind:role" (experiment)
  actual: string[];
  match: boolean; guard: boolean; notfound: boolean;
  calls: number; cost: number; reply?: string;
}
export interface SessionRec {
  version: typeof STATE_VERSION;
  /** labels shown in the UI; every session a test run (fixture runner or f1 testrun) makes carries `test_run` */
  tags?: string[];
  task: string;                // main session id: "fx_<case>" for the fixture runner, "t_<case>_<suffix>" / "s<id>" for the experiment runner
  workspace: string;
  runner: Runner;
  parent: string | null;       // task of the parent session; null = this IS a parent. Same workspace, always.
  case?: string; suite?: string; after?: string; title: string;
  state: SessionState;
  verdict: "pass" | "fail" | "partial" | "not_run";
  master: AgentRec | null;
  agents: AgentRec[];          // sub-agents, flat; the tree is caller -> label
  turns: TurnRec[];
  cost: number;
  workspace_files: number;     // files in this session's workspace/ folder (what the agents left in run_test after this case); 0 = none kept
  created: number; updated: number;
  source: { kind: "run" | "ui-data"; path: string; note?: string };   // where it came from: its own run/ folder, or the Experiment runner's ui-data (copied)
}
export interface EventRec { t: number; kind: string; agent?: string; id?: string; fixture?: string | null; text?: string; data?: unknown }

export interface WorkspaceRec { id: string; after?: string; harness: string; created: string; path: string }
/** one agent session (lead excluded) under a parent; owner_case = the case that first created it */
export interface SubSession { label: string; agent_id: string; role: string; caller: string | null; level: number; fixture: string | null; owner_case?: string }
export interface ChildSummary { task: string; case?: string; after?: string; title: string; state: SessionState; verdict: SessionRec["verdict"]; cost: number; updated: number; path: string }
/** what index.json holds for a parent: enough to list and open it without reading session.json */
export interface SessionSummary {
  session_id: string;          // the main (master) claude session id; falls back to task when the runner has none
  task: string; workspace: string; runner: Runner; case?: string; suite?: string; title: string;
  state: SessionState; verdict: SessionRec["verdict"];   // verdict = worst of the parent and its children
  cost: number; updated: number; path: string;
  rootVerdict?: SessionRec["verdict"];   // the parent's own verdict, before the children are folded in
  sub_sessions: SubSession[];  // the agent tree, all cases together
  children: ChildSummary[];    // continuing cases, in run order
}
export interface IndexFile { version: typeof STATE_VERSION; current_workspace: string; workspaces: WorkspaceRec[]; sessions: SessionSummary[] }
