import type { TestTag } from "../../tags.ts";
import type { Case } from "@core/types.ts";

// real_planning_prototype: BIG, vague product requests ("build something like Instagram / Composio's admin dashboard").
// Phase 2 of the TODO: the lead decides a planner is needed, the planner plans with the user and has the FE team make a PROTOTYPE.
// REAL sub-agents (no recorded fixtures, `allow_real_subAg`), so run only by case id, inside the docker sandbox (HARNESS_SANDBOX=docker), never in routine runs.
// The reference sites are interactive; the agents only look at their FLOW and feature set on the web, they do not copy the UI.
export const tags: TestTag[] = ["multi_ag", "single_prompt", "split_task"];
const base = {
  needs: ["multiagent.spawn", "sandbox.files"], lead: "lead_team", tools: ["Agent"],
  agents: ["planner", "ux-designer", "builder", "researcher", "qa-reviewer"],
  allow_real_subAg: true as const,
  max_agent_calls: 8,
} as const satisfies Partial<Case>;

export const cases: Case[] = [
  {
    id: "real_instagram_prototype", title: "[real_planning_prototype] Instagram-like app: plan the flow, then a FE-only prototype", ...base,
    turns: [{
      user: "I want to build an app like Instagram. Check how the website works (only its flow: sign up / log in, feed, posts with likes and comments, profiles with follow, stories, explore, direct messages, notifications; not its exact look). Plan it properly and show me a prototype I can click through before we build anything real. The prototype is just for me to see the layout and the flow, so use fake data for now (something like faker; a real database like sqlite comes later). Work in run_test.",
      expected: { context: "(see the expectation comment at the end of this file)", expected_agents_res: [] },
    }],
  },
  {
    id: "real_composio_admin_prototype", title: "[real_planning_prototype] Composio-like admin dashboard: plan the features, then a FE-only prototype", ...base,
    turns: [{
      user: "I want an admin dashboard like Composio's. Check the web for how Composio works (only its features and flow, not its exact UI): connected apps / integrations catalog, auth configs, connected accounts, tools and actions, triggers, logs of executions, API keys, projects and team settings, usage and billing. Plan it properly and show me a prototype I can click through before we build anything real. It is only a prototype to see the layout and the flow, so use fake data for now (faker-style; sqlite or a real backend comes later, so nobody needs to decide yet where a column or its data comes from). Work in run_test.",
      expected: { context: "(see the expectation comment at the end of this file)", expected_agents_res: [] },
    }],
  },
  {
    id: "real_small_no_planner", title: "[real_planning_prototype] small clear job: the lead must NOT call the planner", ...base,
    agents: ["planner", "ux-designer", "builder", "qa-reviewer"], max_agent_calls: 3,
    turns: [{
      user: "In run_test/hello create index.html with an h1 that says Hello and a button that says Click. Nothing else.",
      expected: { context: "A small, clear job: the lead sends it straight to ONE builder (with --writes run_test/hello/index.html) and never calls the planner or the ux-designer. index.html has the h1 'Hello' and the button 'Click', nothing more.", expected_agents_res: [], expected_roles: ["builder"] },
    }],
  },
  {
    id: "real_proto_fast_path", title: "[real_planning_prototype] clickable admin mockup: proto_init first, parallel builders, NO planner / ux-designer / research / build", ...base,
    agents: ["planner", "ux-designer", "builder", "researcher", "qa-reviewer"], max_agent_calls: 6,
    turns: [{
      user: "Make me a clickable mockup of an admin dashboard for managing API integrations: Overview, Apps, Connected accounts, Logs, Playground, API keys, Members, Settings. Just a prototype to show the flow, nothing to build for real.",
      expected: { context: "FAST PATH: the lead's FIRST action is `proto_init` (run_test/<project>, a nav with the person's 8 screens grouped about 4 per file); then ONE builder per ~4 screens (8 screens = 2 builders) is started TOGETHER (fork_all, or several --async delegates and ONE wait), each with --writes for its own js/screens/<file>.js and css/pages-<file>.css; then `preview` (it lists unfinished routes; the lead fixes them through the owning builder and previews again). It NEVER calls the planner, the ux-designer or a researcher, never runs pnpm / a build / qa_check, and creates no docs/planning files. The person gets a preview link where every route renders a finished screen (no TODO stub). Whole run within ~10 minutes.", expected_agents_res: [], expected_roles: ["builder", "builder"] },
    }],
  },
  {
    id: "real_site_clone", title: "[real_planning_prototype] ditto clone of a real website: ref_capture (real browser) first, site kit, parallel builders, ref_compare, linked pages", ...base,
    agents: ["planner", "ux-designer", "builder", "researcher", "lookup", "lookup-page", "qa-reviewer"], max_agent_calls: 8,
    turns: [{
      user: "do make ditto clone like https://upwatchr.io/blog for testing and education (rename the brand, write your own text). I want its sections, good animation and the light/dark theme, and the pages properly linked with working navigation.",
      expected: { context: "The lead LOOKS first: `ref_capture` of the url (a real browser: section pictures, tokens), reads REF.md and decides the pages itself (no questions, no refusal, no researcher / planner / ux-designer). Then `proto_init --kind site` (accent / font / dark background taken from REF.md, nav of the reference: home, blog, features ... plus article pages), then the lookup-page workers (the visual UI/UX analysts; the researcher stays text based) started TOGETHER with fork_all (a design-system worker + one per screens file), each writing layouts/ and briefs/ into the reference store; each file's builder is started THE MOMENT its brief exists (pipeline, while other workers still write), each told only to build from its brief; the lead reacting with wait --any, and at the end ref_compare + site_audit + preview started together as background jobs (--async). Then `ref_compare` (gaps handed to the owning builder, at most 3 rounds) and `preview` (every route and every article link opens a real page). The result: several linked pages incl. a blog list with article detail pages, a theme that follows the system with a toggle, scroll animations, own brand and original text.", expected_agents_res: [], expected_roles: ["lookup-page", "lookup-page", "builder", "builder"] },
    }],
  },
  {
    id: "real_prototype_feedback", title: "[real_planning_prototype] big job, then the user changes something: same planner updates plan and prototype", ...base,
    max_agent_calls: 10,
    turns: [
      { user: "I want a small habit tracker web app: a list of habits, a daily check-in, a streak page and settings. Plan it and show me a clickable prototype first (fake data only, no backend). Work in run_test.",
        expected: { context: "Planner first, then the FE team makes the prototype (layout first, then themed UI) in run_test; plan files under docs/planning/<project>/. The lead shows the prototype path and asks for feedback. No backend.", expected_agents_res: [] } },
      { user: "Looks good, but move the streak page into a tab on the main screen and add a dark theme toggle.",
        expected: { context: "The lead continues the SAME planner session (not a new planner). The plan files (UX flow, decisions.md) and the prototype are updated: streak is a tab, a dark theme toggle exists. Still no backend. The lead reports what changed.", expected_agents_res: [] } },
    ],
  },
  {
    id: "real_fe_issue_to_planner", title: "[real_planning_prototype] a team problem goes to the planner, not to another builder", ...base,
    max_agent_calls: 10,
    turns: [
      { user: "Plan a small notes app (list, editor, tags) with a clickable prototype using fake data. Work in run_test.",
        expected: { context: "Planner plus FE team produce the plan and prototype; the lead shows the path.", expected_agents_res: [] } },
      { user: "The frontend builder says the plan has the tag filter on the list screen but the data model has no tags field on a note. Sort it out.",
        expected: { context: "The lead asks the PLANNER (same session), not another builder. The planner decides it is a plan defect, updates the data model and UX flow, adds a one-line decision to decisions.md, names the affected team, and says whether the user must decide.", expected_agents_res: [] } },
    ],
  },
  {
    id: "real_end_to_end_plan_build", title: "[real_planning_prototype] end to end: plan, prototype, split, parallel FE/BE build, QA", ...base,
    max_agent_calls: 14,
    turns: [
      { user: "I want a small bookmarks manager: add a link with a title and tags, list and search them, delete. Plan it, show me a prototype with fake data, work in run_test.",
        expected: { context: "Planner first, prototype by the FE team, plan files written, path shown, no backend yet.", expected_agents_res: [] } },
      { user: "The prototype is good. Now build it for real: a sqlite database, a small API and the frontend wired to it.",
        expected: { context: "The lead splits the work from the planner's work split: FE builder and BE builder own DIFFERENT files and run in parallel (--async, one wait). Backend uses sqlite following the planned data model and API contract. Before reporting done the lead runs qa_check and the app passes (or qa_give_up with evidence). The reply lists files and agents.", expected_agents_res: [] } },
    ],
  },
  {
    id: "real_phase_order", title: "[real_planning_prototype] phases: the lead does not start phase 2 before phase 1 passed", ...base,
    max_agent_calls: 10,
    turns: [
      { user: "Plan a small recipe book app in phases (phase 1: layout + flow prototype with fake data, phase 2: real data and API). Write the phases down. Work in run_test.",
        expected: { context: "Planner first; PHASES.md in the plan folder with Status/Goal/Exit check per phase; only phase 1 is 'building'. `bun test_harness/core/check_phases.ts <PHASES.md>` passes.", expected_agents_res: [] } },
      { user: "Skip the review, start phase 2 now: add the sqlite database and the API.",
        expected: { context: "The lead does NOT start phase 2 tasks while phase 1 has not passed its exit check: it says so, runs/asks for the phase 1 exit check (or asks the person to confirm the prototype), and tells the planner to update PHASES.md only after it passed. If the person's confirmation is clear it may then proceed in order. check_phases.ts still passes (no phase 2 'building' while phase 1 is not 'passed').", expected_agents_res: [] } },
    ],
  },
  {
    id: "real_type_error_caught", title: "[real_planning_prototype] a builder checks types before reporting done (tsc / LSP)", ...base,
    agents: ["builder", "reviewer"], max_agent_calls: 4,
    seed: {
      "typed/package.json": JSON.stringify({ name: "typed", private: true, type: "module", devDependencies: { typescript: "5.9.3" } }, null, 1),
      "typed/tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true, noEmit: true, module: "esnext", target: "es2022", moduleResolution: "bundler" }, include: ["src"] }, null, 1),
      "typed/src/user.ts": "export interface User { id: number; name: string }\nexport const users: User[] = [{ id: 1, name: 'Ann' }];\n",
    },
    turns: [{
      user: "In run_test/typed add src/find.ts exporting findUser(id) that returns the User with that id from users in src/user.ts, or undefined. Then use it in src/main.ts: print the name of user 1. The project is strict TypeScript.",
      expected: { context: "One builder (with --writes run_test/typed/src/**). With noUncheckedIndexedAccess and strict, a careless `users[0].name` or an unchecked undefined is a type error: before reporting done the builder runs the type check (`pnpm exec tsc --noEmit` or `pnpm dlx -p typescript tsc --noEmit`) and/or uses LSP, and the final code passes it. The lead checks (qa_check or read_file) rather than trusting 'done'. main.ts handles the undefined case.", expected_agents_res: [] },
    }],
  },
];

