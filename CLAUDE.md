# agent_testing

Test cases for multi-agent harnesses. Shared cases live in `TestCases/test_folders/Cases/`, ROUTED by index files (`Cases/index.ts` mounts `core_testing/`, `real_usecases/` and `subagents/` index.ts; each route line says what a suite is for and which case ids it owns; read them first). Groups: `core_testing` (harness pitfalls + the plain lead cases solowork / artifact), `real_usecases` (pipedream, expo_go, planning, project checks), `subagents` (the SUB-AGENT is under test); harnesses in `test_harness/` run them (the LIVE one is f3: `test_harness/core/orchistraitor/f3_multiagent`, set in `test_harness/core/config.ts`; `f1_multiagent`, `f2_stages` and `loop_ferry_f_1` are DEPRECATED (each has a DEPRECATED.md; nothing imports them; to be moved to a legacy place later), do not edit them).

## Goal: spend as few real AI credits as possible
Only the LEAD agent is a real model call. Sub-agents are MOCKED by recorded fixtures, so tests judge the orchestrator (does it call the right sub-agent with a good hand-over?), not the sub-agent's work.

## Fixtures are compulsory
- One place for all recorded results: `TestCases/test_folders/agent_fixture` (see its README), NESTED by suite: `results/<suite folder name>/<file>.ts` (e.g. `results/test_expo_go/`). `index.json` is generated (`bun test_harness/scripts/build_index.ts`) and `scripts/check_fixtures.ts` fails if it is stale or a result sits under the wrong suite. Nothing else may hold results.
- Every case must be ONE of: (a) expect a recorded result id in `expected_agents_res`, (b) only `session:<agent>#n` follow-ups (answered from the earlier fixture session), or (c) declare `allow_real_subAg: true` (lead works alone, real sub-agents, or "must NOT call a sub-agent"). Anything else is a failure.
- Check (free, no model calls): `bun test_harness/scripts/check_fixtures.ts` (fixtures + `test_harness/scripts/validate_cases.ts` shape check). Exits 1 on any undeclared or malformed case. Run it before and after editing cases.
- Declarations: case = `TestCases/types.ts`, tags = `TestCases/tags.ts`, fixture interface = `agent_fixture/types.ts` (core/types.ts only re-exports). `allow_real_subAg?: true` (in a shared base object: `true as const`). Details: `TestCases/test_folders/README.md`.
- Currently `allow_real_subAg: true`: `test_solowork`, `test_artifact`, `test_expo_direct_build`, `test_project_check`, `test_prompt_planning` (set on each suite's shared base object) and every `Cases/subagents/*` suite (`subCase()` in `subagents/lib/make.ts`; each runs the REAL sub-agent, so run them by case id on purpose, never in a routine run).
- Suite NAME = its folder name (the CLI argument and the `results/<name>/` folder), unique across all groups. A suite exists only when it is ROUTED (one line in its group's `index.ts`); `suiteDirs()` in `test_harness/core/paths.ts` reads the routes, `validate_cases.ts` fails when routes and folders differ.
- A case that needs an existing project: put its .zip in `agent_fixture/store/projects/` and unpack it in `before_node_run` with `seedProject()` (`Cases/real_usecases/test_project_check/lib/zip_seed.ts`); say where the zip came from in the suite's header comment.

## Test cases are never deleted
Never remove a test case, its recorded fixtures or its free self-test to make a refactor, a rename or a cleanup pass. A case that cannot run today STAYS (fix it, adapt it to the new names, or mark it in `TestCases/test_folders/TODO.md` with the reason). The one exception: the removal is a decision that is WRITTEN DOWN with its reason in the repo (for example `docs/RUN_FINDINGS.md`) and in the commit message, because the thing the case tested was removed on purpose.
Before calling a missing case a loss: `git log -S"<case id>"`, grep the docs (RUN_FINDINGS, PROGRESS, TODO) and the whole tree for a move or rename, and compare the case count before and after any rename with `bun test_harness/scripts/check_fixtures.ts`. Recorded fixtures of a removed case are kept (orphans), never deleted.
Example: the four QA repair-loop cases (adv_5, adv_6, adv_6a, adv_6b) were removed on purpose together with `qa_check` (RUN_FINDINGS H20), but the commit message of f551fce did not say so, so it looked like a loss (TODO T-24).

## How a mocked call is served
`FixtureGate` (`f3_multiagent/harness/core/fixture_gate.ts`, for agents with `"fixtures": true` in `agent.json`):
1. guard: `store/*_rules.json` (hand-over must name `run_test`, `PLAN.md`, min length);
2. lookup: recorded result whose `match.keywords` are all in the hand-over (else NOTFOUND);
3. serve: `result.run()` copies from `store/` (base + real patch via `store/expo_go/apply.ts`) into `run_test/`; no model call.
Gate order: known `--session` in the `fixture_sessions` table -> continue it; else fixture lookup; no fixture -> `allow_real_subAg` ? real call (with the session id) : error "FIXTURE NOT FOUND".
Calls are capped by `max_agent_calls` (default 2); the call after the cap fails the case.

## Approaches: how the lead delegates (a1 / a2 / mod)
Only the LEAD's way of calling sub-agents differs; the core (store, locks, FixtureGate, skills, monitor) is shared. Files: `test_harness/core/orchistraitor/f3_multiagent/approaches/` (README there), one class per approach on `BaseApproach` (`approach_port.ts`), shared lead code in `harness/leadkit/`. The current one is `CONFIG.approach` in `test_harness/core/config.ts`; `APPROACH=<name>` or `--approach=<name>` overrides for one run.
- `a1_team_cli`: the lead types `team agent <role> ...` in Bash. `a2_native_hook` (default): the lead uses `Agent` / `SendMessage`; a hook turns them into the same `delegate`, so FixtureGate still mocks the sub-agent. `a2_native_observe`: Claude's own engine runs sub-agents (no fixtures, no locks). `a3_native_mod`: the same as a2 but a MOD (plugin folder built on the fly in `test_harness/core/.build/`, loaded with `--plugin-dir`) answers `Agent` / `SendMessage` with a real tool result; skills for sub-agents are built the same way (`core/agents/skills.json`).
- Never name an approach in shared code (`harness/`, `testrun/`): ask `currentApproach()`. A tool is declared in ONE place (`harness/tools/route.ts` + its group file + `core/help.ts`); an agent's tools/skills/sub-agents in `core/agents/` (`agent.json`, `.claude/settings.json`, `skills.json`: a skill is mounted only for the agents it is declared for).
- Hooks (what a2 uses) vs MODS (Claude Code's plugin runtime: `plugin.json` + `hooks/hooks.json` + `register.ts`, loaded with `--plugin-dir`): mods can also rewrite inputs, change the system prompt, register tools and agent types, draw UI. Used by a3 (not yet the default); facts and rules learned in `approaches/README.md`.
- For a small change do not re-run the self-test suites; check once after a bigger piece of work (`self_test/approach_a2.ts`, `self_test/skills.ts`, `self_test/multi.ts`: 4 old failures are known).

## test_expo_go (examples/)
Not solo: lead (router on) delegates to ONE sub-agent `expo-go`, so it is a delegation/hand-over test, not a split-across-agents test. `router: false` / `lead: "solo"` marks solo cases; the harness refuses those. Every case is a plain object in `test_expo_go/{demos,examples}/*.ts` or `rework.ts` (no generators). Most results apply real commit patches (`phases.json`, `patches/`); `eg_tw_02`, `eg_tw_03` and the rework results are HAND-WRITTEN (the rework `_fix` ones reuse a real patch), so they are the weakest. Rework cases (`rework.ts`): bad fixture first, lead must notice, then the `_fix` fixture.

## Cheap-run workflow
1. `bun test_harness/scripts/check_fixtures.ts` first.
2. `bun testrun/run.ts <suite> [case ids] --list` / `--fake` (no model calls; `--fake` cases show FAIL because the fake lead calls nothing, that is expected) from `f3_multiagent/`.
3. Real run = haiku lead only, by case id (chains use cached `after` checkpoints; `--rerun` re-spends credits).
4. Never use `--real` (real sub-agents) in routine runs; only for `allow_real_subAg` cases.
5. New expo_go cases: take real patches via `store/expo_go/make_patches.py`, not hand-written results.

## Sandbox: real agents and QA run in Docker
Anything that installs packages, builds or records runs in a throwaway container (2 GB RAM, 1 CPU, caps dropped), never on the host: `HARNESS_SANDBOX=docker` for real sub-agents (compose service `sandbox`, image with Claude Code built in), `infra/qa/*` for QA videos. We do not restart containers, we remount volumes. Details: `docs/SANDBOX.md`. A test case says whether it can be recorded with `qa: (req) => QaSpec` (`TestCases/types.ts`). Default: NO video and NO session record; only a case whose `qa` is enabled gets them (`--video` runs that function, every other case does nothing; `--record` writes the record for any case).

## Package manager: pnpm only (never npm)
Use **pnpm** for every install and every package binary in this project, and in everything we build, run or generate: `pnpm install`, `pnpm add <pkg>`, `pnpm exec <bin>` (instead of `npx`), `pnpm dlx <bin>` (one-off, instead of `npx`/`npm exec`). Never `npm`, `npx` or `yarn`: not in scripts, Dockerfiles, agent prompts, fixtures or docs.
Why: pnpm keeps ONE copy of each package in a shared store and links it, so repeated and parallel installs (a throwaway container per app, many demos) do not pile up duplicate `node_modules`; it is also faster and stricter about undeclared dependencies.
In throwaway containers pnpm comes from corepack (`corepack pnpm ...`, no global install) and its store is the docker volume `agent-testing-pnpm-store`. Expo/Metro needs `node-linker=hoisted` (written into the app copy's `.npmrc` by the web export).

## Live data in the UI: push over the WebSocket, never re-fetch on a timer
Anything that changes while a page is open (sessions, chat, transcripts, bg scripts, agent status) reaches the browser over the ONE WebSocket (`test_harness/ui/server/hub.ts` -> `src/store/live.ts`). The page tells the hub what it looks at (`live.watch({ task, detail, transcript })`) and the hub pushes a topic only when its JSON changed.
- Never write `setInterval` / "refetch every N seconds" / polling `fetch` for data that changes. Not for a "running" agent, not as a fallback, not on a deprecated page.
- Need a new live thing? Add a topic to `hub.ts` (+ a field in `Sub`, a ref and a `sink` entry in `live.ts`), not a new HTTP poll. The server may re-read files on its own tick (files cannot notify us), once for all browsers, with a cache keyed on mtime+size.
- Plain HTTP is for one-off actions (POST send/stop/delete) and a single load, never a loop.
- A local clock that only re-renders "5s ago" labels (no request) is fine.
Why: a poll per open tab hammers the API, lags behind, and flickers state (it showed stale "running"); the socket is cheap and instant.
- Always log the socket traffic so useless events can be found: the browser console prints every `[live] ← topic size (#n)` / `→ send` / "listening to"; `liveStats()` in the console shows a per-topic table (events, total, avg). The server prints `[hub] -> push topic size` only for real changes, and each client's subscription. Keep these logs in when adding topics.

## Agent prompts are short; change one, test it (prompt testing)
- Every agent's static prompt (`agent.json` `prompts`, default `.claude/CLAUDE.md`) stays under 8000 characters and 200 lines (a WARNING limit of ours, nothing is cut at 8000: the real limit is about 40k characters): its role, how it works, how it answers. Details go into `chapters/<name>.md` (read once with `team chapter --name <name>`; QA has `tab`, the planner `plan_format`, the lead eight). Plain wording, no shouting (MUST / NEVER in capitals over-trigger the newer models), no stuffing, no long examples. The size (the file AND what the model really gets: the harness appends ~5k characters of team-tool docs at launch) is checked free by `bun test_harness/scripts/check_prompts.ts` (the 8000 / 200 numbers are ADVICE: going over only prints a `prompt_big` warning, it never cuts the prompt or fails a run; see `docs/RUN_FINDINGS.md`, "Limits are advice") (also `--strict`, and the UI server prints a warning at start when a prompt is over).
- Change a prompt = run its prompt tests (`TestCases/test_folders/prompt_test/`, flag `prompt_testing`: `master_test`, `master_test2` (+ planner), `master_test3` (parallel builders, loops) and one `<agent>_test` each; single-turn calls, tool calls recorded and blocked, chained by `after`, ~$0.02 a case; tags `cost` / `loop`): `bun test_harness/scripts/prompt_test.ts <suite|agent>`; `--runs=3` for risky ones, `--review` for EXPECTED vs GOT. The dashboard has them on **TestCases > PromptTesting**, apart from Real cases and Core. How a result gets on that page (socket topic, newest folder wins, parents and skipped children overwrite, killed runs save nothing): `test_harness/ui/STRUCTURE.md`. Add a case for every behaviour a real run taught us.
