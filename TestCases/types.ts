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
  /** For a case with REAL sub-agents (`allow_real_subAg`): the roles the lead must call (a new session each), e.g. ["builder"]. Without it an empty `expected_agents_res` means "the lead must NOT delegate". */
  expected_roles?: string[];
  /** Words the lead's FINAL reply to the user must contain (all of them, case-insensitive). Without this the judge only sees WHO was called, so a right call list with a wrong or confused answer still passes ("wrong pass"). Few, plain words. */
  reply_must?: string[];
  /** Words the final reply must NOT contain (any one fails the turn), e.g. "not finished" after a fix was served. */
  reply_forbid?: string[];
};

/** One user message to the lead and what is expected. A case with several turns keeps ONE lead conversation. */
export type Turn = {
  user: string;
  expected: Expected;
  /** Role guard: the only agent types the lead may call in THIS turn (anything else stops the run with a GUARD). Needs the case's `guard` rules. */
  allowed?: string[];
};

/** A test case: an entry of `cases` in test_case/<suite>/main.ts. */
/** What `--video` hands to a case's `qa` function: where the work is. */
export interface QaReq {
  /** the git workspace of the master session (<session>/workspace) */
  workspace: string;
  /** <workspace>/run_test: every app the agents built is a folder in here */
  run_test: string;
  /** the master session (= task id) */
  session: string;
  /** the folders found in run_test (the function can pick one) */
  apps: string[];
}
/** What `Case.before_node_run` gets: the node (= one case run, a root, a main-line continuation or a BRANCH) is ready (workspace in place, branch copy made) and the lead has NOT started yet. */
export interface NodeRunCtx {
  case_id: string;
  /** which hook this is: `before` the lead starts, or `after` the node PASSED */
  phase: "before" | "after";
  /** root = starts empty, main = continues its parent, branch = fork of `parent` (own folder) */
  node: "root" | "main" | "branch";
  parent?: string;
  /** branch folder name when node is "branch" */
  branch?: string;
  /** the workspace of THIS node (git repo) and its run_test folder */
  workspace: string;
  run_test: string;
  /** read a file under run_test (undefined if missing) / write one / replace text in one (false if `from` is not found). All paths are relative to run_test and may not leave it. */
  read: (path: string) => string | undefined;
  write: (path: string, text: string) => void;
  patch: (path: string, from: string | RegExp, to: string) => boolean;
  /** apply a git patch file (absolute path) inside run_test/<dir> with `git apply -p1`; returns the error text, or "" when it applied */
  apply_patch: (patchFile: string, dir: string) => string;
  /** AUTO RUN: mimic what the MASTER would do after the sub-agent node, without a model call: apply the stack of fix commits (git format-patch files in `fixDir`, in file-name order) to run_test/<dir>, make one git commit per patch in the workspace (author "auto_run (mimics the master)"), and write store/auto_run.json (what was found + the commits). Returns the commits, or an `error`. */
  auto_run: (o: { dir: string; fixDir: string; found: string[] }) => { commits: { sha: string; subject: string; files: string[] }[]; error?: string };
  /** print a line in the run output, prefixed with the hook name */
  log: (msg: string) => void;
}
/** How to record a QA video of a case, or why it cannot be recorded. Returned by `Case.qa(req)`.
 *  static    a plain web page: `app/index.html`, served by the recorder (no network).
 *  expo-web  an Expo app with web support: its own dev server in a container, then the recording (docs/QA_ISSUES.md).
 *  dev-server any other app with its own dev command (`start`, `port`), same flow. */
export type QaSpec =
  | { enabled: false; why: string }
  | { enabled: true; kind: "static" | "expo-web" | "dev-server"; app: string; route?: string; viewport?: string; start?: string; port?: number; type?: string; note?: string;
      /** type check stage of the QA run: "strict" (default: a type error stops it), "warn" (reported, the run goes on), "off". Use warn/off when only ONE part of a big repo is run (errors of the other demos must not block it). */
      typecheck?: "strict" | "warn" | "off";
      /** how long the page may stay blank while the dev server bundles (default 90 s) and how long the whole container run may take (default 300 s). A big repo (hundreds of demos) needs more. */
      render_timeout_ms?: number; timeout_ms?: number;
      /** regexes (strings) of native-only packages to replace, ON WEB ONLY, by an empty stub (every export renders nothing): iOS/Android-only modules (Nitro views, context menus) cannot be bundled for the browser. Added to the default list (^@expo/ui/swift-ui, jetpack-compose). */
      native_only?: string[];
      /** OPT-IN, for a big collection repo only: on web an unresolved bare package import becomes an empty stub instead of stopping the bundle (the stubbed names are printed in the dev log). Never use it for an app an agent built: it would hide a missing dependency. */
      stub_unresolved?: boolean;
      /** extra Chromium flags for the recording, e.g. software WebGPU: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--use-webgpu-adapter=swiftshader"]. */
      browser_args?: string[];
      /** regexes: if the rendered page contains one of them the run FAILS (no video), e.g. ["needs Skia Graphite"]: a page that loads but says it cannot run here is not a working demo. */
      fail_on_text?: string[];
      /** extra GUIDANCE and COMMANDS about testing, appended to the first user message of the case when `--video` is on (e.g. "start the app with `pnpm exec expo start --web`, then open /3d-rotate"). Only a case that opts in gets it. */
      guide?: string };