/*
 EXPECTATION (what a good run of BOTH cases looks like; judged from the run report and run_test, nothing is asserted by code)

 1. LEAD decides on its own that this is a BIG, vague product and calls the PLANNER first with the person's words (no builder before a plan).
    It must not skip the planner and must not start building the app by itself.

 2. PLANNER (expert; read-only itself) looks at the web (via the researcher, only flow and feature set, never copies the UI) and writes the plan
    into  docs/planning/<project>/  through its own sub-agents. Only the files the task needs, e.g.:
        00_brief.md       goal, users, scope, non-goals, requirements R1.., open questions (with defaults so it does not block)
        02_ux_flow.md     screens, navigation, states (empty / loading / error), the user flow
        03_data_model.md  the entities and relations (a DRAFT for later; NOT built now)
        05_work_split.md  packages with the files each owns, no file in two packages
        PHASES.md         the delivery order as a guide (phase 1: layout + flow prototype, later: data/API, ...)
        decisions.md      one line per decision
    The planner knows this is ONLY a prototype: fake data (faker-style, in-memory/JSON), no database, no API, no auth, no backend at all.
    It does not decide where a column or its data comes from; that is a later phase.

 3. PROTOTYPE (FE only), made by the FE team (ux-designer + builder) in run_test, in two steps that the planner orders:
      a) LAYOUT first: the page structure, navigation and the main screens as a clickable wireframe (no styling work yet).
      b) then the exact UX/UI of the FE: components split by the planner (e.g. NavBar, PostCard, StoryRing, DmThread / AppCatalogCard, ConnectedAccountRow,
         ExecutionLogTable ...), ONE consistent theme and style (colors, spacing, typography, light/dark tokens), all states, interactive navigation between screens.
    No BE prototype, no server, no real data source: the data comes from a single fake-data module that can later be swapped for sqlite/API.
    The prototype is not a pixel copy of the real site; it follows the real FLOW and FEATURES.

 4. The prototype's PATH is shown to the person (the lead reports it and says what to look at, and what is only fake). It asks the person for feedback; it
    does NOT go on to build the real backend. If the person's feedback came, the SAME planner session updates the plan and the prototype.

 5. Quality of hand-overs: each sub-agent gets the person's words, its role, and the exact files it may write (--writes); no invented requirements; every
    listed feature of the request is covered (count what the person lists) or the reply says why not.

 6. Cost: planner + at most a few sub-agents (max_agent_calls 8); a failing run is one that: builds before planning, builds a backend/database, copies the real UI,
    ignores listed features, or never shows the person a prototype.

 7. Not routine: these cases are REAL (real sub-agents, credits). Run one by id only, with HARNESS_SANDBOX=docker:
        cd test_harness/core/orchistraitor/f1_multiagent && HARNESS_SANDBOX=docker bun testrun/run.ts real_planning_prototype real_instagram_prototype --real
    (`--list` / `--fake` are free.)
*/
