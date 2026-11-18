// master_test2: the MASTER and the PLANNER dealing with each other. One flow, phase by phase (each phase continues the one before it with the master's REAL behaviour as history):
//   m2_1 ask -> m2_2 plan comes back (verify) -> m2_2b report to the person -> m2_3 "approved, build it"            (the main road)
//   m2_4b change request after the plan -> m2_5b planner's updated plan      (branch b of m2_2)
//   m2_6c the planner asks a question only the person can answer -> m2_7d the answer goes back to the SAME planner   (branch c of m2_1)
//   m2_8e a builder reports a plan defect                                    (branch e of m2_3)
// Pitfalls: plan first and show it, wait for approval, build with the plan handed over, changes go to the planner (not a builder), the planner's question is the person's to answer, one planner session.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PromptCase } from "./types.ts";

/** the REAL text of a lead chapter, so the case follows the prompt files (the master reads the chapter its recipe names before it acts) */
const chapter = (name: string): string => readFileSync(join(import.meta.dir, "..", "..", "..", "test_harness", "core", "agents", "main_flow_agents", "lead", "chapters", name + ".md"), "utf8").slice(0, 1800);

const m = (o: Omit<PromptCase, "flag" | "agent">): PromptCase => ({ flag: "prompt_testing", agent: "lead", ...o });
const PLAN_REPORT = `planner#1 answered: Plan written in run_test/plan (README.md, PHASES.md, build_inputs/00_contract.md, CONTEXT.txt); plan_lint OK.
Three phases: 1 notes list and editor (web), 2 sync between devices, 3 sharing with teammates.
Decisions for the person: (a) sign-in by email link or Google (default: email link); (b) data kept in the browser first, a server in phase 2 (default: yes).
Biggest risk: conflict handling when two people edit one note (phase 2).
REPORT: {"summary":"plan for a team notes app in 3 phases","files":["README.md","PHASES.md","build_inputs/00_contract.md"]}`;
const PLAN_P1 = `# PHASES.md (excerpt)
## Phase 1 - Notes list and editor (web, data in the browser)
| task | what | owner | needs | files |
| T01 | notes list screen | builder | - | run_test/notes/js/screens/list.js, css/list.css |
| T02 | note editor screen | builder | - | run_test/notes/js/screens/editor.js, css/editor.css |
| T03 | search box + tags | builder | - | run_test/notes/js/screens/search.js, css/search.css |
Done when: create, edit, delete, search and tag a note; reload keeps them.
## Phase 2 - Sync (server)
| T04 | sync client | builder | T01 | run_test/notes/js/sync.js |
| T05 | sync server | builder | T04 | run_test/notes/server/index.js |`;

