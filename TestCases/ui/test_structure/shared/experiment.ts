// Shapes shared by the Experiment API (server/experiment.ts) and the page (src/pages/ExperimentPage.vue).
export type CaseState = "never_run" | "running" | "pass" | "fail" | "partial" | "skipped";

export interface ExpCase {
  id: string; title: string; after?: string; agents: string[]; distractors: string[]; turns: number;
  unsupported?: string; prompts: string[]; state: CaseState; task?: string; done: number; at?: number;
}
export interface ExpSuite { suite: string; cases: ExpCase[] }

export interface RunInfo {
  id: string; suite: string; cases: string[]; fake: boolean; rerun: boolean;
  startedAt: number; endedAt?: number; pid: number; status: "running" | "done" | "failed" | "stopped"; exitCode?: number | null;
}

export interface LiveAgent {
  id: string; name: string; level: number; caller: string | null; status: string; title: string; activity: string;
  needsParent: string | null; runs: number; cost: number; lastEventAt: number; /** ms this agent itself was working */ activeMs: number; /** its newest call: start time, how long it took (so far if running) */ lastCall: { at: number; ms: number; running: boolean } | null; session?: string; fixture?: boolean;   // fixture = its answer was served from agent_fixture, not a real model run
}
export interface LiveSession {
  /** "experiment" = made on this page (＋ New session, free chat); "test" = made by a test run (testrun/run.ts, a case) */ kind: "experiment" | "test"; /** sub-agent answers served from a recorded fixture */ fixtures: number;
  tags: string[]; task: string; agentsAllowed: string[]; fake: boolean; queued: number; busy: boolean; case?: string; suite?: string; title: string; last: number; /** ms at least one agent was working in this session (parallel agents count once) */ activeMs: number;
  state: "working" | "running" | "active" | "stalled"; cost: number;   // stalled = the master is marked running but no process is alive any more
  master: LiveAgent | null; agents: LiveAgent[];
}

export interface CallRow { id: string; role: string; kind: string; agent: string | null; status: string; reason: string | null; title: string; objective: string; custom: boolean }
export interface TurnResult {
  turn: number; user: string; expectedContext: string; expected: { kind: string; role: string }[];
  calls: CallRow[]; denied: CallRow[]; match: boolean; guard: boolean; reply: string; finished: boolean;
}
export interface CaseResultOut { case: string; task: string; suite: string; state: CaseState; done: number; total: number; turns: TurnResult[] }

export interface ExperimentOverview {
  config: { f1: string; store: string; repo: string; storeExists: boolean };
  suites: ExpSuite[]; runs: RunInfo[];
}
export interface RunLog { run: RunInfo; log: string }

export interface AvailableAgent { name: string; description: string; writes: boolean; byDefault: boolean }
export interface ChatMsg { id: string; from: "user" | "lead"; text: string; t: number }
export interface ChatOut { task: string; messages: ChatMsg[]; queued: { id: string; text: string; t: number }[]; busy: boolean; error: string; nextTurn: number | null }
export interface SendIn { task?: string; text: string; agents: string[]; fake: boolean; caseId?: string; suite?: string }

/** What a click on a card (master or sub-agent) on the Experiment page shows: the commands it ran, the briefs it got, its answer, and the live previews. */
export interface AgentDetail {
  id: string; name: string; status: string; activity: string; session?: string;
  tools: { t: number; tool: string; text: string }[];            // its tool calls (Bash, Edit ...), newest last: the full command text the store kept
  briefs: { id: string; from: string | null; to: string | null; role: string; status: string; objective: string; output: string; boundaries: string; t: number }[];   // calls it received (sub-agent) or made (master)
  answer: string;                                                  // its last reply / report
  scripts: { id: string; kind: string; status: string; label: string; cmd: string; dir: string; pid: number; started: number; ended_at?: number; exit_code?: number; by: string; stopped_by?: string; public_url: string; expires_at?: number; user_requested?: boolean }[];   // background scripts of the session (running first)
  processes: { pid: number; elapsed: string; cmd: string }[];     // host processes of this task (dev servers, installs)
}
