# PROJECT_MEMORY: commands, tools, and where things live

Read this first so you do not have to rediscover the project. Keep it short and current: when a command or flag changes, fix it here. (Rules are in `../CLAUDE.md`; open work in `../TestCases/test_folders/TODO.md`.)

## Free checks (no model calls)
| what | command |
|---|---|
| fixtures + case shape | `bun test_harness/core/fixture_policy.ts` (run before and after editing cases) |
| rebuild fixture index | `bun test_harness/core/build_index.ts` |
| list / fake run | `cd test_harness/core/orchistraitor/f1_multiagent && bun testrun/run.ts <suite> [ids] --list` / `--fake` (fake shows FAIL, expected) |
| self tests | `bun self_test/qa_loop.ts` (7 checks of the QA repair loop), others in `self_test/` |

## Real runs (haiku lead only costs credits)
| what | command |
|---|---|
| one case | `bun testrun/run.ts <suite> <case id> [--rerun]` |
| a suite in parallel | `bun testrun/par.ts <suite> --jobs=4` (`HARNESS_MAX_LEADS` caps leads) |
| branch from a case | `testrun/branch.ts` |
| video / session record | `--video` (only cases with `qa` on), `--record` (any case) |
| real sub-agents | `--real` only for `allow_real_subAg` cases, always `HARNESS_SANDBOX=docker` |

Run output: `.state/v1/<task>/{store,workspace}`; QA state in `store/qa_state.json`; the workspace is a git repo (`git log` shows QA checkpoints).

## Layout
- Cases: `TestCases/test_folders/<suite>/main.ts`; types `TestCases/types.ts`, tags `TestCases/tags.ts`.
- Fixtures: `TestCases/test_folders/agent_fixture/results/<suite>/` (+ `store/`, generated `index.json`).
- Harness: `test_harness/core/orchistraitor/f1_multiagent/` (`harness/lead.ts`, `harness/tools.ts`, `harness/core/fixture_gate.ts`, `harness/core/qa_loop.ts`, agents in `harness/agents/<name>/`).
- Docs: `docs/` (QA_ISSUES, SANDBOX, planning/, PHASES.md), `PROGRESS.md` (bug catalog + run log).

## Tools and plugins
- Package manager: **pnpm only** (`pnpm exec`, `pnpm dlx`; in containers `corepack pnpm`; store volume `agent-testing-pnpm-store`). Never npm/npx/yarn.
- Runtime for harness/tests: **bun**.
- Docker: sandbox compose service `sandbox` (image with Claude Code built in); QA image `agent-testing-qa:1`; we remount volumes, never restart containers. See `SANDBOX.md`.
- QA video: `infra/qa/*` (record in a throwaway container). Static-mode QA still has the old `record.mjs` until the image is rebuilt (TODO T-22).
- Code intelligence (TODO 2.b): the `LSP` tool works for headless agents ONLY through a plugin: `harness/plugins/ts-lsp` (+ `ENABLE_LSP_TOOL=1`), loaded by the runners (`lspArgs`/`lspEnv` in `core/base/runner.ts`) for any agent whose `settings.json` allows `LSP`. The plugin's `lsp.sh` uses a host `typescript-language-server` if there is one, else runs the server in the sandbox image (`agent-testing-claude:1`, typescript 5.x at `/opt/ts-lib`; nothing is installed on the host; the image must be built). 7.x has no tsserver.js. LSP has no diagnostics: use `pnpm exec tsc --noEmit`. Several Node versions in the image: `fnm exec --using=20 ...`.
- Expo patches: `store/expo_go/make_patches.py` (real commit patches, never hand-written results).

## "Which command when" (history of DB / data)
- Fixture results and sessions: `agent_fixture/results/**` and the `fixture_sessions` table; regenerate `index.json` after any change.
- Per-run ledger/state: `.state/v1/<task>/store/` (ledger, `qa_state.json`, call records).
- Never put results anywhere else (CLAUDE.md).

## Branch + before_node_run (how to test "bug remains" vs "bug fixed")
- `branch_from: "<parent>"` forks the parent's workspace + lead session; the branch has its own store and its own QA loop.
- `before_node_run: (ctx) => ...` on the case runs just before the lead starts (default prints). Put a fix or a broken file in with `ctx.patch / ctx.write`. Example: `adv_6b_bug_fixed_quick_video` in `advance_test/main.ts`.
- Run a branch: `bun testrun/run.ts advance_test adv_6a_bug_remains_master_detects --rerun`; with a video (case needs `qa` enabled): add `--video`.
- `after_node_run: (ctx) => ...` (same ctx, `ctx.phase === "after"`) runs right after the node and ONLY when it passed (a failed case never runs it); default prints. It runs before the video / session record. `no_qa_check: true` on a case switches `qa_check` off (delegation-only cases).
