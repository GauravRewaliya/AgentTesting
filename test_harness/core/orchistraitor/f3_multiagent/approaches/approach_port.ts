// THE PORT: everything an approach is, in one file. An approach decides only HOW THE LEAD DELEGATES; the store, locks, worktrees, patches, bg, phases, monitor, fixtures and runners are shared (../harness).
//   1. ApproachSpec   the approach as DATA (how it delegates, its guard, its hooks): read it to see what differs between approaches.
//   2. BaseApproach   the ONE runLead (template method). A subclass overrides only describeLaunch(), request() and, when it needs to, extraEnv() / afterRun().
// To add an approach: a folder next to a1_team_cli/, a class extending BaseApproach, one line in index.ts. To tune one without touching shared files: approaches/custom/ (resolve.ts).
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callAgent, type AgentDef, type CallCtx } from "../harness/core/base.ts";
import type { MStore } from "../harness/core/board.ts";
import { touchRun } from "../harness/core/session_run.ts";
import { leadEnv, personReply, startLeadRun } from "../harness/leadkit/common.ts";
import type { GuardPolicy } from "../harness/leadkit/guard.ts";

export type Cap = "ok" | "partial" | "no";
/** What an approach can do. `no` = a case that needs it is skipped with a warning (same idea as harness_own_custom/capabilities.ts). */
export interface Capabilities {
  spawn: Cap; followup: Cap; async_wait: Cap; fork: Cap; locks_worktrees_patches: Cap; phases_plans: Cap; budget_kill: Cap; stock_lead_agent_tool: Cap;
}
/** The options one lead run takes (the same as the f1 engine's runLead). */
export interface LeadRun { task_id: string; repo: string; request: string; maxDepth: number; runner: "real" | "fake"; writerMode?: "shared" | "worktree"; models?: Record<string, string>; agents?: string[]; forceSel?: { id: string; resume: boolean; fork_from?: string } }

export type HookEvent = "PreToolUse" | "PostToolUse" | "UserPromptSubmit" | "Stop" | "SessionStart" | "SubagentStop";

/** The approach as data. */
export interface ApproachSpec {
  name: string;
  /** shell-cli (a1): `team agent ...` in Bash. native-hook (a2): the Agent / SendMessage tools, answered by a hook. native-observe (a2): the native engine runs, hooks only watch. */
  delegate: "shell-cli" | "native-hook" | "native-observe" | "native-mod";
  /** The hook events this approach turns on (a handler is code in the approach's hook file, never a per-command declaration). Stop and SessionStart are written but OFF until a real run shows they help. */
  hooks: (HookEvent | string)[];   // a2: Claude Code hook events; a3: mod events (tool.call ...)
  /** The lite guard of the lead (harness/leadkit/guard.ts). Not a sandbox: it stops wrong moves such as reading .env. */
  guard: GuardPolicy | null;
  capabilities: Capabilities;
}

/** What describeLaunch returns: everything callAgent needs to start the lead (and everything the prompt tests need to start it the same way). */
export interface LeadLaunch {
  text: string;                                   // the system prompt (--append-system-prompt-file)
  allow: string[]; tools: string[];               // --allowedTools / --tools
  delegate: boolean;                              // may this lead call sub-agents (agents declared AND depth left)?
  extra: (env: Record<string, string>) => string[];   // --settings (hooks), --agents, --mcp-config ...
}

export interface Approach {
  readonly name: string;
  readonly spec: ApproachSpec;
  readonly capabilities: Capabilities;
  /** Where this approach's own prompt files live (absolute); resolve() looks for overrides in approaches/custom/. */
  readonly promptDir: string;
  /** Run the lead for one request. */
  runLead(ctx: CallCtx & { store: MStore }, o: LeadRun): Promise<{ reply: string } & Record<string, unknown>>;
  /** What the lead would be started with, WITHOUT starting it (prompt tests and the prompt size checks use this, so they follow the chosen approach). */
  describeLaunch(defs: Map<string, AgentDef>, o: Pick<LeadRun, "agents" | "maxDepth">): Promise<LeadLaunch>;
}

export abstract class BaseApproach implements Approach {
  abstract readonly spec: ApproachSpec;
  abstract readonly promptDir: string;
  get name() { return this.spec.name; }
  get capabilities() { return this.spec.capabilities; }

  /** OVERRIDE: the prompt text, tools and extra CLI args of this approach's lead. */
  abstract describeLaunch(defs: Map<string, AgentDef>, o: Pick<LeadRun, "agents" | "maxDepth">): Promise<LeadLaunch>;
  /** OVERRIDE: what the lead reads in one turn (shared pieces: leadkit/common.ts requestPieces). */
  protected abstract request(first: boolean, o: LeadRun, store: MStore, launch: LeadLaunch): string;
  /** OVERRIDE (optional): extra environment for the lead and its hooks. */
  protected extraEnv(_o: LeadRun): Record<string, string> { return {}; }
  /** OVERRIDE (optional): runs after the lead's turn ended. */
  protected async afterRun(_ctx: CallCtx & { store: MStore }, _o: LeadRun): Promise<void> { /* nothing */ }

  /** THE flow. Never overridden. */
  async runLead(ctx: CallCtx & { store: MStore }, o: LeadRun) {
    const { store, defs } = ctx, { def, row } = startLeadRun(ctx, o);
    const L = await this.describeLaunch(defs, o);
    const dir = join(tmpdir(), "lf-launch"); mkdirSync(dir, { recursive: true });
    const prompt_file = join(dir, `lead.${this.name}.${Date.now().toString(36)}.md`); writeFileSync(prompt_file, L.text);
    const ld: AgentDef = { ...def, prompt_file, tools: L.tools, allow: L.allow };
    const env = { ...leadEnv(store, o, row.agent_id), ...this.extraEnv(o) };
    const out = await callAgent({ ...ctx, defs: new Map(defs).set("lead", ld) }, row, o.repo, (first) => this.request(first, o, store, L), o.forceSel, {}, { env, extraArgs: L.extra(env) });
    await this.afterRun(ctx, o);
    store.tx(() => touchRun(store, o.task_id));   // the lead's Claude session id is now on the run record
    return { row, ...out, reply: personReply(out.reply) };
  }
}
