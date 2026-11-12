// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EXPECTED FLOW OF A REWORK CASE (do not remove: this is what we compare the code and every run against)
//
//   The user gives ONE task (e.g. "build the app WITH Tailwind/NativeWind ... then check the reply, if anything is absent have it added").
//
//   1. LEAD -> expo-go     The lead hands the whole task over (folder, PLAN.md, the full list of what is wanted).
//   2. GATE checks it      FixtureGate (f1_multiagent/harness/core/fixture_gate.ts) checks the hand-over message (guard rules:
//                          names run_test + PLAN.md, long enough) and looks for a recorded result by keywords.
//                          - hand-over wrong/thin      -> "NOT ACCEPTED", the lead must send it again (nothing runs, this uses one of max_agent_calls)
//                          - hand-over good + matches  -> the recorded result's run() is EXECUTED (the copy/patch script writes the files into run_test/)
//   3. FIXTURE 1 (-ve)     <id>.ts  = INCOMPLETE work: files exist, but NOT as asked (no Tailwind, wrong structure ...).
//                          Its reply says "Done" but states the facts (StyleSheet used, only 1 file changed ...). It does NOT confess.
//   4. LEAD CHECKS         The lead (no file tools) compares the reply/REPORT with its own list from the user. It must NOT say "done".
//                          It may ask once / re-check, and look at the changed-file list: things from the list are missing.
//   5. LEAD -> expo-go     A NEW call (a sub-agent has no memory): restates the whole task AND says what was MISSING / wrong
//                          (NO special word needed: fixture 2 declares match.after = fixture 1, so the gate serves it as the 2nd answer whatever words are used).
//   6. FIXTURE 2 (+ve)     <id>_fix.ts = "You are right, sorry ..." + the COMPLETE work (script removes the bad files, applies the real patch).
//   6b. LEAD VERIFIES     (optional, once) the lead may ask the sub-agent / look at the changed-file list again. The gate answers "already done" (no new work); a 2nd verify or a 3rd real call fails.
//   7. LEAD ANSWERS USER   Tells the truth: the first attempt did not follow the plan (what was absent), it was redone, now it has X.
//
//   PASS = exactly these two recorded results were served, in this order (the judge counts each served result once, see
//          f1_multiagent/testrun/cases.ts judgeTurn). FAIL = lead said done after fixture 1 / never re-called / called a 3rd time /
//          wrong hand-over (corrected) too often.
//
//   ┌─ KNOWN WRONG PASS (L21-L23 above is too weak, kept on purpose so we remember) ──────────────────────────────────────────────┐
//   │ Real run (f1, haiku lead, fresh store): both fixtures were served in order -> judge printed PASS. But the lead's FINAL reply to the │
//   │ user said "The app is not finished ... I could not get it to address the missing items", although the fix HAD been applied: the lead  │
//   │ cannot read files, distrusted the "already done" answers and asked 2 more times. So PASS only proves WHO was called, not that the     │
//   │ lead understood the result or told the truth. Wrong-pass kinds: (a) right calls + wrong/confused final answer, (b) right calls but the│
//   │ 2nd hand-over did not really name the gaps. Fix status: observer block added to every served/verify reply (lead now SEES the changes);│
//   │ still TODO: assert the final reply (see TestCases/test_folders/TODO.md T-01).                                                         │
//   └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
//
//   Reading the status: `bun testrun/run.ts test_expo_go <id>` from f1_multiagent/ -> per-turn call list + expected list + lead reply.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
//
// REWORK cases: the sub-agent does PART of the job, the lead checks its reply against the request, and has it fixed.
// Plain cases, no builders. Each case = ONE user message and TWO recorded expo-go answers, in this order:
//   1. NEGATIVE  results/test_expo_go/role-expo-go-<id>.ts       the work is incomplete / ignores the plan, its reply still says "Done" but states the facts
//   2. POSITIVE  results/test_expo_go/role-expo-go-<id>_fix.ts   "you are right, sorry" + the complete work
// Both answers have the same keywords; the _fix one has `match.after: <first id>`, so it is only served once the first one was (pickRecorded in harness_own_custom/main.ts).
import type { Case } from "@core/types.ts";
import { expoGo } from "./lib/shared.ts";

const shared = { ...expoGo, max_agent_calls: 4 } as const;   // 2 answers expected (bad, fix) + room for ONE corrected hand-over and ONE verify ask after the fix (answered 'already done', not counted by the judge)

export const cases: Case[] = [
  {
    ...shared,
    id: "eg_tw_rework_notailwind",
    title: "[ref expo/examples/with-tailwindcss] builder forgets Tailwind: lead must notice and have it added",
    turns: [{
      user: "Create the app in run_test/tw-rework: an Expo Router app styled with Tailwind through NativeWind. It must have the NativeWind and tailwind packages, src/global.css, the Metro and PostCSS config, tw wrapper components for View/Text/Link/Image, a root layout and an index screen that uses className only (no StyleSheet). Write PLAN.md first, then do it. When the sub-agent answers, compare its reply with this list yourself; if anything on it is absent, call it again and have that added.",
      allowed: ["expo-go"],
      expected: {
        context: "Call 1: expo-go gets the full list. NEGATIVE answer: a router app styled with StyleSheet.create, no nativewind/tailwind packages, no global.css, no metro/postcss config, no tw wrappers; it says 'Done' but names StyleSheet and lists 4 files. "
          + "The lead compares that with its list, does NOT report success, and calls expo-go AGAIN (new call, no memory)"
          + "Call 2: POSITIVE answer: 'You are right, sorry...' + the full Tailwind setup (11 files). Judge: exactly two calls, the second names the concrete gaps, the final reply tells the user it was redone.",
        expected_agents_res: ["role-expo-go-eg_tw_rework_notailwind", "role-expo-go-eg_tw_rework_notailwind_fix"],
        reply_must: ["nativewind"], reply_forbid: ["not finished", "not done", "not complete"],   // the wrong pass of 2026-11-12: right calls, final answer "not done"
      },
    }],
  },
  {
    ...shared,
    id: "eg_lintab_02_rework",
    branch_from: "eg_lintab_01_4da28ef",
    title: "[ref github SchroederNathan/linear-tab-bar] builder ignores the file structure: lead must notice and have it redone",
    turns: [{
      user: "In run_test/linear make the pill a draggable pill: dragging across it stretches it and moves a glow under the finger. I want this structure: gesture logic in src/hooks/usePillGestures.ts and src/hooks/useSearchGestures.ts, every colour/size in src/constants/theme.ts (nothing hardcoded in components), wired into TabBar, TabBarPill, SearchButton and App.tsx. Write PLAN.md first, then do it. After the sub-agent answers, check that its reply really matches this structure; if not, have it redone.",
      allowed: ["expo-go"],
      expected: {
        context: "Call 1: expo-go gets the structure. NEGATIVE answer: ONE new file TabBar/DragPill.tsx with the gesture code and hex colours inline, no hooks, no theme values, nothing wired; it says 'Done' and lists the single file. "
          + "The lead spots the mismatch and calls expo-go AGAIN"
          + "Call 2: POSITIVE answer: 'You are right, sorry...' + removes DragPill.tsx and builds hooks/usePillGestures.ts, hooks/useSearchGestures.ts, constants/theme.ts and the wiring. Judge: exactly two calls, second names the gaps, final reply says it was redone.",
        expected_agents_res: ["role-expo-go-eg_lintab_02_rework", "role-expo-go-eg_lintab_02_rework_fix"],
        reply_forbid: ["not finished", "not done", "not complete"],
      },
    }],
  },
];
