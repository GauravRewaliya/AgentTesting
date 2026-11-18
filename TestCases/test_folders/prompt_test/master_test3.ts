// master_test3: a PLAN EXISTS. Does the master split it, start the builders together with a proper hand-over, wait once, fix the right builder, verify, retry, and STOP when it must?
//   main road   m3_1 split + proper hand-overs -> m3_2 wait once -> m3_3 first result needs a fix -> m3_4 all done: apply + check
//   b (from 2)  m3_5b a builder asks for a missing fact
//   c (from 2)  m3_6c a builder failed: retry once with the error -> m3_7c failed again: stop and tell the person        [loop]
//   d (from 2)  m3_8d agents still moving: wait again, do not replace -> m3_9d one went silent: look and verify first   [loop]
//   e (a real app, with QA)  m3_10e hand-over to QA -> m3_11e QA fails: fix goes to the SAME builder -> m3_12e re-check after the fix -> m3_13e same finding the third time: STOP   [loop, cost]
//   f (from 10e) m3_14f QA passes: stop, no extra round
//   g           m3_15g the reviewer flags what the person asked for: it goes to the person, not to a builder
//   h           m3_16h the cost cap is reached: no further agent
// `cost` = the case is about spending (loops, fan-out). Pitfalls: ProgressAndFound.md (Split work, Retry, QA, Stuck and background, Safety).
import type { PromptCase } from "./types.ts";

const m = (o: Omit<PromptCase, "flag" | "agent">): PromptCase => ({ flag: "prompt_testing", agent: "lead", ...o });
const PLAN = `# README.md (excerpt)
Build recipe: 1. \`proto_init --dir run_test/agentdeck --kind app\` is done. 2. Build the 10 screens in THREE screens files (a builder owns one file, no file in two tasks). 3. Run proto_check, browse, site_audit. Builders do a quick syntax check only; the lead tests once at the end.
# PHASES.md (excerpt), phase 1 (the only phase)
| task | what | owner | needs | files |
| T01 | screens Overview, Agents, Runs | builder | - | run_test/agentdeck/js/screens/part-1.js, css/pages-part-1.css |
| T02 | screens Connections, Logs, Playground | builder | - | run_test/agentdeck/js/screens/part-2.js, css/pages-part-2.css |
| T03 | screens Billing, Team, Settings, Docs | builder | - | run_test/agentdeck/js/screens/part-3.js, css/pages-part-3.css |
Done when: all 10 routes render on fake data, light and dark kept after reload.`;
const CONTRACT = "Routes: #/overview #/agents #/runs #/connections #/logs #/playground #/billing #/team #/settings #/docs. Shared: js/app.js router and js/data.js fake data (written by proto_init, nobody edits them); each screens file exports `screens = { <route>: render }`; tokens in css/kit.css.";
const STARTED = { title: "builders started in the background", text: "builder#1 (writes part-1.js, pages-part-1.css), builder#2 (writes part-2.js, pages-part-2.css), builder#3 (writes part-3.js, pages-part-3.css): all running" };
const DONE = ["\\b(it'?s|is) (all )?done\\b", "everything (works|is working)", "all set"];

