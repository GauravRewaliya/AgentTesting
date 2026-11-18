// Types for the whole Test_agent_3 harness. Every field says what it does and which flag/file it maps to.

/* ───────────────────────── Sub-agents ───────────────────────── */

/** An agent as the lead sees it (read from agent.json by core/agents/index.ts). Passed to the lead as an agent type it may call. */
export type AgentDef = {
  /** The `subagent_type` the lead must use. */
  name: string;
  /** What the lead reads to decide when to call it. Keep it generic for neutral routers. */
  description: string;
  /** Free label (docs only). */
  role: string;
  /** Distractor: useless for the task. Calling it makes the mod return `GUARD: forbidden` and the case FAILS. */
  forbidden?: boolean;
};

/* ───────────────────────── Case definition: moved to TestCases/types.ts ───────────────────────── */
export type { Case, Turn, Expected, RecordedId, SessionRef } from "../../TestCases/types.ts";

/* ───────────────────────── CLI flags ───────────────────────── */

/**
 * `bun core/run.ts <suite> [case_id ...] [flags]`
 * `<suite>` = folder in test_case/. No case ids = run all in order (chained cases reuse checkpoints saved earlier in the run).
 */
export type CliFlags = {
  /** `--list`: print the suite's cases and which have a saved checkpoint, run nothing. */
  list?: boolean;
  /** `--keep`: leave run_test/ filled after the case (default: wiped, so it is empty at rest). */
  keep?: boolean;
  /** `--raw`: save the full stream-json of each case to <session>/run/raw.json in .state for debugging. */
  raw?: boolean;
  /** `--real`: do not mount the mod; use thin REAL Claude sub-agents (real sessions, mocked work via core/interpose.ts). */
  real?: boolean;
  /** `--rerun`: run a case that already has a cached result; the old result is first archived to .state/<version>/data/<ws>/cache/<id>.<n>/ (never deleted). Without it a cached case is skipped (CACHED). */
  rerun?: boolean;
};

/* ───────────────────────── Flags passed to `claude -p` (core/claude.ts) ───────────────────────── */

/**
 * What runClaude passes, and why. This is documentation of the spawn; see core/claude.ts.
 *   -p <prompt> --output-format stream-json --verbose   headless, machine-readable events
 *   --model haiku                                       cheap lead
 *   --setting-sources ""                                ignore user/project settings and CLAUDE.md (low tokens, no leakage)
 *   --strict-mcp-config                                 no MCP servers
 *   CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 (env)              no parent CLAUDE.md files
 *   --permission-mode acceptEdits, --allowedTools ...   no prompts for Agent/SendMessage/our Bash
 *   --tools <list>                                      lead tools (+Bash); it also limits real sub-agents' tools
 *   --agents <json>                                     the case's agent types (helper/agents -> AgentJson)
 *   --append-system-prompt <system_prompt.md + types>   the harness's router rules + the allowed agent types
 *   --resume <session>                                  continue the lead conversation of the `after` checkpoint
 *   --plugin-dir core/harness_own_custom/core/.claude/mods/interrupt   (mod mode) the mount; `--real` uses `--settings` hooks instead
 */
export type SpawnOptions = {
  prompt: string;
  resume?: string;
  defs: AgentDef[];
  tools: string[];
  /** Working directory of the lead = run_test/. Also exported to the harness as TEST_WS. */
  ws: string;
  /** Trace file (<session>/run/trace.jsonl) for real-mode hooks. */
  trace: string;
  /** Agent names that stop the run when called. */
  forbidden: string[];
  /** true (default) = interrupt mod answers Agent/SendMessage from harness_own_custom; false (--real) = real sub-agents. */
  mod?: boolean;
};

/** Inline `--agents` entry for a real-mode sub-agent (a thin wrapper around core/interpose.ts mock). */
export type AgentJson = { description: string; tools: string[]; model: string; prompt: string };

/* ───────────────────────── Mod / harness ───────────────────────── */

/** <session>/run/mod.json, written before each run and read by the interrupt mod. */
export type ModConfig = {
  /** Calling one of these is a hard stop: `GUARD: forbidden agent <name>`; the case fails. */
  forbidden: string[];
  /** The only agent types that exist. Any other type is refused with `GUARD-RETRY` so the lead retries; not counted as a call. */
  allowed: string[];
};

/** Environment variables the harness/mod read. */
export type HarnessEnv = {
  /** Workspace where mocked work writes files (default run_test/). */
  TEST_WS?: string;
  /** Session/event log (<session>/run/harness.jsonl); sessions are rebuilt from it, so they survive between one-shot calls. */
  HARNESS_LOG?: string;
  /** Real mode: comma-separated forbidden agents for core/interpose.ts hook. */
  FORBIDDEN_AGENTS?: string;
};

/** One line of run/mod_events.jsonl (what the mod saw). `retry`/`deny` = refused; `Agent`/`SendMessage` = answered by the harness. */
export type ModEvent = {
  t: number;
  kind: "Agent" | "SendMessage" | "deny" | "retry";
  agent?: string;
  to?: string;
  prompt?: string;
  message?: string;
  /** Session id the harness gave/continued. */
  id?: string;
  /** Recorded result/fixture served (Agent only). */
  fixture?: string | null;
  reply?: string;
  error?: string;
};

/* ───────────────────────── Fixtures: moved to TestCases/test_folders/agent_fixture/types.ts ───────────────────────── */
export type { Fixture, Req, ResultModule, IndexRow, Rule } from "../../TestCases/test_folders/agent_fixture/types.ts";