export type Case = {
  /** Unique id; also the name of its session folder (sessions/fx_<id>) in .state. Pass it to the CLI to run only this case. */
  id: string;
  title: string;
  /**
   * Chain/branch: id of a PASSED case whose checkpoint to continue from. Restores its lead session (`--resume`),
   * its saved sub-agent ids (labels) and its run_test workspace. Several cases with the same `after` = branches.
   */
  after?: string;
  /** With `branch_from`: the branch runs IN the parent's workspace and store (no copy, no new session folder, no lead fork): a separate TEST on the same checkout. Use it for "node 1 clones/builds once, nodes 2 and 3 just run and record it". */
  branch_share?: true;
  /** The node makes NO lead / sub-agent call: the harness only records the QA video (Case.qa must be enabled) of the workspace it runs in. Needs `allow_real_subAg: true` (nothing is mocked). The case passes when the video was made. */
  no_lead?: true;
  /** For a `no_lead` node: "ok" (default) = the video must be made; "fail" = a known-negative: the QA step must CATCH the problem (e.g. qa spec `fail_on_text`), no video. */
  expect_video?: "ok" | "fail";
  /** Fork instead of continue: the case runs in its own branch folder (workspace copy + a clone of the lead session made on the fly). Use it when 2+ cases share one parent; see TestCases/branch.ts. */
  branch_from?: string;
  /** agents (core/agents/main_flow_agents or test_agents) passed to the lead (only these exist for it). */
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
  /** Real-money cap for this case in USD (lead + real sub-agents). Over it, the case fails with a COST CAP gate. Default: env HARNESS_CASE_CAP_USD, else 1. Not applied to --fake. */
  max_cost_usd?: number;
  /** Runs right BEFORE the lead of this node starts (like a fixture, a plain function): the place to put a fix, a broken file or any starting state into the branch's workspace (e.g. "the bug was fixed in the meantime"). Default (not set) = `defaultBeforeNodeRun` (TestCases/branch.ts): only prints what node this is. Not run with `--list`/`--fake`? It runs with `--fake` too (the workspace is real, the lead is not). */
  before_node_run?: (ctx: NodeRunCtx) => void | Promise<void>;
  /** Runs right AFTER the node, and ONLY when the node PASSED (a failed case never runs it, so a broken state is never post-processed): e.g. add a file for the next node of the chain, or log a checkpoint. Same ctx as `before_node_run` (`phase: "after"`). Default = prints. It runs before the video / session record, so they see its result. */
  after_node_run?: (ctx: NodeRunCtx) => void | Promise<void>;
  /** true = a call to a mocked sub-agent that finds NO recorded fixture may go to the REAL sub-agent (a real `claude` call, with its --session-id). Without it, no fixture = the gate raises "FIXTURE NOT FOUND" and the case FAILS. Also marks cases that run without any recorded result (lead alone, real sub-agents, "must NOT call a sub-agent"). Flow: harness/core/fixture_gate.ts. */
  allow_real_subAg?: true;
  /** QA video (`--video` in testrun/run.ts, helper `infra/qa/video.ts`). A function of the request so it can look at what was built: `qa: (req) => ({ enabled: true, kind: "static", app: "qa-demo" })` says HOW to start and record; `({ enabled: false, why })` says why not. Absent = not declared: `--video` skips the case and says so. */
  qa?: (req: QaReq) => QaSpec;
  /** Files created in the workspace before the case starts (path under run_test -> content), for a case that says "there is an index.html in run_test/x". Not used for a case that continues another (`after`). */
  seed?: Record<string, string>;
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

