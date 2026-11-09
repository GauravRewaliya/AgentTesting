// Types for the whole Test_agent_3 harness. Every field says what it does and which flag/file it maps to.

/* ───────────────────────── Sub-agents ───────────────────────── */

/** helper/agents/<name>.ts default export. Passed to the lead as an agent type it may call. */
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

/* ───────────────────────── Case definition ───────────────────────── */

/**
 * What a case expects, as plain text for a human/Claude to JUDGE against the run report. Nothing is asserted by code.
 */
export type Expected = {
  /** In words: which sub-agent(s) the lead should call, with what hand-over, session behaviour (new vs same session), and that all the work gets done. */
  context: string;
  /** Ids planned to respond, in order: the recorded result id for a spawn (e.g. "pd-slack-layout"), or `session:<agent>#<n>` for a follow-up to an earlier session. */
  expected_agents_res: string[];
};

/** One user message to the lead and what is expected. A case with several turns keeps ONE lead conversation. */
export type Turn = {
  user: string;
  expected: Expected;
  /** Role guard: the only agent types the lead may call in THIS turn (anything else stops the run with a GUARD). Needs the case's `guard` rules. */
  allowed?: string[];
};

/** A test case: an entry of `cases` in test_case/<suite>/main.ts. */
export type Case = {
  /** Unique id; also the name of its checkpoint in .state/<id>/. Pass it to the CLI to run only this case. */
  id: string;
  title: string;
  /**
   * Chain/branch: id of a PASSED case whose checkpoint to continue from. Restores its lead session (`--resume`),
   * its saved sub-agent ids (labels) and its run_test workspace. Several cases with the same `after` = branches.
   */
  after?: string;
  /** helper/agents/<name>.ts passed to the lead (only these exist for it). */
  /**
   * Harness capabilities this case relies on, as dotted paths into the tree in core/harness_own_custom/test/capabilities.ts
   * (e.g. "session.followup"). A `no` capability SKIPS the case with a warning; `partial` runs it with a warning.
   */
  needs?: string[];
  /** Run in a workspace outside .idea/ (~/.cache/test_agent_3/run_ws), needed when the LEAD itself writes files (Claude Code refuses Write/Edit under .idea/). Wiped after the case. */
  external?: boolean;
  /** What this case is FOR, shown in the run output and the report (e.g. ["SoLoWork", "confirm-first"], ["Artifact", "website"]). Suite-level tags (`export const tags` in main.ts) are added to every case. */
  tags?: string[];
  /** false = no router system prompt (the lead works ALONE, e.g. SoLoWork); default true (the lead only delegates). */
  router?: boolean;
  /** Role-order guard rules: a JSON file in agent_fixture/store (e.g. "expo_rules.json"): requires_done, contains_all, min_chars per role. */
  guard?: string;
  /** Lead protocol appended to the system prompt: a file in core/harness_own_custom/core/prompts (without .md), e.g. "lead_team". */
  lead?: string;
  agents: string[];
  /** Useless agents also passed (they must have `forbidden: true`). Tests that the lead does not call them for minor work. */
  distractors?: string[];
  /** Lead tools (claude `--tools`). Default ["Agent","SendMessage","Read"]; `Bash` is always added because real-mode sub-agents need it. */
  tools?: string[];
  turns: Turn[];
};

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
  /** `--raw`: save the full stream-json of each case to .state/<id>.raw.json for debugging. */
  raw?: boolean;
  /** `--real`: do not mount the mod; use thin REAL Claude sub-agents (real sessions, mocked work via core/interpose.ts). */
  real?: boolean;
  /** `--rerun`: run a case that already has a cached result; the old result is first archived to .state/cache/<id>.<n>/ (never deleted). Without it a cached case is skipped (CACHED). */
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
  /** Trace file (.state/trace.jsonl) for real-mode hooks. */
  trace: string;
  /** Agent names that stop the run when called. */
  forbidden: string[];
  /** true (default) = interrupt mod answers Agent/SendMessage from harness_own_custom; false (--real) = real sub-agents. */
  mod?: boolean;
};

/** Inline `--agents` entry for a real-mode sub-agent (a thin wrapper around core/interpose.ts mock). */
export type AgentJson = { description: string; tools: string[]; model: string; prompt: string };

/* ───────────────────────── Mod / harness ───────────────────────── */

/** .state/mod.json, written before each run and read by the interrupt mod. */
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
  /** Session/event log (default .state/harness.jsonl); sessions are rebuilt from it, so they survive between one-shot calls. */
  HARNESS_LOG?: string;
  /** Real mode: comma-separated forbidden agents for core/interpose.ts hook. */
  FORBIDDEN_AGENTS?: string;
};

/** One line of .state/mod_events.jsonl (what the mod saw). `retry`/`deny` = refused; `Agent`/`SendMessage` = answered by the harness. */
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

/* ───────────────────────── Fixtures and recorded results ───────────────────────── */

/** Inline fixture (unit tests only). Real recorded work lives in agent_fixture/results/<id>.ts as `ResultModule`. */
export type Fixture = {
  id: string;
  agent?: string;
  keywords?: string[];
  question?: string;
  response: string;
  files?: Record<string, string>;
};

/** What a recorded `run` receives. Everything it needs to do the "sub-agent's work" without a model. */
export type Req = {
  /** The agent type that was called (e.g. "writer"). */
  agent: string;
  /** The full task text the lead handed over (the prompt). */
  task: string;
  /** Workspace (run_test/): where the produced files must land. */
  ws: string;
  /** agent_fixture/store/: the source files the script copies from. */
  store: string;
  /** Copy store/<from> (file or folder) into ws/<to> (default: ws root). Returns the relative file paths written. */
  cp(from: string, to?: string): string[];
  /** Write a small file into the workspace. */
  write(path: string, text: string): void;
};

/**
 * agent_fixture/results/<id>.ts default export. A recorded sub-agent result: ONLY `run(req)`.
 * `run` does the work (cp from agent_fixture/store/..., write files) and returns the reply text. No static response, no setup.
 * Never delete one: it is what saves sub-agent tokens. agent_fixture/index.json is generated from these (bun core/build_index.ts).
 */
export type ResultModule = {
  id: string;
  title: string;
  description: string;
  /** How the harness finds it. `keywords` (ALL in the task, lowercase) wins; otherwise similarity of the task to `expected_input.text`. */
  match?: { agent?: string; keywords?: string[] };
  expected_input: {
    /** The question this answer was recorded for. */
    text: string;
    /** What a correct hand-over must contain (documentation for the guard). */
    guardrails_test: string;
  };
  run(req: Req): string;
};

/** One row of agent_fixture/index.json: find a result without opening it. */
export type IndexRow = { id: string; file: string; title: string; agent?: string; keywords?: string[]; text: string; copies?: string[] };

/* ───────────────────────── Checkpoints ───────────────────────── */

/** .state/<case id>/ckpt.json, saved after every run (cases are judged by reading the report, not asserted; next to a copy of the workspace in .state/<id>/ws). */
export type Checkpoint = {
  /** Lead session id, used with `--resume` by cases that say `after`. */
  sessionId: string;
  /** Label -> sub-agent session id (the `save` labels). */
  ids: Record<string, string>;
};
