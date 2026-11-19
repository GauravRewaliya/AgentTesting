// PROMPT TESTING (flag "prompt_testing"): short, single-turn calls of ONE agent with its REAL launch prompt and REAL tool definitions. Nothing is executed: a hook records every tool call and blocks it.
// A case judges what the agent DECIDES to do at one step (who it calls, how many, together or one after another, what it hands over, what it must not do). Cases CHAIN like the harness cases do:
// `after: "<id>"` continues the parent (the child gets the parent's real behaviour as history), a second child of the same parent is a BRANCH (…b, …c). A parent that fails stops its children.
// Run: `bun test_harness/scripts/prompt_test.ts <suite|agent> [ids] [--list] [--dry] [--review] [--runs=N] [--tag=cost] [--skip-tag=cost]`. Free shape check: `bun test_harness/scripts/check_prompts.ts`.
import type { TestTag } from "../../tags.ts";

/** One thing to look for among the tool calls the agent made. */
export interface CallMatch {
  /** match against the call with the person's QUOTED words removed (a double-quoted span of 20+ characters, e.g. the verbatim request the lead copies into a hand-over): a quote is not an order */
  unquoted?: true;
  /** tool name as the model sees it: "Agent", "SendMessage", "Bash", "Read", "Write", "Edit", "mcp__team__fork_all", "mcp__team__wait", "mcp__team__team_tool" ... */
  tool?: string;
  /** the callee: Agent `subagent_type`, a `--role` in a Bash command, a fork_all `role`, or a team_tool `command` */
  role?: string;
  /** regex (case-insensitive) tested on the JSON of the tool input */
  match?: string;
  /** how many calls must match (default 1). A fork_all counts one per entry of its `tasks`. */
  min?: number;
  /** at most this many (use 1 for "one builder, not several") */
  max?: number;
  /** alternatives: satisfied when ANY of them is */
  any?: CallMatch[];
  /** every matching call must ALSO carry all of these (regexes on its input): "a proper hand-over" = owns files, names the plan, says what to check */
  each?: string[];
}
export interface PromptExpect {
  /** each of these must happen (the +ve side) */
  calls?: CallMatch[];
  /** none of these may happen (the -ve side: what it must NOT do) */
  not_calls?: CallMatch[];
  /** the agent answers in words and makes no tool call at all */
  no_calls?: boolean;
  /** the FIRST tool call it makes (in order) must match */
  first_call?: CallMatch;
  /** at least `min` (default 2) of the matching calls come in the SAME assistant turn = they start together (parallel), not one after another */
  same_turn?: CallMatch;
  /** the matching builders own DIFFERENT files: their `WRITES:` lines / fork_all `writes` must not share or contain each other's paths, and each must have some */
  disjoint_writes?: CallMatch;
  /** regexes (case-insensitive) that must / must not appear in the text the agent wrote */
  text_has?: string[];
  text_not?: string[];
  /** the agent must do at least ONE of these acceptable things (each alternative is a full expectation). Gives a purely negative case a positive requirement: silence or doing nothing must not pass. */
  any_of?: PromptExpect[];
  /** a hard budget (optional): more tool calls / look calls than this FAIL the case. Without it the efficiency audit only reports (lean / ok / wasteful + notes). */
  budget?: { max_calls?: number; max_looks?: number };
  /** what a person should look at when reviewing the answer by hand (printed with --review and in REVIEW.md; never asserted) */
  judge?: string;
}
export interface PromptCase {
  id: string;
  flag: "prompt_testing";
  /** agent folder name: lead (= the master), builder, qa-reviewer, planner, researcher, lookup, pm, ux-designer */
  agent: string;
  /** one line: what behaviour this case protects */
  about: string;
  /** the failure in plain words: what a bad prompt would do here ("one builder gets all three screens and the rest wait"); printed next to EXPECTED / GOT when it fails */
  why?: string;
  /** the previous phase of the same flow: its REAL behaviour (what the agent said and called) becomes this case's history. Two children of one parent = branches. */
  after?: string;
  /** `cost`: token-consuming on purpose (loops, heavy work); `loop`: a repeat to continue or stop; `split_task`: splitting work. See TestCases/tags.ts */
  tags?: TestTag[];
  /** scripted earlier turns (used on top of the history from `after`) */
  messages?: { role: "user" | "assistant"; text: string }[];
  /** what the world returned to the agent's last calls / what it already has (files it read, agent results, team digest, project memory): shown so one turn is enough */
  stuff?: { title: string; text: string }[];
  /** what a FREE LOOK of this case shows when the agent makes one (cat / ls / Read / grep ...): the first entry whose `match` (regex over the call as text) fits is handed back; no entry = "(no output)". Keep these real: they are the files the agent would see. */
  looks?: { match: string; text: string }[];
  /** a REAL little world for the agent's free looks: path (as the agent sees it, e.g. run_test/shop/package.json) -> file text. Its read-only looks (ls, cat, find, grep, head, wc, Read) are run for real against exactly these files. Prefer this over `looks`. Not inherited by a chained case: share a const. */
  files?: Record<string, string>;
  /** what the lead sees when it looks at the team (agents_list / board_status) in this case: one line per agent with its state. Without it the look says the roster is not shown. */
  roster?: string;
  /** the new message: the person's words for the master, the hand-over for a sub-agent */
  user_message: string;
  /** the master only: which sub-agents it has (default: all it declares) */
  team?: string[];
  expect: PromptExpect;
}
export interface PromptSuite {
  /** file name without .ts: master_test, master_test2, master_test3, builder_test ... */
  name: string;
  agent: string;
  about: string;
  cases: PromptCase[];
}
