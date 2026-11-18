// Shared types of the harness. Mirrors the tables in handbook/PLANS/20261105_ARCHITECTURE_PLAN.md (5.1, 8.3, 21, 22).
export type Triage = "valid" | "conflicts_with_request" | "out_of_scope" | "duplicate" | "needs_person";
export type AgentStatus = "idle" | "running" | "stalled" | "failed" | "stale";

export interface AgentDef {
  name: string; role: string; description: string; model: string; session: "persistent" | "none";
  writes: boolean; max_children: number; agents: string[]; tiers: string[]; session_cap?: number;
  /** agent.json "prompts": the files (names inside the agent's `.claude/` folder, in order) that make up its STATIC prompt; default ["CLAUDE.md"]. Keep each short (about 200 lines at most) and split by topic: a flow's details can be a `chapters/` file the agent reads on demand instead. The user's own CLAUDE.md and the current plan state (run_test/plan/CONTEXT.txt) are separate layers. */ prompts?: string[];
  /** agent.json "team_tools": which shared team commands (preview, proto_check, browse ...) are documented in its prompt; default = all. A builder lists only what it uses. */ team_tools?: string[];
  /** agent.json "singleton": true = ONE agent of this role per task (QA reviewers): `--session new` while one exists RESUMES it (its memory, its session) instead of starting a fresh one each time; a busy one is told to wait; a failed one does not count. */ singleton?: boolean;
  /** agent.json "scratch": true = the agent works in a THROWAWAY copy of the project (a git worktree): it may edit, run and mock anything there (the QA agent), the copy and its changes are always discarded, no file locks, no patch; what it needs changed for real it asks for in its answer. */ scratch?: boolean;
  /** A distractor: calling it is a test failure (agent.json "forbidden": true). */ forbidden?: boolean;
  /** agent.json "fixtures": true = test mode: the agent first looks up a RECORDED result for its task (tools.ts fixture lookup) and runs the command it recommends. */ fixtures?: boolean;
  /** This agent may call a role that has no folder: the harness makes a generic sub-agent named and titled as asked (agent.json "custom": true). */ custom?: boolean;
  /** Made at run time by core/custom.ts, not loaded from a folder. */ ad_hoc?: boolean;   // resumes before a new session; a conversation (the lead) needs far more than a worker
  /** agent.json "timeout_s": how long ONE call of this agent may run before it is killed (default: the runner's, 600 s). A builder writing many files needs more. */ timeout_s?: number;
  allow: string[]; tools: string[]; dir: string; prompt_file: string;
}
export interface AgentRow {
  agent_id: string; task_id: string; name: string; role: string; instance_no: number;
  session_id: string | null; parent_agent_id: string | null; caller_agent_id: string | null; level: number;
  title: string; description: string; status: AgentStatus; activity: string;
  resume_count: number; last_event_at: number; last_report_id: string | null;
  seen_requests: number; seen_findings: number; cwd: string | null;
  /** How this agent came to be, who it descends from, and how its last call ended (all kept so any agent or person can navigate and continue it). */
  parent_type?: "root" | "pipeline" | "call" | "fork"; parent_session_id?: string | null;
  needs_parent?: string | null;   // set when the agent STOPPED to ask its parent something (NEEDS_PARENT:); cleared when the parent continues it
  log_file?: string | null;   // our own copy of this session's log (see archive.ts)
  created_cwd?: string | null;   // the folder the session was created in (Claude keeps the transcript there for ever)
  epoch?: number;   // bumped by every stop: a run that began before the stop can never write its result
  started_at?: number | null; finished_at?: number | null; final_response?: string | null; last_call_id?: string | null; runs?: number;
}
export interface RequestRow { id: string; task_id: string; n: number; text: string; status?: "open" | "satisfied" }
export interface Finding {
  id: string; task_id: string; n: number; text: string; severity: string; source: "reviewer" | "checks" | "guard";
  triage: Triage; status: "open" | "fixed" | "dropped"; round: number;
}
export interface Report {
  id: string; task_id: string; agent_id: string; role: string; round: number; summary: string;
  files: string[]; pass?: boolean; cost: number; patch?: string; reply?: string;   // reply = the full final response (capped at 50 000 characters)
}
export interface Ev { t: number; kind: string; task_id?: string; agent_id?: string; data?: Record<string, unknown> }
export interface CallRow {
  id: string; task_id: string; caller_agent_id: string; callee_agent_id: string | null; role: string; level: number;
  session_arg: string; status: "granted" | "denied" | "done" | "failed"; reason: string | null; t: number; req?: Record<string, unknown>;
}
export interface LockRow { path: string; task_id: string; agent_id: string; call_id: string; expires: number }
export interface WaiterRow { id: string; task_id: string; agent_id: string; call_id: string; paths: string[]; t: number }

export interface PipelineStage { role: string; when?: string }
export interface Pipeline {
  stages: PipelineStage[];
  on_issue: { from: string; to: string; then: string; max_rounds: number };
  approval?: { after: string; when: string };
}

export interface RunCall { /** true = a one-shot call: no --session-id / --resume, nothing kept by the CLI (`--no-session-persistence`). The fixture gate uses it for real calls; their memory is the fixture_sessions table. */ stateless?: boolean; agent: AgentDef; row: AgentRow; cwd: string; prompt: string; session: { id: string; resume: boolean; fork_from?: string }; env?: Record<string, string>; extraArgs?: string[]; /** called once when the call has to WAIT for a machine-wide slot (lead / pm / worker): the caller shows "queued" instead of "running" */ onWait?: (slot: string, heldByPid?: number) => void; /** called when the slot is granted after a wait */ onGo?: (waited_ms: number) => void }
export interface RunResult { /** the CLI answered but never exited: the answer and an ESTIMATED cost were taken from its log (core/base/hung.ts) */ hung_after_answer?: boolean; cost_estimated?: boolean; waited_ms?: number; reply: string; session_id: string; cost: number; ok: boolean; error?: string }
export interface Runner { run(c: RunCall): Promise<RunResult>; killAll?(): void }
