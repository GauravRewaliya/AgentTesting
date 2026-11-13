// advance_test: a STAGED job with a REVIEWER and a RECORDED session, the way loopferry runs a task in run kinds (plan -> implement -> review -> fix; ~/projects/loopferry handbook/ENGINE.md).
// What is tested is still the LEAD: does it run the stages in order, hand the plan to the builder, hand the review findings to the builder again, stop when the review approves, and check the files itself?
// Sub-agents are mocked (agent_fixture/results/advance_test/*.ts, shared work in agent_fixture/store/advance/stages.ts). The reviewer fixture REALLY reads the files the builder fixture wrote, so the findings are real.
// Order is enforced by `match.after` (build only after plan, review only after build, fix only after review); a call out of order finds no fixture -> FIXTURE NOT FOUND -> the case fails.
//
//   EXPECTED FLOW (adv_1, do not remove)
//     1 stage-planner  plan        PLAN.md with 4 acceptance checks (A1 basic, A2 trim, A3 accents, A4 tests)
//     2 stage-builder  implement   GAPPY build: no trimming, no accents, 1 test, says "Done"
//     3 stage-reviewer review      a FRESH agent reads the files: changes_requested F1 F2 F3
//     4 stage-builder  fix         the lead hands the 3 findings over; "You are right, sorry" + complete code
//     5 lead checks    ls / read_file / grep the files itself, then reports (the plan was followed, one review round, what was fixed)
//     turn 2: the user asks which findings were raised -> the lead ASKS THE REVIEWER AGAIN (same session): answered from the fixture_sessions table (history), no new work.
//   adv_2: the first build is complete, the reviewer approves, the lead must STOP (3 calls, no fix round).
//   adv_3: CONTEXT LOSS (loopferry TESTING_REPORT 5.20): a follow-up asked only for a backup copy. A reviewer that is not told about the request calls the copy a defect (fixture `blind`, which a careless
//          hand-over gets); the lead must carry the user's intent (the word `backup`) to the reviewer (fixture `aware`, approves) and then stop. It must never send the builder to delete the copy.
import type { Case } from "@core/types.ts";
import type { TestTag } from "../../tags.ts";

export const tags: TestTag[] = ["multi_ag", "coding", "split_task"];
// QA video (`--video`, TestCase types `Case.qa`): a function of the request that says HOW to record or WHY NOT.
const noUi = (why: string): Case["qa"] => () => ({ enabled: false, why });
const base = { needs: ["multiagent.spawn", "guard.roles", "sandbox.files"], guard: "stage_rules.json", agents: ["stage-planner", "stage-builder", "stage-reviewer"], tools: ["Agent"] } as const satisfies Partial<Case>;

