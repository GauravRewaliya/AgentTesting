// ONE definition of every API shape. The server (server/*.ts) builds them, the page (src/**) reads them.
export type Status = "pass" | "fail" | "skipped" | "never_run";

export interface TurnOut { user: string; expectedAgents: string[]; actualAgents: string[]; match?: boolean; notfound?: boolean; guard?: boolean }
/** A sub-agent session seen from one case. `inherited` = created by an ancestor case (ids are carried forward in ckpt.json). */
export interface SubSessionOut { label: string; id: string; fixture: string | null; inherited: boolean; ownerCase: string }
/**
 * How a case is built, derived from its definition (never hand-written, so it cannot drift):
 *  agentMode  multi = the lead is expected to hand work to >= 1 sub-agent; solo = the lead works alone
 *             (router:false, or a multi-agent setup where the case expects NO delegation: noDelegate)
 *  multiPrompt  more than one user turn
 *  multiSession continues an earlier session (`after`), expects a follow-up to an existing sub-agent session, or opens >= 2 sub-agent sessions
 *  kind       solo_master = solo, one prompt, one session; otherwise the first thing that makes it bigger
 */
export interface CaseProfile {
  agentMode: "solo" | "multi"; noDelegate: boolean; multiPrompt: boolean; multiSession: boolean;
  subAgents: string[]; // distinct sub-agent types the case expects
  kind: "solo_master" | "solo_multi_prompt" | "solo_multi_session" | "multi_agent";
}
export interface CaseOut {
  profile: CaseProfile;
  caseId: string; suite: string; title: string; after?: string; tags: string[];
  status: Status; ran: boolean; at?: string;
  sessionId?: string; // the lead (test) session id from ckpt.json
  relation?: "root" | "same_session" | "cloned"; // vs the parent case's lead session id
  subSessions: SubSessionOut[];
  turns: TurnOut[];
}
/** `chain` = cases linked by `after`; `standalone` = a suite's cases with no links. parentCard/branchedAt: where a branch splits. */
export interface CardOut { id: string; title: string; suite: string; kind: "chain" | "standalone"; cases: CaseOut[]; parentCard?: string; branchedAt?: string }

export interface LogEvent { t: number; kind: string; id?: string; agent?: string; text?: string; fixture?: string | null; own?: boolean }
export interface CaseDetail extends CaseOut { leadSessionId: string | null; last: { at: string; warnings?: string[] } | null; events: LogEvent[] }

export interface Rule { requires_done?: string[]; contains_all?: string[]; min_chars?: number; forbidden?: boolean }
export interface AgentInfo { name: string; description: string; role: string; forbidden: boolean; category: string; responses: number; guard: { file: string; rule: Rule }[] }
export interface ResponseRow { id: string; agent: string | null; category: string; query: string; title: string; setup: { keywords: string[]; matchBy: string; copies: string[]; file: string } }
export interface CaseResult { id: string; kind: "positive" | "negative"; layer: "lookup" | "guard" | "forbidden"; name: string; query: string; expect: string; actual: string; pass: boolean; fixture?: string | null; files?: string[] }
export interface Health { responses: Record<string, { pass: number; total: number; failing: string[] }>; agents: Record<string, { pass: number; total: number; failing: string[] }> }
export interface TryResult { accepted: boolean; rejections: string[]; reply?: string; fixture?: string | null; found?: boolean; files?: string[] }
export interface WorkspaceSnap { hasScratch: boolean; original: string[]; current: string[]; removed: string[]; added: string[]; edited: string[] }
export interface Usage { expectedBy: { caseId: string; suite: string; turn: number }[]; servedIn: { caseId: string; times: number }[]; sharedStore: { store: string; with: string[] }[]; agentCases: string[]; orphan: boolean }

/* ───────── "Run" of the fixture-mock runner (test_harness/core/run.ts; results land in test_harness/.state/<version>, which Flow + Test pages read) ───────── */
export type StateRunStatus = "running" | "done" | "failed" | "stopped";
export interface StateRun {
  id: string; suite: string;
  /** the cases handed to run.ts, in order: the missing ancestors (`after`) first, the case you asked for last */
  cases: string[]; rerun: boolean; startedAt: number; endedAt?: number; pid: number; status: StateRunStatus; exitCode?: number | null;
}
export interface StateRunLog { run: StateRun; log: string }

/** One result of a case in a workspace: the current one (`last/<id>.json`) or an archived one (`cache/<id>.<n>/last.json`, made by a rerun). */
export interface RunSummary { source: "now" | "archived"; n: number; at: string; status: string; ok: boolean; cost: number; turns: number; notes: string[] }
/** A run that was started from the UI (a "session run"): the trigger, plus its sub tasks = the cases it ran (the missing `after` ancestors first, the case you asked for last). */
export interface SessionRun extends StateRun { sub: { caseId: string; state: "ok" | "fail" | "not_run" }[] }
export interface CaseRuns { /** every step "Run" executes for this case, in order */ chain: string[]; workspace: string; current: RunSummary | null; history: RunSummary[]; sessionRuns: SessionRun[] }
