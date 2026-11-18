import type { TestTag } from "../../../../tags.ts";
import type { Case } from "@core/types.ts";
import { subCase } from "../lib/make.ts";

// Sub-agent suite: PLANNER (agents/planner/.claude/CLAUDE.md). Contract under test for the SMALL paths (cheap): a small job gets a short numbered
// plan (at most 8 lines, every request covered, no research, no plan folder); findings are triaged into out_of_scope / duplicate /
// conflicts_with_request / needs_person / valid and end with one `TRIAGE: [...]` line; a problem reported against the plan is judged (plan defect
// or not) and the plan files are updated when it is. The BIG product plan (R&D, plan_lint, PHASES.md) is NOT here: it costs real web fetches;
// it is judged by test_prompt_planning and real_planning_prototype.
export const tags: TestTag[] = ["multi_ag", "single_prompt", "split_task"];

export const cases: Case[] = [
  subCase("planner", {
    id: "sp_small_job_short_plan", title: "a small job: a short numbered plan, at most 8 lines, nothing invented, no research",
    task: "Small job: on the one-page site in run_test/site add (1) a dark-mode toggle button in the header and (2) a footer with the text '(c) 2026 Acme'. Give me the plan.",
    must: "A numbered plan of at most 8 lines covering BOTH requests (toggle, footer) and nothing else (no analytics, no redesign, no framework change). No web search or fetch, no run_test/plan folder, no files written. Plain words.",
  }),
  subCase("planner", {
    id: "sp_triage_findings", title: "triage 4 findings: each labelled, one TRIAGE line",
    task: "Request was: 'add a footer with the copyright text to run_test/site'. A reviewer listed these findings, triage each one: F1 the footer text is missing on the pricing page; F2 the footer is missing on the pricing page (same as F1, worded differently); F3 rewrite the whole site in React; F4 should the copyright year be 2025 or 2026? (the request does not say).",
    must: "F1 valid; F2 duplicate (of F1); F3 out_of_scope (nobody asked); F4 needs_person (only the person can decide the year). The answer ends with one line `TRIAGE: [...]` listing all four with those labels. No files are changed.",
  }),
  subCase("planner", {
    id: "sp_plan_defect_updates_plan", title: "a team reports a problem against the plan: decide it is a plan defect, update the plan file, say who is affected",
    seed: { "plan/README.md": "# Notes app plan\n\n## Screens\n1. List: all notes, newest first.\n2. Editor: title + body, Save button.\n\n## Roadmap\n- Phase 1: List + Editor (builder A).\n- Phase 2: sync (builder B).\n" },
    task: "A builder reports against the plan in run_test/plan/README.md: 'The List screen has a Delete button in the design the person approved, but the plan lists no delete behaviour, so I cannot tell if delete asks for confirmation or is undoable.' Decide whether this is a plan defect and, if it is, update the plan.",
    must: "The planner calls it a plan defect, EDITS run_test/plan/README.md (adds the delete behaviour with a sensible default, e.g. confirmation, and marks it as an assumption), names the affected team (builder A, phase 1), and says the person may want to confirm the default. It does not rewrite the other screens or the roadmap.",
  }),
];