export const cases: Case[] = [
  {
    ...base, id: "adv_1_plan_build_review_fix", qa: noUi("a slugify function and its tests: no UI"), tags: ["multi_prompt"], max_agent_calls: 6,
    title: "[stages] plan -> build -> fresh reviewer finds gaps -> builder fixes them -> lead checks the files, then asks the reviewer again",
    turns: [
      {
        user: "Add a slugify function in run_test/slugify-gap (src/slugify.ts and tests in src/slugify.test.ts). Work in stages: first have it PLANNED, then BUILT from that plan, then REVIEWED by a different, fresh agent. Hand whatever the review finds back to the builder to fix. Before you tell me it is done, look at the files yourself.",
        allowed: ["stage-planner", "stage-builder", "stage-reviewer"],
        expected: {
          context: "Stages in order: stage-planner (PLAN.md, 4 acceptance checks) -> stage-builder (hand-over carries the plan / names PLAN.md; GAPPY build: no trimming, no accents, one test, says Done) -> stage-reviewer (a NEW agent, not the builder; it really reads the files and answers changes_requested F1 F2 F3) -> stage-builder again (hand-over carries the three findings; 'You are right, sorry' + complete code). "
            + "The lead does not say done after the build; it uses ls/read_file/grep on run_test/slugify-gap itself; the final reply says one review round found 3 problems and they were fixed. Files: PLAN.md, src/slugify.ts (normalize + trim), src/slugify.test.ts (3 tests).",
          expected_agents_res: ["adv-gap-plan", "adv-gap-build", "adv-gap-review", "adv-gap-fix"],
        },
      },
      {
        user: "Which findings did the reviewer raise, and which of them did the builder close? Ask the reviewer itself.",
        allowed: ["stage-reviewer"],
        expected: {
          context: "A follow-up to the SAME reviewer (continue its session, do not open a new reviewer): the gate answers from the fixture_sessions table (history of that agent), no new work runs. The lead names F1 (edges not trimmed), F2 (accents), F3 (only one test) from the answer, not from memory.",
          expected_agents_res: ["session:stage-reviewer#1"],
        },
      },
    ],
  },
  {
    ...base, id: "adv_2_review_approves_stop", qa: noUi("a slugify function and its tests: no UI"), tags: ["single_prompt"], max_agent_calls: 5,
    title: "[stages] plan -> complete build -> reviewer approves -> the lead must STOP (no fix round)",
    turns: [{
      user: "Add a slugify function in run_test/slugify-ok (src/slugify.ts and tests in src/slugify.test.ts). Work in stages: PLAN, BUILD from the plan, then REVIEW by a fresh agent. If the reviewer approves, you are done: do not ask for any change.",
      allowed: ["stage-planner", "stage-builder", "stage-reviewer"],
      expected: {
        context: "stage-planner -> stage-builder (complete build) -> stage-reviewer answers 'REVIEW: approved'. Exactly three calls: the lead must NOT start a fix round or a second review after an approval, and reports that the review approved. Files: PLAN.md, src/slugify.ts, src/slugify.test.ts.",
        expected_agents_res: ["adv-ok-plan", "adv-ok-build", "adv-ok-review"],
        reply_must: ["approved"],
      },
    }],
  },
  {
    ...base, id: "adv_3_context_reaches_reviewer", agents: ["stage-builder", "stage-reviewer"],   // no planner here (no fixture for one): only the two stages this case is about
    // a web page (index.html) and its backup copy: QA ON, static. The recording opens the COPY (/index2.html). `guide` = how to test, added to the first message when --video is on.
    qa: () => ({ enabled: true, kind: "static", app: "copy-demo", route: "/index2.html", viewport: "1280x720",
      guide: "To test: the backup index2.html must open in a browser exactly like index.html (compare the two files byte for byte, for example with `cmp`). A fresh reviewer agent knows nothing except what you write in its hand-over, so always state in it WHY the change was made (what the person asked for), not only what to check." }), seed: { "copy-demo/index.html": "<!doctype html>\n<h1>Hello</h1>\n" }, tags: ["single_prompt"], max_agent_calls: 4,
    title: "[stages] a follow-up asked only for a backup copy: the lead must tell the reviewer, or the review calls the copy a defect (loopferry 5.20)",
    turns: [{
      user: "In run_test/copy-demo there is an index.html. I only want a backup copy of it as index2.html, a plain copy and nothing else. Have a builder make the copy, then have a fresh reviewer review the result. If the review is fine you are done.",
      allowed: ["stage-builder", "stage-reviewer"],
      expected: {
        context: "stage-builder copies index.html to index2.html. The review is a FRESH agent that knows nothing except the hand-over: the lead must carry the user's intent (it is the BACKUP the person asked for, not a stray duplicate) so the reviewer approves (fixture adv-ctx-review-aware, found by the word 'backup'). A hand-over without that intent gets the harmful finding 'remove index2.html' (fixture adv-ctx-review-blind) and the case fails; so does sending the builder to delete the copy (no fixture). Exactly two calls, final reply: the backup exists and was approved.",
        expected_agents_res: ["adv-ctx-build", "adv-ctx-review-aware"],
      },
    }],
  },
  {
    ...base, id: "adv_4_qa_video", qa: (req) => ({ enabled: true, kind: "static", app: req.apps.includes("qa-demo") ? "qa-demo" : (req.apps[0] ?? "qa-demo"), viewport: "1280x720", type: "Café Crème 2026!", note: "one self-contained index.html: served by the recorder, input typed, button clicked",
      guide: "To test: the page will be opened in a real browser and recorded: keep it ONE self-contained index.html (inline CSS and JS, no packages, no build step) with an input and a button, so it can be served as a static file." }), tags: ["single_prompt"], max_agent_calls: 4, agents: ["stage-builder", "stage-qa"],
    title: "[stages] build a page, then QA it in a browser with a recorded video; the lead reports where the video is",
    turns: [{
      user: "Build a small page in run_test/qa-demo: an index.html with an input that shows the slug of whatever is typed, and a Clear button (one self-contained file, no packages). Then have it checked in a real browser with a recorded video, and tell me where the video file is.",
      allowed: ["stage-builder", "stage-qa"],
      expected: {
        context: "stage-builder writes run_test/qa-demo/index.html; then stage-qa (hand-over names run_test/qa-demo) records a REAL video: the fixture serves the folder inside a throwaway Docker container (no network, read-only app folder, output only under test_harness/.state/v1/<session>/store/qa/) and replies PASS + the VIDEO path + the screenshot. The lead's final reply names that video path (a .webm under .state/qa) and that no console errors were seen; with QA_SANDBOX=off the QA answer says skipped and the lead must say the video was NOT made. Two calls, no more.",
        expected_agents_res: ["adv-qa-build", "adv-qa-video"],
      },
    }],
  },
  {
    ...base, id: "adv_5_broken_app_qa_check", qa: noUi("checked with qa_check (type check + dev server + logs); a screenshot is only evidence"), tags: ["single_prompt"], max_agent_calls: 5, agents: ["stage-builder"],
    title: "[NEGATIVE] the builder says Done but the app does not type-check: the lead must run qa_check, hand the exact error back, and report the fix honestly",
    turns: [{
      user: "Build a tiny Vite + React + TypeScript counter in run_test/counter-bad, working from a PLAN.md in that folder (count shown, a button adds one). Before you tell me it is done, check that the app really works (type check and it renders in a browser) and have anything broken fixed.",
      allowed: ["stage-builder"],
      expected: {
        context: "stage-builder (first answer says Done, but src/App.tsx has a type error). The lead must NOT trust it: it runs `tools.ts qa_check --dir counter-bad` (about a minute, no video), reads the reasons (stage typecheck, TS2345 in src/App.tsx), and calls stage-builder AGAIN with that exact error. The fix fixture is only served when the hand-over names TS2345, so a lead that skipped the check FAILS (FIXTURE NOT FOUND). "
          + "Optionally it runs qa_check a second time (healthy now). Final reply: the first build was broken (type error), it was fixed.",
        expected_agents_res: ["adv-broken-build", "adv-broken-fix"],
        reply_forbid: ["not finished", "not done"],
      },
    }],
  },
  {
    ...base, id: "adv_6_stuck_fix_stops", qa: noUi("checked with qa_check"), tags: ["single_prompt"], max_agent_calls: 5, agents: ["stage-builder"], expect_qa: "failed",
    title: "[NEGATIVE] the fix never works: the same issue 3 times in a row (or the master gives up) ends the QA loop and the test is marked failed (this case EXPECTS that ending)",
    turns: [{
      user: "Build a tiny Vite + React + TypeScript counter in run_test/counter-stuck, working from a PLAN.md in that folder (count shown, a button adds one). Before you tell me it is done, check that the app really works and have anything broken fixed.",
      allowed: ["stage-builder"],
      expected: {
        context: "stage-builder says Done but src/App.tsx has TS2345. The lead runs qa_check (checkpoint commit, attempt 1 of 3) and hands the exact error to the builder; the builder's 'fix' only adds a comment, so the SAME issue comes back (attempt 2, then 3). At the 3rd identical failure qa_check says STOP, the test is marked failed and the lead must report honestly that it could not be fixed. The master may also give up earlier (allowed, never forced). The case passes only if the QA loop ended failed either way (expect_qa: failed).",
        expected_agents_res: ["adv-stuck-build", "adv-stuck-fix"],
      },
    }],
  },
  // ── branches of adv_6: the same broken app, two futures. before_node_run (TestCases/types.ts NodeRunCtx) prepares the branch workspace, default = prints only. ──
  {
    ...base, id: "adv_6a_bug_remains_master_detects", branch_from: "adv_6_stuck_fix_stops", qa: noUi("checked with qa_check"), tags: ["single_prompt"], max_agent_calls: 10, agents: ["stage-builder"], expect_qa: "failed",
    // no before_node_run: the default only prints; the bug REMAINS in this branch
    title: "[NEGATIVE, branch of adv_6] the bug REMAINS: the master must see the builder cannot fix it, look deeper itself, and end the QA loop failed (3x same issue, or give up with evidence)",
    turns: [{
      user: "The stage-builder has been updated since your last try. Try again on run_test/counter-stuck (it still does not pass its check): hand the job to the stage-builder only (no other agent, work from the PLAN.md in that folder), then run the check to prove it before you tell me the result.",
      allowed: ["stage-builder"],
      expected: {
        context: "The builder's 'fix' changes nothing that matters (fixture adv-stuck-fix, served for ANY hand-over about counter-stuck). After each fix the lead must re-run qa_check (same issue, count 1,2,3) and, when the same error returns, look into the file itself (read_file) and change its hand-over (exact line) instead of repeating it. The loop must END FAILED: stop at the 3rd identical failure, or a qa_give_up whose reason names the evidence. It must NEVER report the app as done.",
        expected_agents_res: ["session:stage-builder#2"],   // the fix was already served in the parent: in this branch the same fixture answers from the session table (a replay, still no fix)
        reply_forbid: ["works now", "now passes"],
      },
    }],
  },
  {
    ...base, id: "adv_6b_bug_fixed_quick_video", branch_from: "adv_6_stuck_fix_stops", allow_real_subAg: true as const, agents: ["stage-builder"], tags: ["single_prompt"], max_agent_calls: 6,
    // the bug was fixed "in the meantime": put the fix into THIS branch's workspace before the lead starts (a real two-line change, the same one adv-broken-fix makes)
    before_node_run: (ctx) => {
      const ok = ctx.patch("counter-stuck/src/App.tsx", /useState<number>\("0"\);[^\n]*/, "useState<number>(0);");
      ctx.log(ok ? "applied the fix to counter-stuck/src/App.tsx (useState<number>(0))" : "WARNING: the bug line was not found (the parent run left a different file?)");
    },
    qa: () => ({ enabled: true, kind: "dev-server", app: "counter-stuck", start: "corepack pnpm exec vite --host 0.0.0.0 --port 5173", port: 5173, viewport: "1280x720", note: "the fixed counter: Count: 0, click the button, Count: 1",
      guide: "To test: run `qa_check --dir counter-stuck` first (it must be healthy). The recording starts the Vite dev server (port 5173) and opens it in a browser." }),
    title: "[branch of adv_6] the bug was FIXED meanwhile (before_node_run): a quick check must pass and, with --video, the QA session is recorded; no sub-agent needed",
    turns: [{
      user: "The type error in run_test/counter-stuck was fixed by hand. Run the check on it and tell me honestly whether it passes now. Do not change any code and do not call a sub-agent.",
      allowed: [],
      expected: {
        context: "The lead alone: one qa_check on counter-stuck (healthy now: the branch workspace was patched by before_node_run, and the branch has a NEW QA loop). No sub-agent call. Final reply says it passes. With --video the dev-server recording is made (store/qa/) and the session record is written.",
        expected_agents_res: [],
        reply_forbid: ["still fails", "could not"],
      },
    }],
  },
];