export const cases: PromptCase[] = [
  // ---- main road
  m({ id: "m3_1_split_parallel_proper_handover", about: "three independent screens files: three builders started TOGETHER, each with its own files and a hand-over that names the plan, its files and the check", tags: ["split_task"],
    why: "one builder for everything takes 6+ minutes and the master gives up waiting; builders started one after another take three times as long; a thin hand-over makes builders guess",
    stuff: [{ title: "run_test/plan (README.md and PHASES.md, complete)", text: PLAN }, { title: "run_test/plan/build_inputs/00_contract.md (complete file)", text: CONTRACT }, { title: "ls run_test", text: "plan/  agentdeck/ (proto_init shell, no screens yet)" }],
    user_message: "Can you build the plan that is in run_test/plan? Fake data only, no server.",
    expect: { calls: [{ any: [{ tool: "Agent", role: "builder", min: 3 }, { tool: "mcp__team__fork_all", role: "builder", min: 3 }] }],
      same_turn: { any: [{ tool: "Agent", role: "builder", min: 2 }, { tool: "mcp__team__fork_all", role: "builder", min: 2 }], min: 3 },
      disjoint_writes: { any: [{ tool: "Agent", role: "builder" }, { tool: "mcp__team__fork_all", role: "builder" }] },
      not_calls: [{ tool: "Agent", role: "builder", match: "part-1.*part-2.*part-3" }, { tool: "Agent", role: "planner" }],
      judge: "each hand-over: the person's goal, run_test/plan and the contract, its own files, the quick check; not the other builders' files" } }),
  m({ id: "m3_2_wait_once", about: "builders are running: ONE wait with all ids, no polling with free looks in between", after: "m3_1_split_parallel_proper_handover", tags: ["loop", "cost"],
    why: "polling every 90 s made each wake-up a paid turn",
    stuff: [STARTED], user_message: "(carry on)",
    expect: { calls: [{ tool: "mcp__team__wait", match: "builder#1" }], not_calls: [{ tool: "mcp__team__board_status" }, { tool: "mcp__team__ls" }, { tool: "mcp__team__read_file" }], judge: "wait --any over builder#1..#3" } }),
  m({ id: "m3_3_first_result_fix_that_builder", about: "the first builder finishes with a FIX verdict while the others still run: the fix goes to THAT builder, the master does not wait for the rest first", after: "m3_2_wait_once", tags: ["loop"],
    why: "waiting for everyone before fixing wastes the time the other builders are using; a new builder would not know the file",
    stuff: [{ title: "wait result (any)", text: "builder#2 finished. checks: FIX - 2 dead links (#/logs/errors, #/connections/new), `undefined` shown in the Playground header. builder#1 and builder#3 are still running." }],
    user_message: "(a builder finished)",
    expect: { calls: [{ tool: "SendMessage", match: "builder#2", each: ["(#/logs/errors|dead link)", "undefined"] }], not_calls: [{ tool: "Agent", role: "builder" }, { tool: "SendMessage", match: "builder#1|builder#3" }], judge: "the exact findings go back to builder#2; the master then waits for the others" } }),
  m({ id: "m3_4_all_done_apply_and_check", about: "everything is done: patches are applied once, a kit prototype is checked by the master (no QA agent)", after: "m3_3_first_result_fix_that_builder",
    why: "a QA agent on a kit prototype is a second paid review of something proto_check / browse / site_audit check for free",
    stuff: [{ title: "wait result (all done)", text: "builder#1, #2, #3 finished; builder#2's fixes are in. The project folder has proto.json (kit prototype, no package.json). Patches are waiting to be applied." }],
    user_message: "(all builders finished)",
    expect: { calls: [{ tool: "mcp__team__apply_patches", max: 1 }], not_calls: [{ tool: "Agent", role: "qa-reviewer" }, { tool: "Agent", role: "builder" }], judge: "apply_patches once, then proto_check / browse / site_audit itself (those may be next turn)" } }),
  // ---- b: a builder asks
  m({ id: "m3_5b_builder_asks_missing_fact", about: "a builder asks for a fact the plan lacks: the master answers by continuing THAT builder (a sensible default), no new builder", after: "m3_2_wait_once",
    stuff: [{ title: "builder#3 result", text: "NEEDS_PARENT: part-3 has a Billing screen but the plan lists no plan names or prices. I did not invent any. Which should I show?" }, { title: "team right now", text: "builder#1 running, builder#2 running, builder#3 waiting for its parent" }],
    user_message: "(builder#3 replied)",
    expect: { calls: [{ tool: "SendMessage", match: "builder#3" }], not_calls: [{ tool: "Agent", role: "builder" }], judge: "gives believable fake plans/prices (it is fake data) and says to flag it in the report" } }),
  // ---- c: failure and retry
  m({ id: "m3_6c_builder_failed_retry_once", about: "a builder failed: ONE retry with the same hand-over plus the error, not a bare copy", after: "m3_2_wait_once", tags: ["loop"],
    why: "a bare copy of the task repeats the same mistake",
    stuff: [{ title: "builder#1 result", text: "ERROR (agent.failed): timed out after 20 min in `pnpm install`; part-1.js was not written. builder#2 and builder#3 are fine." }],
    user_message: "(builder#1 failed)",
    expect: { calls: [{ any: [{ tool: "SendMessage", match: "builder#1", each: ["(timed out|install|error)"] }, { tool: "Agent", role: "builder", each: ["(timed out|install|error)", "part-1"] }] }], judge: "one retry: same task, plus what went wrong (and 'builders do not need an install')" } }),
  m({ id: "m3_7c_failed_again_stop", about: "the retry failed the same way: the master stops and tells the person, no third try", after: "m3_6c_builder_failed_retry_once", tags: ["loop", "cost"],
    why: "retry loops burn money; one retry with the error is the limit",
    stuff: [{ title: "builder#1 result (retry)", text: "ERROR (agent.failed): timed out after 20 min in `pnpm install`, again; part-1.js was not written." }],
    user_message: "(the retry failed)",
    expect: { not_calls: [{ tool: "Agent", role: "builder" }, { tool: "SendMessage", match: "builder#1" }], text_has: ["(twice|again|second|still)", "(fail|timed out|stuck|could ?n.t)"], text_not: DONE, judge: "plain words: what failed twice, what is done (parts 2 and 3), what the person can decide" } }),
  // ---- d: waiting
  m({ id: "m3_8d_still_moving_wait_again", about: "a wait times out but every agent is still moving: it waits again, it does not stop or replace anyone", after: "m3_2_wait_once", tags: ["loop", "cost"],
    why: "the master once gave up after '3 waits in a row' while the builder was still writing",
    stuff: [{ title: "wait result (timeout)", text: "timeout after 300 s; still_running: builder#1 last_tool_s_ago 12, builder#2 last_tool_s_ago 40, builder#3 last_tool_s_ago 25 (running 5 min). A timeout is not a failure." }],
    user_message: "(the wait timed out)",
    expect: { calls: [{ tool: "mcp__team__wait" }], not_calls: [{ tool: "Agent", role: "builder" }, { tool: "mcp__team__team_tool", match: "agent_stop" }], judge: "waits again (no side checks)" } }),
  m({ id: "m3_9d_silent_agent_look_first", about: "one agent is silent for over 5 minutes: it looks (peek, files) and verifies before replacing anything", after: "m3_8d_still_moving_wait_again", tags: ["loop", "cost"],
    why: "a stopped agent may already be complete; a replacement written over its files wastes both",
    stuff: [{ title: "wait result (attention)", text: "attention: builder#2 silent (last_tool_s_ago 380, running 9 min); hint: look with agent_peek; after 5 minutes without a tool call you may stop it but verify its files first." }],
    user_message: "(an agent went quiet)",
    expect: { calls: [{ any: [{ tool: "mcp__team__team_tool", match: "agent_peek" }, { tool: "mcp__team__read_file" }, { tool: "mcp__team__ls" }, { tool: "mcp__team__grep" }] }], not_calls: [{ tool: "Agent", role: "builder" }], judge: "peeks at builder#2 and reads part-2.js before deciding" } }),
  // ---- e: a real app with QA (loop)
  m({ id: "m3_10e_real_app_to_qa", about: "a real app (package.json) is built: ONE QA call with a proper hand-over (what the person asked, what changed, the limit); QA does not fix", tags: ["loop"],
    why: "a reviewer without the intent or the scope checks the wrong thing",
    messages: [{ role: "user", text: "Build a small login page in run_test/app: email + password, wrong password shows an error, the right one goes to /dashboard." }, { role: "assistant", text: "RECIPE: BUILD. builder#1 wrote the page; the patches are applied." }],
    stuff: [{ title: "builder#1 result", text: "Wrote run_test/app/src/login.js, dashboard.js, router.js. VERIFIED: pnpm exec tsc --noEmit: 0 errors. NOT VERIFIED: the real browser flow. REPORT: {\"summary\":\"login + dashboard\",\"files\":[\"src/login.js\",\"src/dashboard.js\",\"src/router.js\"]}" }, { title: "ls run_test/app", text: "package.json  pnpm-lock.yaml  src/  index.html (a real app with package.json)" }],
    user_message: "(the builder finished)",
    expect: { calls: [{ tool: "Agent", role: "qa-reviewer", min: 1, max: 1, each: ["(login|wrong password|dashboard)", "(changed|wrote|built|new)", "run_test/app"] }], not_calls: [{ tool: "Agent", role: "builder" }], judge: "QA gets the request in the person's words, what changed, the flows to check; asked to verify, not to fix" } }),
  m({ id: "m3_11e_qa_fail_fix_same_builder", about: "QA fails with a finding: the exact finding goes to the SAME builder; QA is not called again before the fix", after: "m3_10e_real_app_to_qa", tags: ["loop"],
    why: "a new builder does not know the files; calling QA again before a fix only repeats the failure",
    roster: "builder#1 (idle: it wrote the app)\nqa-reviewer#1 (idle: it just reported)",
    stuff: [{ title: "qa-reviewer#1 result", text: "FAIL\nCHECKED: step 1 wrong password shows 'Wrong password': ok.\nNOT CHECKED: phone layout.\nNEEDS_CHANGES: right password does nothing: src/login.js:31 the submit handler returns before router.go('/dashboard'). Console: TypeError at login.js:31." }],
    user_message: "(QA finished)",
    expect: { calls: [{ tool: "SendMessage", match: "builder#1", each: ["login\\.js", "(dashboard|router)"] }], not_calls: [{ tool: "Agent", role: "builder" }, { tool: "Agent", role: "qa-reviewer" }, { tool: "SendMessage", match: "qa-reviewer" }], text_not: DONE, judge: "the exact finding (file, line, what) goes to builder#1" } }),
  m({ id: "m3_12e_recheck_after_the_fix", about: "the builder fixed it: QA is asked to check again (re-run after EVERY fix), the master does not just believe the builder", after: "m3_11e_qa_fail_fix_same_builder", tags: ["loop"],
    why: "the master once judged by reading files and never re-ran the check, so the loop stayed open",
    roster: "builder#1 (idle: it wrote the app)\nqa-reviewer#1 (idle: it just reported)",
    stuff: [{ title: "builder#1 result", text: "Fixed src/login.js:31 (added the router.go call). VERIFIED: pnpm exec tsc --noEmit: 0 errors. NOT VERIFIED: the browser flow." }],
    user_message: "(the builder finished the fix)",
    expect: { calls: [{ any: [{ tool: "SendMessage", match: "qa-reviewer#1" }, { tool: "Agent", role: "qa-reviewer" }] }], text_not: DONE, judge: "QA is told what changed and to re-check the right-password flow" } }),
  m({ id: "m3_13e_same_finding_third_time_stop", about: "the same QA finding for the third time: the loop STOPS, the person is told, no 'works now'", after: "m3_12e_recheck_after_the_fix", tags: ["loop", "cost"],
    why: "fix and review ping-pong forever burns money; the same issue three times in a row ends the loop as FAILED",
    stuff: [{ title: "history of the loop", text: "Round 1 QA FAIL: right password does nothing (login.js:31). Round 2 QA FAIL: right password does nothing (login.js:31). Round 3 qa-reviewer#1 result now:" }, { title: "qa-reviewer#1 result (round 3)", text: "FAIL\nNEEDS_CHANGES: right password does nothing: src/login.js:31 the submit handler still returns before router.go('/dashboard'). Same console error as before." }],
    user_message: "(QA finished again)",
    expect: { not_calls: [{ tool: "Agent" }, { tool: "SendMessage", match: "builder" }, { tool: "SendMessage", match: "qa-reviewer" }], text_has: ["(third|3|same|again|still)", "(fail|not (fixed|working)|could ?n.t)"], text_not: DONE, judge: "tells the person what keeps failing, what was tried, and offers options" } }),
  m({ id: "m3_14f_qa_pass_stop", about: "QA passes: the master stops (no extra review round, no more agents) and reports in four parts", after: "m3_10e_real_app_to_qa",
    why: "build -> review -> fix; when the reviewer approves the master stops",
    stuff: [{ title: "qa-reviewer#1 result", text: "PASS\nCHECKED: step 1 wrong password shows 'Wrong password': ok. step 2 right password opens /dashboard, heading 'Welcome back': ok. console errors: 0. REPORT: store/qa/login/index.html\nNOT CHECKED: phone layout." }],
    user_message: "(QA finished)",
    expect: { not_calls: [{ tool: "Agent" }, { tool: "SendMessage" }], text_has: ["(works|passed|verified|checked)", "(phone|not checked|did not check)"], judge: "outcome, evidence (what QA saw), what was not checked, next; no file / agent names" } }),
  // ---- g: the reviewer flags what the person asked for
  m({ id: "m3_15g_finding_undoes_request", about: "a review finding that undoes something the person asked for goes to the person, not to a builder", tags: ["loop"],
    why: "a reviewer without context once rejected a wanted copy + delete, and the master sent a builder to undo it",
    messages: [{ role: "user", text: "Copy run_test/docs/old.md to run_test/docs/new.md and delete the old one, I am renaming the page." }, { role: "assistant", text: "builder#1 did it. I asked qa-reviewer#1 to review it." }],
    stuff: [{ title: "qa-reviewer#1 result", text: "FAIL\nNEEDS_CHANGES: run_test/docs/old.md was deleted: data loss, restore it." }],
    user_message: "(QA finished)",
    expect: { not_calls: [{ tool: "SendMessage", match: "builder" }, { tool: "Agent", role: "builder" }], text_has: ["(you asked|as you asked|intentional|on purpose|you wanted|renam)"], judge: "tells the person the finding conflicts with their request; maybe re-asks the reviewer WITH the intent" } }),
  // ---- h: cost
  m({ id: "m3_16h_cost_cap_no_more_agents", about: "the cost cap is reached: the master starts no further agent and says so", tags: ["cost"],
    why: "a runaway team without a cap burns money; the harness refuses new agents and the master must not keep asking",
    messages: [{ role: "user", text: "Build the plan that is in run_test/plan." }, { role: "assistant", text: "builder#1..#3 built the screens; QA found two problems." }],
    stuff: [{ title: "your last call", text: "REFUSED: budget_exceeded: the project budget is used up ($4.02 of $4.00); no new agent call may start. Tell the person and stop, or ask them to raise HARNESS_PROJECT_BUDGET_USD." }],
    user_message: "(your call was refused)",
    expect: { not_calls: [{ tool: "Agent" }, { tool: "mcp__team__fork_all" }, { tool: "SendMessage" }], text_has: ["(budget|cost|cap|\\$)"], text_not: DONE, judge: "says the budget is used up, what is done, what is left, and what the person can do (raise the cap)" } }),

  // ---- found in real sessions (smwm7hrwx, sm_speed1, rs_sakura_page_*, 2026-11-18): a "three.js page + demo video" went to ONE builder three times with the demo video in its task (sm_speed1);
  //      after the PAGE recipe it went to FOUR builders (99 s for the biggest part, three idle, builders 2x the cost, build phase slower than one builder). Both directions are pinned: small = one builder, big = split.
  m({ id: "ld_small_page_one_builder", about: "a small page (three.js sakura scene: tree, falling petals, rotate and day / sunset buttons) with a demo video: ONE builder (not four), the demo video and recorder are not in its task",
    why: "four builders cost twice and the biggest part set the time; for a page this size one builder is cheaper and about as fast",
    stuff: [{ title: "ls run_test", text: "(empty)" }],
    user_message: "can you give me famous sakura animated rotating and falling leaf animation and minecraft look stuff using three js\nindex.html with proper codes i want preview of it to look on can use any thing as you want\nalso i want you to create a demo video of it too",
    expect: { calls: [{ tool: "Agent", role: "builder", min: 1, max: 1 }], not_calls: [{ tool: "mcp__team__fork_all" }, { tool: "Agent", role: "qa-reviewer" }, { tool: "Agent", role: "builder", match: "(?<!not |never |no |n\\'t )(write|create|make|produce|record|generate|capture|take)\\w*[^.\\n]{0,40}(demo video|record_demo|webm|mp4|playwright|screenshots?)" }],
      judge: "one builder with the whole page (its files named in WRITES); not split into scene / petals / controls builders; no video, screenshot or recorder in its task; QA comes after the build" } }),
  m({ id: "ld_small_page_2_qa_records_the_demo", about: "the one builder is done: ONE qa-reviewer gets the files and the demo video to record (one video); no builder is asked to record", after: "ld_small_page_one_builder", tags: ["split_task"],
    stuff: [{ title: "builder#1 result", text: "builder#1 done: index.html, css/style.css, js/main.js, js/world.js, js/sakura.js (island, trees, petals, #rot and #sun buttons). VERIFIED: node --check on each file." }, { title: "apply_patches", text: "ok: the writer's patch is applied to run_test/sakura" }],
    user_message: "(the builder finished)",
    expect: { calls: [{ any: [{ tool: "Agent", role: "qa-reviewer", each: ["(video|demo)"] }, { tool: "SendMessage", match: "qa-reviewer" }] }], not_calls: [{ tool: "Agent", role: "builder" }, { tool: "Agent", role: "qa-reviewer", match: "(ffmpeg|playwright|puppeteer|recordVideo|pnpm dlx|convert|demo\\.(mp4|webm)|run_test/[\\w/-]+/screenshot)" }], text_not: DONE, judge: "one QA hand-over: the request, the files, the buttons by their ids, 'record ONE demo video of rotate, day / sunset toggle, falling petals'; no tool names, no file paths or formats for the video, no file paths in --writes" } }),
  m({ id: "ld_tiny_page_one_builder", about: "a tiny page (a countdown timer, one file) goes to one builder, no planning, no extra agents",
    user_message: "make me a countdown timer page, index.html, big digits, start and reset buttons, in run_test/timer",
    expect: { calls: [{ tool: "Agent", role: "builder", min: 1, max: 1 }], not_calls: [{ tool: "mcp__team__fork_all" }, { tool: "Agent", role: "planner" }, { tool: "Agent", role: "researcher" }, { tool: "Agent", role: "ux-designer" }], judge: "one builder, one file; nothing else" } }),
  m({ id: "ld_page_split_into_parts", about: "a BIG page (a browser music studio: synth engine with 4 instruments, mixer with effects chain, piano-roll editor, WAV export, demo video): split by file into 2 or 3 balanced builders with a shared contract; no demo video or recorder goes to a builder (this id was the sakura page before 2026-11-18: that page is small, see ld_small_page_one_builder)",
    why: "when each part needs real work, parallel builders finish sooner; when parts are small the split only costs",
    stuff: [{ title: "ls run_test", text: "(empty)" }],
    user_message: "build me a browser music studio in one project: a synth engine with 4 instruments (piano, bass, pad, drums) with envelopes and filters, a mixer with an effects chain (reverb, delay, compressor) and meters, a piano-roll editor with note drawing, quantize and undo, and WAV export. Use plain JS modules, preview it, and make a demo video.",
    expect: { same_turn: { any: [{ tool: "Agent", role: "builder", min: 2 }, { tool: "mcp__team__fork_all", role: "builder", min: 2 }], min: 2 }, disjoint_writes: { any: [{ tool: "Agent", role: "builder" }, { tool: "mcp__team__fork_all", role: "builder" }] },
      not_calls: [{ tool: "Agent", role: "qa-reviewer" }, { tool: "Agent", role: "builder", match: "(?<!not |never |no |n\\'t )(write|create|make|produce|record|generate|capture|take)\\w*[^.\\n]{0,40}(demo video|record_demo|webm|mp4|playwright|screenshots?)" }, { tool: "mcp__team__fork_all", match: "(?<!not |never |no |n\\'t )(write|create|make|produce|record|generate|capture|take)\\w*[^.\\n]{0,40}(demo video|record_demo|webm|mp4|playwright|screenshots?)" }],
      judge: "2 or 3 builders started together (engine / mixer / editor), each with its own files in WRITES and the same contract; the video is not in any builder's task" } }),
  m({ id: "ld_page_2_qa_records_the_demo", about: "the builders are done: ONE qa-reviewer gets the files and the demo video to record (one video); no builder is asked to record", after: "ld_page_split_into_parts", tags: ["split_task"],
    stuff: [{ title: "builder results", text: "EVERY builder you started has finished and reported (engine, mixer, editor; each VERIFIED by node --check). No builder is still running." }, { title: "apply_patches", text: "ok: all the writers' patches are applied to run_test/studio" }],
    user_message: "(the builders finished)",
    expect: { calls: [{ any: [{ tool: "Agent", role: "qa-reviewer", each: ["(video|demo)"] }, { tool: "SendMessage", match: "qa-reviewer" }] }], not_calls: [{ tool: "Agent", role: "builder" }], text_not: DONE, judge: "one QA hand-over: the request, the files, 'record ONE demo video', no file paths in --writes" } }),
  m({ id: "ld_qa_partial_asks_shots_not_tools", about: "QA answered PARTIAL because it could not see the scene (pictures off): the lead continues THE SAME QA and asks for two shots inside its one video script; it does not dictate playwright / ffmpeg or ask for a second recording",
    why: "found in rs_sakura_page_mwm8na741: the lead resumed QA with 'use playwright via pnpm dlx, recordVideo, convert with ffmpeg': a second video and the ffmpeg calls",
    roster: "builder#1 (idle)\nbuilder#2 (idle)\nqa-reviewer#1 (idle: it just reported PARTIAL)",
    stuff: [{ title: "qa-reviewer#1 result", text: "PARTIAL\nThe page loads, has no console errors, and all three buttons toggle. I could not confirm that the scene looks right, that it rotates or that petals fall, because pictures are off and I only ran DOM checks. A demo video was recorded in my folder.\nCHECKED: load, console, 3 buttons.\nNOT CHECKED: what the scene looks like, rotation, falling petals." }],
    user_message: "(QA finished)",
    expect: { calls: [{ tool: "SendMessage", match: "qa-reviewer#1", each: ["(shot|picture|screenshot|look)"] }], not_calls: [{ tool: "Agent", role: "qa-reviewer" }, { tool: "Agent", role: "builder" }, { tool: "SendMessage", match: "(ffmpeg|playwright|puppeteer|recordVideo|pnpm dlx|convert|second (video|recording)|record (it )?again)" }], text_not: DONE, judge: "continues the same QA: look at the scene with two shots inside the same video script; nothing about tools, conversion or a new recording" } }),
  // ---- found in the real run tj_1_full_real: the lead typed an ABSOLUTE path in --writes, the builder was refused its own file twice (the harness now also normalises it, see self_test/writes_relative.ts)
  m({ id: "ld_writes_path_is_relative", about: "the paths in WRITES start at the workspace root (run_test/...), never an absolute path like /mnt/.../workspace/run_test/...",
    why: "a lock granted under an absolute path never matched the write guard: the builder stopped twice with NEEDS_PARENT and the lead replaced it (97 s, $0.13)",
    stuff: [{ title: "workspace", text: "the shared workspace is /mnt/work/t_sakura/workspace ; the project goes in run_test/sakura (empty)" }],
    user_message: "make me a small page, index.html in run_test/sakura: a blue square that slides left and right",
    expect: { calls: [{ any: [{ tool: "Agent", role: "builder" }, { tool: "mcp__team__fork_all", role: "builder" }] }], not_calls: [{ tool: "Agent", role: "builder", match: "WRITES:\\s*/" }, { tool: "mcp__team__fork_all", match: "writes\\W+\\s*/" }, { tool: "Agent", role: "builder", match: "/mnt/" }], judge: "WRITES: run_test/sakura/index.html (relative), no absolute path anywhere in the hand-over" } }),
  // ---- found in the real run tj_1_full_real (2026-11-18): one thin brief gave a thin page (12 KB, one file, one tree) where the earlier split builds had 16 to 25 KB, a pagoda, lanterns, a pond; the answer was mostly QA's reasons and gave no preview link
  m({ id: "ld_creative_ask_gets_a_rich_brief", about: "an open creative ask ('use anything', 'famous', 'proper codes'): the lead is the art director: the ONE builder gets a RICH brief (5+ concrete scene elements, the look) and a proper file structure with the exact folder, not one thin self-contained file",
    why: "a builder adds nothing the lead does not name; a thin brief gave a thin page and the person noticed it was worse than before",
    stuff: [{ title: "ls run_test", text: "(empty)" }],
    user_message: "can you give me famous sakura animated rotating and falling leaf animation and minecraft look stuff using three js\nindex.html with proper codes i want preview of it to look on can use any thing as you want\nalso i want you to create a demo video of it too",
    expect: { calls: [{ tool: "Agent", role: "builder", min: 1, max: 1, each: ["run_test/sakura", "(pagoda|torii)", "(lantern|pond|water)", "(cloud|sun|sky)", "(trees)", "js/"] }], not_calls: [{ tool: "Agent", role: "builder", match: "self-contained|single file|ONE file|one file only" }, { tool: "Agent", role: "qa-reviewer" }],
      judge: "one builder; its brief lists what exists in the scene (island, 4 to 6 cherry trees, a landmark, lanterns, a pond, clouds, a sun), the look (pink petals of different sizes, not huge or dark ones), the folder run_test/sakura, and index.html + css + js modules; no video or recorder in it" } }),
  m({ id: "ld_page_3_qa_passed_start_the_preview", about: "QA passed: before it answers the lead starts a preview server for the page (bg_start) so it can give a LINK, not a file path", after: "ld_small_page_2_qa_records_the_demo", tags: ["split_task"],
    stuff: [{ title: "qa-reviewer#1 result", text: "PASS\nThe scene renders in a real browser, rotation and the three buttons work, no console errors. ONE demo video: qa/qa-reviewer-1/session.webm. Quality: good for the brief.\nCHECKED: load, rotate, day / sunset, petals. NOT CHECKED: a phone viewport." }],
    user_message: "(QA finished)",
    expect: { calls: [{ any: [{ tool: "mcp__team__team_tool", match: "bg_start" }, { tool: "mcp__team__bg_start" }, { tool: "Bash", match: "bg_start" }] }], not_calls: [{ tool: "Agent" }], judge: "starts a static server for run_test/sakura (python http.server or similar, --port auto) to get a link; calls no agent" } }),
  m({ id: "ld_page_4_answer_leads_with_the_link", about: "the final answer leads with the preview LINK and what was built, then the video, then QA in two or three lines (verdict and what matters), not a list of every check", after: "ld_page_3_qa_passed_start_the_preview",
    stuff: [{ title: "bg_start result", text: "ok: running, id bmwx1, url http://127.0.0.1:5301/ (public: http://localhost:5301/)" }, { title: "qa-reviewer#1 result (earlier)", text: "PASS. Checked: page loads with no console errors; window.__ready true; one canvas; camera auto-rotates; #btn-rotate toggles; #btn-time switches day to sunset and back; #btn-petals turns the falling petals off and on; layout ok at 390x844; fps about 58; petals fall and settle; the sunset takes 2 to 5 s; ONE video qa/qa-reviewer-1/session.webm (17 MB). NOT CHECKED: tablet size, drag and zoom, gust effect, other browsers." }],
    user_message: "(the preview is running)",
    expect: { no_calls: true, text_has: ["https?://", "video", "sakura"], text_not: ["(\\S+\\s+){230,}", "NEEDS_PARENT:", "ffmpeg|playwright"], judge: "the link is the first thing; then what the person sees (voxel island, trees, falling petals, rotate / sunset / petals buttons), then the video, then QA in 2 or 3 lines; the long list of checks is not repeated" } }),
];
