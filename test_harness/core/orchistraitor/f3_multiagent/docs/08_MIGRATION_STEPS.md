# 08 Migration steps (ordered; each leaves the repo working)

0. Write these docs only. No code moved. (this folder)
1. Create the `f3_multiagent/` code skeleton: `approaches/index.ts` + `approach_port.ts` (types only). Add the markers.
2. COPY (not move) the agnostic core files into `f3_multiagent/core/` per `03`. Add `core/delegate.ts` (`agentCall -> FixtureGate | callee`) and `core/resolve.ts`.
3. Lift fixture lookup/guard (`loadResults`, `pickRecorded`, `checkHandover`) into `core/fixtures/` so core stops importing `harness_own_custom`.
4. `a1_team_cli/`: put `lead.ts`, `tools.ts`, the command text of `launch.ts`, and the lead prompts behind the port. Gate: `self_test/multi.ts` (169 checks) passes against f3.
5. `a2_mod/`: bring the mod in (source: recovered copy, see `06`), write `adapter.ts` (decode Agent/SendMessage, encode reply). Mark gaps `// NOT_POSSIBLE:`.
6. `a3_native/`: `--agents` + `nativeEnv`, widen tools, add an event source for `judgeTurn`. Mostly `// TODO:`.
7. `testrun/run.ts` gets `--approach`; `runLead` gets an `approach` option (`lead.ts:14`, `run.ts:34`, `run.ts:145`).
8. One contract test per approach: the same 3 cases (hand-over, follow-up, guard refusal) must pass on each.
9. Switch the outside importers (below) from f1 to f3, then retire f1.

## Outside files that import f1 (fix in step 9)
| Path | Imports / mentions |
|---|---|
| `test_harness/core/orchistraitor/helper/video.ts:13` | `loops_ai.videoOffReason` |
| `TestCases/test_folders/Cases/real_usecases/test_prompt_planning/main.ts:4` | `plan_lint` (`lintPlan`) |
| `TestCases/test_folders/Cases/core_testing/advance_test/{offline_demo,verify}.ts` | `board` (MStore), `fixture_gate` |
| `TestCases/test_folders/Cases/real_usecases/test_web_setup/verify.ts` | `board`, `fixture_gate` |
| `TestCases/ui/test_structure/server/experiment.ts:7-16` | `board`, `base`, `peek`, `agent_call`, `lockapi`, `testrun/cases.ts`; line 16 hardcodes the f1 path |
| `TestCases/ui/test_structure/server/preview.ts:5-7` | `bg`, `preview`, `procs` |
| `TestCases/ui/test_structure/server/browser.ts:6-7` | `browser_conn`, `browse` |
| `.../test_expo_go/lib/check.ts:13` | path string to `f1.../harness/agents` |
| root `.gitignore:3-4` | ignore rules for `f1.../harness/agents/*/.claude/` |
| docs and notes | `CLAUDE.md`, `user_read.md`, `TestCases/test_folders/README.md:3`, `TODO.md`, `RUNNERS.md:8`, `docs/INDEX.md`, `docs/PROJECT_MEMORY.md:29`, `docs/PROTOTYPE_KIT.md`, `docs/phase_2_docs/*`, `.env.example:2`, `orchistraitor/docs/*`, `TestCases/branch.ts:4`, `TestCases/ui/test_structure/shared/types.ts:44`, `helper/agents/*.ts` comments |
| aliases | `@core/*` -> `test_harness/core/*` in `tsconfig.json:15` and `TestCases/ui/test_structure/tsconfig.json:26` |

There is no root `package.json` and `infra/docker-compose.yml` has no f1 reference.

## Today's harness selection (for step 7)
No pluggable interface and no index.ts exist. f1 runs by `cd f1_multiagent && bun testrun/run.ts <suite> [ids]`; an older runner `test_harness/core/run.ts` imports `harness_own_custom/capabilities.ts` and `skip_test.ts`. `core/paths.ts` knows suites and `STATE_VERSION` only. `// ImprovementsNeeded:` the UI starts runs as a subprocess (`TestCases/ui/test_structure/server/experiment.ts`) and must learn the `--approach` flag.
