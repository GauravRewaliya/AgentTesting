import type { TestTag } from "../../tags.ts";
import type { Case } from "@core/types.ts";

// Workflow patterns taken from the old test_agent/cases (11 real-task cases), reduced to what any multi-agent harness must do:
//   constraint passes through the hand-over, follow-up that refers to a prior answer, plan -> approval gate -> build,
//   implement -> review -> fix loop, honest handling of a sub-agent failure. Judged from the report, not asserted.
const common = { agents: ["planner", "builder", "reviewer", "researcher"] };
export const tags: TestTag[] = ["multi_ag", "coding", "split_task"];   // each case adds single_prompt / multi_prompt
export const cases: Case[] = [
  {
    id: "wf_1_readonly_review", tags: ["single_prompt"], title: "[old 01/02] a read-only constraint must reach the sub-agent", ...common,
    turns: [{ user: "Review the auth module and list its weaknesses. Do not change any code.",
      expected: { context: "The lead calls the reviewer once (a read-only job, not the builder or planner). The hand-over keeps the constraint: do not change any code / read only. The lead passes the list of weaknesses on and writes or edits nothing itself. No files appear in run_test.", expected_agents_res: ["wf-review-auth"] } }],
  },
  {
    id: "wf_2_followup_prior_answer", tags: ["single_prompt"], title: "[old 09] a follow-up that refers to the previous answer ('the first two you listed')", after: "wf_1_readonly_review", ...common,
    turns: [{ user: "Good. Now fix the first two weaknesses you listed.",
      expected: { context: "The lead must NOT assume the next agent remembers the list. It spawns the builder (a fix job) and the hand-over itself names the first two weaknesses (PBKDF2 iterations, secure-cookie flag) taken from the earlier answer, not just 'the first two'. It does not call the reviewer again. auth/hash.ts and auth/cookies.ts appear.", expected_agents_res: ["wf-fix-auth"] } }],
  },
  {
    id: "wf_3_plan_approval_gate", tags: ["multi_prompt"], title: "[old 11] plan first, wait for approval, then build with the plan handed over", needs: ["sandbox.files"], ...common,
    turns: [
      { user: "Add CSV export to the orders page. Plan first; I want to approve before you write code.",
        expected: { context: "Turn 1: the lead calls ONLY the planner (hand-over says plan only, no code), then stops and asks the user to approve the plan. It does not call the builder yet. plan.md appears in run_test; no orders/export.ts.", expected_agents_res: ["wf-plan-csv"] } },
      { user: "Approved, go ahead.",
        expected: { context: "Turn 2: after the approval the lead calls the builder, and the hand-over names plan.md (or carries its content) and the approval. It does not re-plan. orders/export.ts appears.", expected_agents_res: ["wf-build-csv"] } },
    ],
  },
  {
    id: "wf_4_review_fix_loop", tags: ["single_prompt"], title: "[old 10] implement, review (fresh agent), fix what the review found", needs: ["multiagent.sequential", "session.followup"], ...common,
    turns: [{ user: "Add input validation to the signup form (email format, password length 12+), have it reviewed by the reviewer, and fix whatever the review finds.",
      expected: { context: "Order: builder (new session, builder#1) -> reviewer (a DIFFERENT, fresh session that does not share the builder's memory; the hand-over names the file signup/validate.ts) -> the review findings (email without a dot in the domain, no maximum password length) are handed to the builder again: either a follow-up to builder#1 or a new builder whose hand-over carries both findings. The lead does not fix anything itself.", expected_agents_res: ["wf-build-signup", "wf-review-signup", "session:builder#1"] } }],
  },
  {
    id: "wf_5_failure_honesty", tags: ["single_prompt"], title: "[old 05] a sub-agent fails: the lead reports it, does not invent a result", needs: ["lookup.notfound"], ...common,
    turns: [{ user: "Read https://example.com/docs/pricing and summarise the pricing table for me.",
      expected: { context: "The lead calls the researcher once. The sub-agent returns an ERROR (page could not be fetched). The lead tells the user plainly that it failed and why, does NOT make up a pricing table, does not claim success, and does not retry in a loop or work around it itself.", expected_agents_res: ["wf-fetch-fail"] } }],
  },
];
