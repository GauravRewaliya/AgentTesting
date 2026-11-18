import type { TestTag } from "../../../../tags.ts";
import type { Case } from "@core/types.ts";
import { subCase } from "../../subagents/lib/make.ts";
import { seedSakura } from "./lib/seed.ts";

// test_treejs_sakura: "a three.js sakura page with a demo video", found in real sessions (2026-11-18) that were slow, over-split and wasteful. THREE cases, all REAL (credits: by case id, on purpose):
//   tj_1_full_real      the whole flow with every agent real: request -> lead -> builder -> QA. ONE builder, never told to record; ONE QA that LOOKS, one video, at most two pictures; the final answer gives the video.
//   tj_2_pass_build     the REAL good build (rs_sakura_page_mwm8na741, qa/build_b_cdn) -> QA: must look, PASS it, rate the quality.
//   tj_3_hard_negative  the REAL close-but-not build (rs_sakura_page_mwm8na740, qa/build_a_vendored) -> QA: must look and FLAG what is not good; not a clean PASS.
// Cases 2 and 3 use the two files exactly as they were built (see ./qa/README.md); nothing is mutated. Every case is BOUND by `audit` (core/session_audit.ts): time, tool calls, builders, ONE video, at most two pictures,
// no picture of motion, no ffmpeg / sleep, cost. A broken bound fails the case with the reasons. The hand-over guard for fixture runs is store/sakura_rules.json (see self_test/gate_by_case.ts gb.5-gb.9).
export const tags: TestTag[] = ["multi_ag", "single_prompt", "coding"];

const REQUEST = "can you give me famous sakura animated rotating and falling leaf animation and minecraft look stuff using three js\nindex.html with proper codes i want preview of it to look on can use any thing as you want\nalso i want you to create a demo video of it too";
const QA_TASK = "Verify run_test/sakura: a three.js cherry-blossom (sakura) scene with a Minecraft look. Check: it loads with no console errors, the camera auto-rotates, pink petals fall, the buttons work (rotate, day / sunset, petals). Record ONE demo video of the flow. Also judge the quality: is it really a sakura scene, and does it look professional? If anything is not good, say what and why.";
const QA_BOUND = { expect: "plain", budget: { total_s: 240, qa_s: 150, qa_calls: 12, videos: 1, pictures: 2, cost_usd: 0.5 } } as const;
const LOOKS = "It really LOOKED at the scene: the one or two pictures it must judge (the main view; the sunset look only if it changes the look), taken inside the ONE video script and read, NO picture of motion (the video shows motion). ONE video, one report, no ffmpeg, no sleep loop, no second recording, no --out name. The real project is untouched.";

/** add words the lead's final reply must / must not contain to every turn of a case (the sub-agent cases are built by subCase, which has no such fields) */
const withReply = (c: Case, r: { reply_must?: string[]; reply_forbid?: string[] }): Case => ({ ...c, turns: c.turns.map((t) => ({ ...t, expected: { ...t.expected, ...r } })) });

export const cases: Case[] = [
  {
    id: "tj_1_full_real", title: "[test_treejs_sakura] FULL REAL: request -> lead -> ONE builder (never told to record) -> ONE QA that looks, one video, two pictures at most; the answer gives the video",
    needs: ["multiagent.spawn", "sandbox.files"], lead: "lead_team", tools: ["Agent"], agents: ["builder", "qa-reviewer"],
    allow_real_subAg: true as const, max_agent_calls: 3, max_cost_usd: 1.2,
    audit: { expect: "page", budget: { total_s: 300, qa_s: 150, qa_calls: 12, videos: 1, pictures: 2, max_builders: 1, cost_usd: 0.8 } },
    turns: [{
      user: REQUEST,
      expected: {
        context: "Everything is REAL. The lead calls ONE builder (a page this size is one builder, not several) with the request, the files to write and the shared ids; the builder is NEVER told to record a video, take screenshots, run a browser or write a recorder / package.json (the audit fails the run when a builder does). After the build the lead calls ONE qa-reviewer: WHAT to check and that ONE demo video is wanted, never HOW (no playwright / ffmpeg / pnpm dlx, no file paths or formats for the video). QA " + LOOKS + " The final answer is in the person's words and LEADS WITH THE THING: a preview LINK (http://...) and what was built (by what they see), then the video, then QA in two or three lines (the verdict and what matters), never a list of every check. A builder hand-over is a RICH brief (5 to 8 concrete scene elements and a proper file structure), not one thin self-contained file.",
        expected_agents_res: [], expected_roles: ["builder", "qa-reviewer"], reply_must: ["video", "http"], reply_forbid: ["ffmpeg", "playwright"],   // the person gets the PREVIEW LINK (http://...) and the video
      },
    }],
  },
  withReply({
    ...subCase("qa-reviewer", {
      id: "tj_2_pass_build", title: "REAL good build (session ...741) -> QA: must LOOK, PASS it, rate the quality; bounded",
      task: QA_TASK, cap: 0.5,
      must: "First line PASS (everything asked works, nothing blocks it; polish ideas go under POLISH:, never lower it), a `QUALITY:` line that is good or decent (never poor). " + LOOKS + " It says it IS a sakura scene (pink blossoms and petals, voxel look), that rotation and the buttons work, gives ONE demo video and a short quality judgement: a good result. Bounded: at most 150 s, 12 tool calls.",
    }),
    agents: ["builder", "qa-reviewer"], max_agent_calls: 6,   // chat-able: after the QA turn the person can go on ("improve it") and the lead may call a builder, then QA again
    before_node_run: (ctx) => seedSakura(ctx, "pass"), audit: QA_BOUND,
  }, { reply_must: ["QUALITY:"], reply_forbid: ["quality: poor"] }),
  withReply({
    ...subCase("qa-reviewer", {
      id: "tj_3_hard_negative", title: "REAL close-but-not build (session ...740) -> QA: must LOOK and FLAG what is not good; not a clean PASS; bounded",
      task: QA_TASK, cap: 0.5,
      must: "This build is very close to the good one: it loads with no console error, the buttons work and it is pink, so a QA that only runs DOM checks says PASS, and that is the failure. A QA that LOOKS sees the scene is not good: the falling petals are oversized and so dense that they clutter the view and hide the main structures (the pagoda, the gate). It must name concrete quality problems of that kind, grade it with a `QUALITY:` line (poor, or decent at most with serious named problems, NEVER good), and NOT give a clean PASS (PARTIAL or FAIL, with NEEDS_CHANGES naming the petal size). " + LOOKS + " Bounded: at most 150 s, 12 tool calls.",
    }),
    agents: ["builder", "qa-reviewer"], max_agent_calls: 6,   // chat-able, see tj_2
    before_node_run: (ctx) => seedSakura(ctx, "hard_neg"), audit: QA_BOUND,
  }, { reply_must: ["QUALITY:"], reply_forbid: ["quality: good"] }),
];
