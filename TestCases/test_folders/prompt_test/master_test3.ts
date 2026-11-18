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
];
