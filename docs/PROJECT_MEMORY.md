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
| no planner | `--no-planning`: the lead cannot call the planner (no plan files, straight to builders) |
| step mode | `--stop-pause`: the lead does ONE step (plan -> layout -> themed UI), stops, waits. Continue the same run: `--say=next` (no reset). No qa_check, no full build |
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

## Live preview of a prototype (Docker)
- Code: `harness/core/preview.ts` (one module), used by the master (`tools.ts preview --dir <folder in run_test/> | preview_list | preview_stop --id <id>`) and by the UI (`TestCases/ui/test_structure`: no separate page; the Experiment Run header of a session has a **bg running N** badge, hover = list of previews and bash/processes with stop/restart; API `/api/experiment/bg/<task>`, `/api/preview/{stop,restart}`, `/api/proc/stop`).
- It starts the folder's dev server (`package.json` dev/start, else static `index.html`) in a throwaway container from `agent-testing-claude:1` (2 GB, 1 CPU, caps dropped, tmpfs /tmp, pnpm), port published on `127.0.0.1:5300-5399`. `.nvmrc` is honoured. Docker network address is shown too (`net:`).
- Ask the master: "give me a preview of <folder>" -> it runs `preview` and answers with the link. In the UI: hover **bg running** in the session header.
- Stop: `docker rm -f preview-<id>` or the Stop button. Containers are labelled `at.preview=1`.
- URLs: `public_url` (browser, works from another machine: `PREVIEW_PUBLIC_HOST` or the LAN IP), `url` (localhost, only this machine), `docker_network_url` (only from another container). Port is published on `0.0.0.0` (`PREVIEW_BIND=127.0.0.1` keeps it local). Ask the master for it: it runs `preview` / `preview_list`.
- Experiment Run page: click the master or a sub-agent card on the right -> commands it ran, briefs, last answer, live previews and host processes (`/api/experiment/agent/<task>/<id>`; restart the API after pulling this).
- Preview settings are NOT hard-coded: environment or `<repo>/.env` (gitignored; template `.env.example`): `PREVIEW_PUBLIC_HOST`, `PREVIEW_BIND`, `PREVIEW_PORT_FROM/TO`, `PREVIEW_NETWORK` (join a docker network: `docker_network_url` becomes `http://preview-<id>:5173`, reachable by name from other containers on it), `PREVIEW_IMAGE`.
- Team tools for previews and bash sessions (`tools.ts`): `preview`, `preview_list`, `preview_stop --id`, `preview_restart --id`, `proc_list`, `proc_stop --pid`. `proc_*` = host processes whose working folder is inside the task workspace (`harness/core/procs.ts`; the harness itself is never touched). Agents that run on the host (lead, planner, builder: they delegate) get the command lines in their prompt (`launch.ts`); agents inside the sandbox (ux-designer, qa-reviewer) do not. The Experiment page's detail panel has the same buttons (stop process, restart/stop preview).
- Every background script has a TIMEOUT, default 20 minutes (`--timeout <minutes>`, at most 120, there is NO unlimited run; constants in `core/bg.ts`). The OS enforces it (`timeout` in the wrapper), the record ends as `stopped` by `timeout` (exit 124). The master leaves a preview running and says when it closes.
- Records: `user_requested` (the person asked for the script: the master may not stop it on its own, `bg_stop --id <id> --user-asked` only when the person says so) and `reviewed_at`. Every 10 minutes without a look (bg_list/bg_log), the UI API (`startBgWatch` in server/experiment.ts) queues an automatic check to the master (tagged auto_run, hidden in the chat): read logs, check sub-agents, stop/interrupt what is stuck or not needed.

## Prototype starter (2026-11-13)
- `tools.ts proto_init --dir run_test/<p> --title <name> --nav "A, B, Group>C"` makes the kit + shell + stubs; `proto_check --dir` checks a no-build prototype; `preview` opens every route. Full description: `docs/PROTOTYPE_KIT.md`.
