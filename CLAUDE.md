# agent_testing

Test cases for multi-agent harnesses. Shared cases live in `TestCases/test_folders/<suite>/main.ts`; harnesses in `test_harness/` run them (f1: `test_harness/core/orchistraitor/f1_multiagent`).

## Goal: spend as few real AI credits as possible
Only the LEAD agent is a real model call. Sub-agents are MOCKED by recorded fixtures, so tests judge the orchestrator (does it call the right sub-agent with a good hand-over?), not the sub-agent's work.

## Fixtures are compulsory
- One place for all recorded results: `TestCases/test_folders/agent_fixture` (see its README), NESTED by suite: `results/<suite folder name>/<file>.ts` (e.g. `results/test_expo_go/`). `index.json` is generated (`bun test_harness/core/build_index.ts`) and `fixture_policy.ts` fails if it is stale or a result sits under the wrong suite. Nothing else may hold results.
- Every case must be ONE of: (a) expect a recorded result id in `expected_agents_res`, (b) only `session:<agent>#n` follow-ups (answered from the earlier fixture session), or (c) declare `allow_real_subAg: true` (lead works alone, real sub-agents, or "must NOT call a sub-agent"). Anything else is a failure.
- Check (free, no model calls): `bun test_harness/core/fixture_policy.ts` (fixtures + `TestCases/validate.ts` shape check). Exits 1 on any undeclared or malformed case. Run it before and after editing cases.
- Declarations: case = `TestCases/types.ts`, tags = `TestCases/tags.ts`, fixture interface = `agent_fixture/types.ts` (core/types.ts only re-exports). `allow_real_subAg?: true` (in a shared base object: `true as const`). Details: `TestCases/test_folders/README.md`.
- Currently `allow_real_subAg: true`: `test_solowork`, `test_artifact`, `test_expo_direct_build` (set on each suite's shared base object).

## How a mocked call is served
`FixtureGate` (`f1_multiagent/harness/core/fixture_gate.ts`, for agents with `"fixtures": true` in `agent.json`):
1. guard: `store/*_rules.json` (hand-over must name `run_test`, `PLAN.md`, min length);
2. lookup: recorded result whose `match.keywords` are all in the hand-over (else NOTFOUND);
3. serve: `result.run()` copies from `store/` (base + real patch via `store/expo_go/apply.ts`) into `run_test/`; no model call.
Gate order: known `--session` in the `fixture_sessions` table -> continue it; else fixture lookup; no fixture -> `allow_real_subAg` ? real call (with the session id) : error "FIXTURE NOT FOUND".
Calls are capped by `max_agent_calls` (default 2); the call after the cap fails the case.

## test_expo_go (examples/)
Not solo: lead (router on) delegates to ONE sub-agent `expo-go`, so it is a delegation/hand-over test, not a split-across-agents test. `router: false` / `lead: "solo"` marks solo cases; f1 refuses those. Every case is a plain object in `test_expo_go/{demos,examples}/*.ts` or `rework.ts` (no generators). Most results apply real commit patches (`phases.json`, `patches/`); `eg_tw_02`, `eg_tw_03` and the rework results are HAND-WRITTEN (the rework `_fix` ones reuse a real patch), so they are the weakest. Rework cases (`rework.ts`): bad fixture first, lead must notice, then the `_fix` fixture.

## Cheap-run workflow
1. `fixture_policy.ts` first.
2. `bun testrun/run.ts <suite> [case ids] --list` / `--fake` (no model calls; `--fake` cases show FAIL because the fake lead calls nothing, that is expected) from `f1_multiagent/`.
3. Real run = haiku lead only, by case id (chains use cached `after` checkpoints; `--rerun` re-spends credits).
4. Never use `--real` (real sub-agents) in routine runs; only for `allow_real_subAg` cases.
5. New expo_go cases: take real patches via `store/expo_go/make_patches.py`, not hand-written results.

## Sandbox: real agents and QA run in Docker
Anything that installs packages, builds or records runs in a throwaway container (2 GB RAM, 1 CPU, caps dropped), never on the host: `HARNESS_SANDBOX=docker` for real sub-agents (compose service `sandbox`, image with Claude Code built in), `infra/qa/*` for QA videos. We do not restart containers, we remount volumes. Details: `docs/SANDBOX.md`. A test case says whether it can be recorded with `qa: (req) => QaSpec` (`TestCases/types.ts`). Default: NO video and NO session record; only a case whose `qa` is enabled gets them (`--video` runs that function, every other case does nothing; `--record` writes the record for any case).

## Package manager: pnpm only (never npm)
Use **pnpm** for every install and every package binary in this project, and in everything we build, run or generate: `pnpm install`, `pnpm add <pkg>`, `pnpm exec <bin>` (instead of `npx`), `pnpm dlx <bin>` (one-off, instead of `npx`/`npm exec`). Never `npm`, `npx` or `yarn`: not in scripts, Dockerfiles, agent prompts, fixtures or docs.
Why: pnpm keeps ONE copy of each package in a shared store and links it, so repeated and parallel installs (a throwaway container per app, many demos) do not pile up duplicate `node_modules`; it is also faster and stricter about undeclared dependencies.
In throwaway containers pnpm comes from corepack (`corepack pnpm ...`, no global install) and its store is the docker volume `agent-testing-pnpm-store`. Expo/Metro needs `node-linker=hoisted` (written into the app copy's `.npmrc` by the web export).
