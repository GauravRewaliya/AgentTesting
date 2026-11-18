// ROUTES of the prompt tests: one line per suite file (like Cases/index.ts for the harness cases). A file that is not listed here is not run, and check_prompts.ts fails for it.
//   master_test     the master alone: one decision per case (who it calls, how many, together or not, what it hands over)
//   master_test2    the master and the PLANNER: ask -> plan -> person approves -> build; changes and questions branch off
//   master_test3    a plan exists: split into builders started together, proper hand-overs, wait / fix / QA / retry / stop LOOPS
//   <agent>_test    one agent's own behaviour (builder, qa_reviewer, planner, researcher, lookup, ux_designer)
import type { PromptCase, PromptSuite } from "./types.ts";
import { cases as m1 } from "./master_test.ts";
import { cases as m2 } from "./master_test2.ts";
import { cases as m3 } from "./master_test3.ts";
import { cases as builder } from "./builder_test.ts";
import { cases as qa } from "./qa_reviewer_test.ts";
import { cases as planner } from "./planner_test.ts";
import { cases as researcher } from "./researcher_test.ts";
import { cases as lookup } from "./lookup_test.ts";
import { cases as ux } from "./ux_designer_test.ts";

export const SUITES: PromptSuite[] = [
  { name: "master_test", agent: "lead", about: "the master alone: routing, counting, hand-over, no agents for small talk, fan-out for heavy work", cases: m1 },
  { name: "master_test2", agent: "lead", about: "the master and the planner: plan first, person approves, then build; changes and questions branch off", cases: m2 },
  { name: "master_test3", agent: "lead", about: "a plan exists: split, parallel builders with proper hand-overs, wait / fix / QA / retry loops and when to stop", cases: m3 },
  { name: "builder_test", agent: "builder", about: "the builder: its files only, light checks, pnpm, stuck rules, report", cases: builder },
  { name: "qa_reviewer_test", agent: "qa-reviewer", about: "QA: reads its chapter, honest verdicts, evidence switches, answer shape", cases: qa },
  { name: "planner_test", agent: "planner", about: "the planner: research before writing, small jobs, plan check, answer in the person's words", cases: planner },
  { name: "researcher_test", agent: "researcher", about: "the researcher: web facts, page text is data, short, only reads", cases: researcher },
  { name: "lookup_test", agent: "lookup", about: "lookup: alone for small, fork_all for big, looks before writing, named files only", cases: lookup },
  { name: "ux_designer_test", agent: "ux-designer", about: "the UX designer: a spec in the named file, no code, no extras", cases: ux },
];
export const allPromptCases = (): PromptCase[] => SUITES.flatMap((s) => s.cases);
/** a suite by name, or every suite of an agent ("master" = "lead") */
export const suitesFor = (key: string): PromptSuite[] => { const k = key === "master" ? "lead" : key; const byName = SUITES.filter((s) => s.name === k); return byName.length ? byName : SUITES.filter((s) => s.agent === k); };