export const cases: PromptCase[] = [
  m({ id: "m2_1_ask_goes_to_planner", about: "a big ask: the planner is called once with the person's words and purpose; no builder, no questions yet",
    why: "building a vague product directly is a guess; the plan is the thing the person judges",
    stuff: [{ title: "chapter `planning` (you read it)", text: chapter("planning") }],
    user_message: "I want a notes app for my team of 8. We use it daily; notes need tags and search, and later we want it to sync between our laptops. Can you plan it?",
    expect: { calls: [{ tool: "Agent", role: "planner", min: 1, max: 1, each: ["(notes|team)", "(tags|search|sync)", "run_test/plan"] }], not_calls: [{ tool: "Agent", role: "builder" }, { tool: "mcp__team__fork_all" }], judge: "the hand-over says what the person wants and why, and where to write the plan" } }),
  m({ id: "m2_2_plan_back_verify_first", about: "the plan comes back: the master checks the planner's files before it reports (a look is fine), and starts no builder", after: "m2_1_ask_goes_to_planner",
    why: "never report a plan nobody looked at; but building before the person has seen it wastes the money the plan was meant to protect",
    stuff: [{ title: "planner#1 result", text: PLAN_REPORT }],
    user_message: "(the planner finished)",
    expect: { not_calls: [{ tool: "Agent", role: "builder" }, { tool: "mcp__team__fork_all" }, { tool: "mcp__team__plan_run" }], any_of: [{ calls: [{ any: [{ tool: "mcp__team__read_file", match: "run_test/plan" }, { tool: "mcp__team__ls", match: "plan" }, { tool: "mcp__team__team_tool", match: "plan_lint" }] }] }, { text_has: ["phase"] }], judge: "reads README / PHASES (or lints) first, or reports straight away; never builds" } }),
  m({ id: "m2_2b_report_to_person", about: "having seen the plan: it reports to the person (outcome, evidence, decisions with defaults, next) and WAITS for approval", after: "m2_2_plan_back_verify_first", tags: ["split_task"],
    why: "building before the person has seen the plan wastes the money the plan was meant to protect",
    stuff: [{ title: "run_test/plan/README.md and PHASES.md (what you read)", text: "# Notes app for a team of 8 (web)\nPhase 1 notes list and editor with tags and search (data in the browser). Phase 2 sync between laptops (server). Phase 3 sharing with teammates.\nDecisions: sign-in by email link or Google (default: email link); browser first, server in phase 2 (default: yes). Biggest risk: conflicts when two people edit one note.\nplan_lint: OK, 0 errors." }],
    user_message: "(carry on)",
    expect: { not_calls: [{ tool: "Agent", role: "builder" }, { tool: "mcp__team__fork_all" }, { tool: "mcp__team__plan_run" }], text_has: ["phase", "(approve|go ahead|ok\\b|decide|decision|default)"], text_not: ["NEEDS_PARENT:", "plan_lint|PHASES\\.md|build_inputs"], judge: "four parts in the person's words: what is true now, what was checked, the two decisions with defaults, what happens next; no file or tool names" } }),
  m({ id: "m2_3_approved_build_phase1", about: "'approved, build it': phase 1 starts as parallel builders with their own files; phase 2 files are not touched", after: "m2_2b_report_to_person", tags: ["split_task"],
    why: "phase 2 must wait for phase 1 to be accepted; independent phase-1 tasks should start together",
    stuff: [{ title: "run_test/plan/README.md (complete)", text: "# Notes app for a team of 8 (web)\nBuild recipe: 1. proto_init is done in run_test/notes. 2. Build phase 1 by tasks, one builder per file group; no file in two tasks. 3. Run proto_check and browse.\nDecisions taken: email-link sign-in; data in the browser first." }, { title: "run_test/plan/PHASES.md (complete)", text: PLAN_P1 }, { title: "run_test/plan/build_inputs/00_contract.md (complete)", text: "Routes #/list #/editor/:id #/search. Shared: js/app.js router and js/data.js store (proto_init, nobody edits). Each screens file exports `screens = { <route>: render }`." }, { title: "ls run_test", text: "plan/  notes/ (proto_init shell)" }],
    user_message: "Approved: email link, browser first. Build it.",
    expect: { same_turn: { any: [{ tool: "Agent", role: "builder", min: 2 }, { tool: "mcp__team__fork_all", role: "builder", min: 2 }], min: 2 }, disjoint_writes: { any: [{ tool: "Agent", role: "builder" }, { tool: "mcp__team__fork_all", role: "builder" }] },
      not_calls: [{ tool: "Agent", role: "planner" }, { match: "notes/js/sync\\.js|notes/server" }], judge: "three phase-1 builders started together (T01 to T03), each with its WRITES; nothing of phase 2" } }),
  m({ id: "m2_4b_change_goes_to_planner", about: "a change after the plan goes to the planner (same agent), not to a builder", after: "m2_2b_report_to_person",
    why: "a builder who gets a requirement change builds on a plan that no longer matches",
    stuff: [{ title: "team right now", text: "planner#1 (idle) wrote the plan in run_test/plan" }],
    user_message: "Change phase 2: no server at all, just export and import a markdown file.",
    expect: { not_calls: [{ tool: "Agent", role: "builder" }], any_of: [{ calls: [{ any: [{ tool: "SendMessage", match: "planner#1" }, { tool: "Agent", role: "planner" }] }] }, { calls: [{ any: [{ tool: "mcp__team__read_file", match: "plan" }, { tool: "mcp__team__ls", match: "plan" }] }] }], judge: "continues planner#1 with the change in the person's words (a look at the current plan first is fine)" } }),
  m({ id: "m2_5b_updated_plan_back_verify", about: "the planner's updated plan comes back: the master checks it (a look is fine) and starts no builder", after: "m2_4b_change_goes_to_planner",
    stuff: [{ title: "planner#1 result", text: "Updated run_test/plan: phase 2 is now 'Export and import' (one task, a markdown file; no server, no sync client). Phase 3 sharing now works by sending the exported file. plan_lint OK.\nDecision: should phase 3 sharing stay in the plan? (default: yes)" }],
    user_message: "(the planner finished)",
    expect: { not_calls: [{ tool: "Agent", role: "builder" }, { tool: "mcp__team__fork_all" }], any_of: [{ calls: [{ any: [{ tool: "mcp__team__read_file", match: "plan" }, { tool: "mcp__team__grep", match: "plan" }, { tool: "mcp__team__ls", match: "plan" }] }] }, { text_has: ["(export|markdown)"] }] } }),
  m({ id: "m2_9b_updated_plan_report", about: "having seen the updated plan: it tells the person what changed (phase 2 is now export/import) and asks the open decision; no build yet", after: "m2_5b_updated_plan_back_verify",
    stuff: [{ title: "run_test/plan/PHASES.md (what you read)", text: "Phase 2 - Export and import: T04 export a note as markdown, T05 import a markdown file. No server. Phase 3 - Sharing by file: T06 share dialog that downloads the exported file." }, { title: "grep -rniE 'sync|server|backend' run_test/plan (what you checked)", text: "(no matches: nothing about sync, a server or a backend is left in the plan)" }],
    user_message: "(carry on)",
    expect: { not_calls: [{ tool: "Agent", role: "builder" }, { tool: "mcp__team__fork_all" }], text_has: ["(export|markdown)", "(approve|ok\\b|go ahead|decision|default|sharing)"], text_not: ["PHASES\\.md|plan_lint"], judge: "says what changed in the person's words and asks about phase 3 sharing (default yes)" } }),
  m({ id: "m2_6c_planner_question_to_person", about: "the planner asks something only the person can answer (never mentioned): the master asks the PERSON in plain words (no marker), nobody is called", after: "m2_1_ask_goes_to_planner",
    why: "the NEEDS_PARENT marker is for sub-agents; a decision only the person can make goes to the person, with a recommendation",
    stuff: [{ title: "planner#1 result", text: "NEEDS_PARENT: Are your team's notes confidential (client or company secrets)? That decides between a self-hosted server and a hosted cloud service, and it changes phases 2 and 3 a lot. I have researched both and will continue once I know." }],
    user_message: "(the planner replied)",
    expect: { not_calls: [{ tool: "Agent" }, { tool: "SendMessage" }], text_has: ["(confidential|secret|self-hosted|hosted|cloud)", "\\?|which|tell me|let me know"], text_not: ["NEEDS_PARENT:"], judge: "asks whether the notes are confidential, with a recommendation, in the person's words" } }),
  m({ id: "m2_7d_answer_goes_back_to_same_planner", about: "the person answers: it goes to the SAME planner session (it kept its research), not a new planner", after: "m2_6c_planner_question_to_person",
    why: "a new planner would redo the research it already paid for",
    stuff: [{ title: "team right now", text: "planner#1 (waiting for its parent: confidential notes, self-hosted or cloud?)" }],
    user_message: "Not really confidential, a hosted service is fine.",
    expect: { calls: [{ tool: "SendMessage", match: "planner#1" }], not_calls: [{ tool: "Agent", role: "planner" }, { tool: "Agent", role: "builder" }] } }),
  m({ id: "m2_8e_plan_defect_from_builder", about: "a builder reports a possible plan defect: the master checks the plan first (a look is fine) and does not start a new builder", after: "m2_3_approved_build_phase1", tags: ["loop"],
    why: "a silent choice by the master can undo what the person approved",
    roster: "planner#1 (idle)\nbuilder#1 running (T01)\nbuilder#2 waiting for its parent (asked: who registers #/editor/:id; js/app.js is owned by no task)\nbuilder#3 running (T05)",
    stuff: [{ title: "builder#2 result", text: "NEEDS_PARENT: the contract names the route #/editor/:id, but PHASES.md lists no file that registers it (js/app.js is not owned by any task). I did not edit js/app.js. What should I do?" }, { title: "team right now", text: "planner#1 (idle), builder#1 running, builder#2 waiting for its parent, builder#3 running" }],
    user_message: "(builder#2 replied)",
    expect: { not_calls: [{ tool: "Agent", role: "builder" }], any_of: [{ calls: [{ any: [{ tool: "SendMessage", match: "planner#1" }, { tool: "SendMessage", match: "builder#2" }] }] }, { calls: [{ any: [{ tool: "mcp__team__grep" }, { tool: "mcp__team__read_file" }] }] }] } }),
  m({ id: "m2_10e_defect_decision", about: "the plan really leaves js/app.js unowned: the planner fixes the plan (or builder#2 is answered with a decision from the plan); no new builder", after: "m2_8e_plan_defect_from_builder", tags: ["loop"],
    roster: "planner#1 (idle)\nbuilder#1 running (T01)\nbuilder#2 waiting for its parent (asked: who registers #/editor/:id; js/app.js is owned by no task)\nbuilder#3 running (T05)",
    stuff: [{ title: "ls run_test/notes", text: "js/app.js  js/data.js  js/screens/(editor.js being written)  css/" }, { title: "grep result in run_test/plan", text: "PHASES.md: T03 owns run_test/notes/js/screens/editor.js. No task lists run_test/notes/js/app.js. 00_contract.md: 'js/app.js router and js/data.js store (proto_init, nobody edits)'. Route #/editor/:id is in the contract." }],
    user_message: "(carry on)",
    expect: { not_calls: [{ tool: "Agent", role: "builder" }], calls: [{ any: [{ tool: "SendMessage", match: "planner#1" }, { tool: "SendMessage", match: "builder#2" }] }], judge: "either the planner fixes the plan (who registers the route) or builder#2 is told what to do from the contract" } }),
];
