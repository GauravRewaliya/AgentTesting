// THE declaration of a test case: what a suite's `main.ts` exports (`cases: Case[]`, `tags?: TestTag[]`). Nothing else may describe a case's shape.
// Where each thing of a case lives:  name = `title` (+ `id`) | description = `turns[i].expected.context` (plain words for the judge) | tags = `tags` (vocabulary: ./tags.ts)
//                                    agents = `agents`, `distractors`, `turns[i].allowed` | mocks = `expected_agents_res` -> TestCases/test_folders/agent_fixture/results
// Runtime strictness (unique ids, valid chain, known agents/tags/guard file, fixture-or-allow_real_subAg): TestCases/validate.ts, run by `bun test_harness/core/fixture_policy.ts`.
import type { TestTag } from "./tags.ts";

/** Id of a recorded result (agent_fixture/results/<file>.ts, its `id`). */
export type RecordedId = string;
/** A follow-up to an earlier sub-agent session of that role (`SendMessage`), answered from that session's history, NOT a recorded result. */
export type SessionRef = `session:${string}#${number}`;

/**
 * What a case expects, as plain text for a human/Claude to JUDGE against the run report. Nothing is asserted by code.
 */
export type Expected = {
  /** In words: which sub-agent(s) the lead should call, with what hand-over, session behaviour (new vs same session), and that all the work gets done. */
  context: string;
  /** Ids planned to respond, in order: the recorded result id for a spawn (e.g. "pd-slack-layout"), or `session:<agent>#<n>` for a follow-up to an earlier session. */
  expected_agents_res: (RecordedId | SessionRef)[];
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
  /** Unique id; also the name of its session folder (sessions/fx_<id>) in .state. Pass it to the CLI to run only this case. */
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
  /** What this case is FOR, shown in the run output and the report (only the shared vocabulary in TestCases/tags.ts). Suite-level tags (`export const tags` in main.ts) are added to every case. */
  tags?: TestTag[];
  /** false = no router system prompt (the lead works ALONE, e.g. SoLoWork); default true (the lead only delegates). */
  router?: boolean;
  /** How many times the lead may call a fixture agent (agent.json "fixtures": true) in this case before the case FAILS (default 2). The fixture gate (f1 harness/core/fixture_gate.ts) checks each request: a bad one is corrected and may be retried, a repeat is answered "already done"; the call after the limit fails the case. */
  max_agent_calls?: number;
  /** true = a call to a mocked sub-agent that finds NO recorded fixture may go to the REAL sub-agent (a real `claude` call, with its --session-id). Without it, no fixture = the gate raises "FIXTURE NOT FOUND" and the case FAILS. Also marks cases that run without any recorded result (lead alone, real sub-agents, "must NOT call a sub-agent"). Flow: harness/core/fixture_gate.ts. */
  allow_real_subAg?: true;
  /** Role-order guard rules: a JSON file in TestCases/test_folders/agent_fixture/store (e.g. "expo_rules.json"): requires_done, contains_all, min_chars per role. */
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

