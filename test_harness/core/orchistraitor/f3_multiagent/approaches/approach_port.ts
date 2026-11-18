// The port: the ONLY thing an approach implements. Everything else (store, locks, worktrees, patches, bg, phases, monitor, fixtures, runners) is shared and lives in ../harness/core.
// An approach decides HOW THE LEAD DELEGATES: which tool it gets, which prompt it reads, how its call becomes a CallReq and how the CallRes goes back.
import type { CallCtx } from "../harness/core/base.ts";
import type { MStore } from "../harness/core/board.ts";

export type Cap = "ok" | "partial" | "no";
/** What an approach can do. `no` = a case that needs it is skipped with a warning (same idea as harness_own_custom/capabilities.ts). */
export interface Capabilities {
  spawn: Cap; followup: Cap; async_wait: Cap; fork: Cap; locks_worktrees_patches: Cap; phases_plans: Cap; budget_kill: Cap; stock_lead_agent_tool: Cap;
}

/** Same options the f1 lead engine takes today (harness/lead.ts runLead). */
export interface LeadRun { task_id: string; repo: string; request: string; maxDepth: number; runner: "real" | "fake"; writerMode?: "shared" | "worktree"; models?: Record<string, string>; agents?: string[]; forceSel?: { id: string; resume: boolean; fork_from?: string } }

export interface Approach {
  readonly name: string;
  readonly capabilities: Capabilities;
  /** Run the lead for one request. a1: harness/lead.ts runLead (the lead delegates with the `team` shell commands). */
  runLead(ctx: CallCtx & { store: MStore }, o: LeadRun): Promise<{ reply: string } & Record<string, unknown>>;
  /** Where this approach's own prompt files live (relative to f3_multiagent/); resolve() looks for overrides of them in approaches/custom/. */
  readonly promptDir: string;
  // TODO: decode(raw lead call) -> CallReq and encode(CallRes) -> lead reply. In a1 they are inside harness/tools.ts (`delegate` command -> grant()); extract them into core/delegate.ts (docs/04).
}
