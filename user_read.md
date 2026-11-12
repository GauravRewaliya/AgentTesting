# user_read.md: what loopferry has, what we have, what is missing

Written 2026-11-12 after reading `~/projects/loopferry` (handbook/ENGINE.md, CLOUD_SESSIONS.md, TESTING_REPORT.md, src/services/engine/**, .idea/docker).
Nothing here called E2B, Anthropic or OpenRouter for loopferry (its own rule: "never call E2B, Anthropic or OpenRouter from a test"; building the E2B template bills money).
Open work lives in `TestCases/test_folders/TODO.md`, done work and bugs in `test_harness/core/orchistraitor/f1_multiagent/PROGRESS.md`.

**f1 is its own harness.** Its `self_test/`, `ui/` (console, `.ui-data`) and most of `harness/` are not ours; we only added the files listed in `f1_multiagent/README.md` ("Whose is what"). Our runner no longer reads `ui/.ui-data`.

## 1. What was done in this round (all verified; see "How to check" below)

| area | what | where |
|---|---|---|
| lead tools | the lead had NO way to look at files, so it asked the sub-agent to "run grep and paste" (a mock cannot). Now it has READ-ONLY `ls`, `read_file`, `grep`, jailed to `run_test/` (no `..`, no absolute path, no symlink escape, no node_modules) | `f1_multiagent/harness/core/workspace_read.ts`, `harness/tools.ts`, lead `CLAUDE.md`, lead `settings.json`, command list in `harness/lead.ts` |
| gate | session table (`fixture_sessions`, keyed by agent id), observer (what really changed in `run_test/`), stateless real calls, `allow_real_subAg`, `match.after` across agents, free verify budget, strict agent match | `harness/core/fixture_gate.ts`, `fixture_sessions.ts` |
| isolation | a case that does not continue another now starts with an EMPTY `run_test/` (leftovers from the case before misled the lead once it could `ls`) | `testrun/run.ts` |
| S3 | local S3 emulator (the same Adobe S3Mock loopferry uses) and a "record session" upload after every case | `test_harness/infra/` |
| advance_test | staged job (plan, build, fresh reviewer, fix) + a context-loss case taken from loopferry's own incident report | `TestCases/test_folders/advance_test/` |
| harness | a mocked agent is no longer reported as "session rolled / lost" (it has no claude transcript by design) | `harness/core/base/call.ts` |

## 1a. Where a run keeps its files (layout)

One folder per MASTER SESSION (the case's task id) under `test_harness/.state/v1/` (git-ignored: `.state/v1/t_*/`):
```
.state/v1/<task>/
  store/       NOT git: store.json + store.json.board (the registry, fixture_sessions), record/ (summary, events, calls, fixture_sessions as JSON), qa/<id>/ (qa.webm, qa.png, qa.json)
  workspace/   the git workspace the agents work in (run_test/ lives here)
```
Set in `f1_multiagent/testrun/run.ts` (LAYOUT comment). A chained case (`after`) continues the parent's task, so it uses the same folder. `UI_STORE` / `UI_REPO` (env) still force one shared store and repo (the old console, one-off scripts).
See it for real (free, no model): `bun TestCases/test_folders/advance_test/offline_demo.ts` runs the QA case (adv_4) through the gate into `.state/v1/t_adv_4_qa_video_offline/` and records the video there.
Old data (earlier layouts, the old runner's cache, loose videos) was moved, not deleted, to `old_data_bkp/state_before_cleanup_2026-11-12/` (git-ignored; see its README.txt).
Session records are now written locally always (plain JSON, no docker); the S3 upload stays opt-in (`AT_RECORD=1`).

## 1e. Why a suite is slow, and how to run it faster

The sub-agents are fixtures (milliseconds); a case costs 20 to 70 s because the LEAD is a real model (5 to 19 turns). 33 Expo cases in a row is about 30 min and about $5. `bun testrun/par.ts test_expo_go --jobs=4` runs the 7 independent chains in parallel: wall time = the longest chain (about 10 min); cost is unchanged. Details and open items: `TODO.md` T-25 to T-29.

## 1d. Real agents in Docker, and `Case.qa`

- **Sandbox:** `HARNESS_SANDBOX=docker` runs real sub-agents' `claude -p` in a container from the compose service `sandbox` (image `agent-testing-claude:1`, Claude Code built in, 2 GB / 1 CPU, claude-personal mounted). Details and the open risk: `docs/SANDBOX.md`.
- **QA declaration:** a case can carry `qa: (req) => QaSpec` (how to start the server and record, or why not). `--video` obeys it; see `docs/QA_ISSUES.md` section 6.

## 1c. Extra flag `--video`

`bun testrun/run.ts <suite> <case> --video` records a QA video at the end of the case, from outside the harness (helper `test_harness/core/orchistraitor/helper/video.ts`, listed under "Extra flags" in the f1 README).
It records a WEB page (`run_test/<dir>/index.html`) as is. For an **Expo app with web support** it first runs the export in a throwaway container (`test_harness/infra/qa/web_export.ts`: copy of the app, `pnpm install`, `expo export --platform web`; network on for that step only; the workspace is mounted read-only and untouched; npm cache in the docker volume `agent-testing-npm-cache`), then records `dist/index.html` with the no-network recorder. `--video-route=/3d-rotate` picks the screen. A failed export or an Expo app without `react-native-web` records nothing and writes `store/qa/NO_VIDEO.txt`.

**Speed (measured, solarin app):** cold export 173 s (first time, downloads packages once), warm export 136 s (install 60 s, bundle 75 s), recording 5 s. The pnpm store, the corepack binary and the app copy share ONE docker volume (`agent-testing-pnpm-store`) so pnpm hard-links; the copy is deleted after each run. Timings of each stage are in `<session>/store/web/<app>/timing.txt`; everything the export changed in the COPY (stubs, added packages) is in `added_deps.txt`, stubbed assets in `stubbed_assets.txt`.
**Web-only build (`infra/qa/web_only.mjs`):** the copy gets single-page output, native-only modules (`@expo/ui` swift-ui / jetpack-compose) replaced by an empty stub on web, and one copy of `@react-navigation/*`. `QA_NATIVE_ONLY`, `QA_SINGLE_COPY` (regex lists) and `QA_VIEWPORT=390x844` (phone size) tune it.
**Known failure:** the solarin phase-1 app still renders a BLANK page in the browser (`Couldn't find a drawer` thrown by its own `DrawerContent`), at desktop and phone size, even with the changes above. The export and the recorder work; this app does not run on web as it is. Not solved (TODO T-22).

**All QA issues, fixes and the loopferry comparison are in `docs/QA_ISSUES.md`** (12 issues, why each happened, what fixed it, and how loopferry avoids them).

## 1b. Browser QA with a video (loopferry's `qa.webm`), in Docker

`QA_SANDBOX=docker|off|e2b` picks the backend (default `docker`). `e2b` is deliberately not implemented: it needs `E2B_API_KEY` and bills sandbox minutes, and the container does the same job.
Docker backend (`test_harness/infra/qa/`): image `agent-testing-qa:1` (build once: `bun test_harness/infra/qa/run_qa.ts --build`, about 900 MB, node slim + playwright-core + chromium headless shell; **everything is installed inside the image, nothing on the host**).
A run is a throwaway container: `--network none`, read-only root fs, all capabilities dropped, no-new-privileges, 1 cpu, 1 GB, 256 pids, non-root user. The app folder is mounted **read-only**; the only writable path is the session's `store/qa/<id>/` (or `test_harness/.state/v1/<session>/store/qa/<id>/` when run by hand; both git-ignored) where `qa.webm`, `qa.png` and `qa.json` land.
It serves the folder, opens `index.html`, types into the first input, clicks the first button, and records 1280x720. About 7 seconds. Try it on any folder: `bun test_harness/infra/qa/run_qa.ts <folder>`.
In the flow it is the sub-agent `stage-qa` (fixture `adv-qa-video`, case `adv_4_qa_video`): the lead asks it to QA the built page and gets `VIDEO: <path>` back. Free check: `bun TestCases/test_folders/advance_test/verify.ts` records a real video through the gate.
Not covered: an Expo app (needs node_modules and Metro; too heavy for a throwaway container). The QA stage handles static/web pages only.

## 2. How to check (free first, paid last)

```
bun test_harness/core/fixture_policy.ts                        # fixtures + case shapes (free)
bun TestCases/test_folders/advance_test/verify.ts              # the whole stage chain through the real gate, no model (free)
bun TestCases/test_folders/test_expo_go/lib/check.ts           # expo_go suite shape (free)
cd test_harness/core/orchistraitor/f1_multiagent
bun self_test/multi.ts                                         # harness regression, scripted agents (free, ~90 s): 169/169
bun testrun/run.ts advance_test --list                         # free
UI_STORE=/tmp/x/store.json UI_REPO=/tmp/x/repo bun testrun/run.ts advance_test adv_1_plan_build_review_fix --rerun   # PAID: haiku lead only, ~1 minute
```
Use a fresh `UI_STORE`/`UI_REPO` per paid run (re-running on the default store re-used an old task id once and the old calls counted against the limit).
Real runs so far (haiku lead): `adv_1` PASS, `adv_2` PASS (after two fixes, last run). `adv_3` is written and verified with fixtures only, NOT run live yet (saves tokens).

## 3. Docker and S3 (what loopferry uses, what we took)

loopferry (`~/projects/loopferry/.idea/docker/docker-compose.yml`): Postgres 18 + pgvector (port 55433) and S3Mock (port 55441, bucket `loopferry-qa`). The app itself runs on the host.
We took ONLY the S3 emulator: `test_harness/infra/docker-compose.yml`, service `s3`, image `adobe/s3mock`, port **55442** (so it can run beside loopferry's), bucket `agent-testing-qa`.
```
docker compose -f test_harness/infra/docker-compose.yml up -d s3
bun test_harness/infra/s3.ts ping | ls sessions/ | cat <key>
```
No Postgres: our store is a JSON file (`ui/.ui-data/store.json` + `.board`); we do not need pg-boss or pgvector. No Chrome/Playwright needed either: nothing here drives a browser.
For real AWS S3 instead: `AT_S3_ENDPOINT=""` plus the usual `AWS_*` keys. Recording is **OFF by default**; `AT_RECORD=1` turns it on (and start the container first). If S3 is down the run just prints a hint.

What is stored per case (`sessions/<suite>/<case>/<task>/`): `summary.json` (status, per turn: ask, expected, actual calls, lead reply), `events.json` (every event with a `seq`, like loopferry's `run_events (run_id, seq)`),
`fixture_sessions.json` (state, version, history per agent), `calls.json`, `workspace/**` (the files left in `run_test/`).

## 4. loopferry versus us

| topic | loopferry | us today | gap / what to add |
|---|---|---|---|
| run kinds (stages) | `plan`, `implement`, `review`, `learn` (+ browser QA video). Each stage is a fresh run; the only link is one prompt string | plan, implement, review, fix (advance_test) | no `learn` stage, no QA stage. Add a `stage-learner` fixture that writes lessons from the review (learn.json) |
| agent tools | exactly four: `bash`, `read_file`, `write_file`, `edit_file` (`providers/coding-tools.ts`), long bash runs in the background and is polled | sub-agents use claude's own tools; the lead now has `ls`/`read_file`/`grep` | a `bash` timeout/background rule is not modelled; fine for mocks |
| permissions | everything runs as root in a throwaway E2B sandbox; GitHub tokens are minted per stage AFTER the lease: write access for implement, READ-ONLY for plan/review/learn; a per-run ingest token | per-agent `settings.json` allow lists; reviewer has no write tool; planner "writes only PLAN.md" is only a prompt rule | **path-scoped write permission** (a planner/reviewer must not be able to write code at all). f1 has `--writes` for writers; extend it to the stage agents and add a case "planner tries to write src/ -> refused" |
| browser QA | a QA stage records `qa.webm` in the E2B sandbox | `stage-qa` + Docker recorder (new, section 1b) | Expo/React Native apps cannot be recorded this way; add a web-export case later |
| outputs | `plan.json`, `result.json`, `review.json`, `learn.json`, `qa.webm` validated and stored in R2/S3 | one `REPORT: {...}` line per reply, not validated | validate the REPORT JSON (stage, verdict, findings[]) and fail a fixture that breaks the shape |
| record a session | `run_events` (append-only, `(run_id, seq)` unique), `run_agent_messages` (history by generation), outputs in storage | store events + `fixture_sessions` + S3 upload (new) | no replay tool yet: `bun s3.ts cat` only. Add `replay.ts` that re-judges a recorded session offline |
| fake engine | `providers/fake.ts`: scripted launch/poll/turns, records every call and which secrets it was given (counts and token prefix only) | `FixtureGate` + recorded results | add a "no secret in a hand-over" check (tokens, `.env` values must never reach a sub-agent) |
| liveness | heartbeat, reaper (stale after 3 min), cancel (`cancel_requested_at`), kill switch, spend admission and a cost cap (`LLM_MAX_COST_USD`) | `max_agent_calls` only | cases still missing: cancel mid-run, a stalled agent is reaped, a cost cap stops the loop, kill switch |
| concurrency | team lease, run slots, `slot_free` wait events | f1 has locks and a board; no case | a case with two writers on the same file (lock wait) |
| context between stages | the report's "major architecture issue": stages lose context (TESTING_REPORT 5.20) | `adv_3` (new): the reviewer only knows what the hand-over says | more of the same: follow-up asked for a small change, review must not call it a defect; a fixer must never delete what the person asked for |

## 5. Test cases in loopferry we do not have yet (worth porting, cheapest first)

From TESTING_REPORT.md and `e2e/`, expressed as lead-level fixture cases:

1. **5.20 fixer deletes what was asked**: the review (wrongly) says "remove index2.html"; the lead must NOT send the builder to delete it. (adv_3 covers the reviewer half; add the fixer half: a `stage-builder` fixture that would `git rm`, expected: the lead never calls it.)
2. **5.17 a trivial task ("Hi") must not start agents**: loopferry took more than a minute and produced far too long output. Case: lead answers directly, zero calls (`test_expo_direct_build` has the pattern).
3. **5.16 retry is partial**: a failed stage must be redone with the SAME prompt context, not a bare copy. Case: first builder fixture fails with an error, the lead retries once with the original hand-over plus the error.
4. **`loop-flows-cancel`**: the person cancels mid-run; the lead must stop its agents (`agent_stop`) and say what was left undone.
5. **`loop-flows-killswitch` / spend**: a cost cap hit stops further delegation. Needs a cost field in the fixture reply.
6. **`loop-flows-b-envguard`**: secrets in `.env` must not leak into a hand-over (see the fake engine's `seen`).
7. **`loop-steer`**: the person sends a correction while an agent runs; `say` reaches the agent. f1 has `say`/`inbox`; no case.
8. **`loop-flows-stages`**: the stage order itself (plan before implement). Covered by `advance_test` through `match.after`.

## 6. Known gaps and honest notes

- The lead's Bash is sometimes denied in "don't ask" mode (about 1 run in 4 earlier today; not seen in the last 4 runs). Cause not proven: the allow patterns are literal (`Bash(bun *tools.ts delegate*)`), and Claude Code may refuse commands with shell constructs inside long quoted arguments. Not fixed, only watched (TODO T-05).
- PASS means "the right fixtures were served in the right order". It does not prove the lead's final answer was right (TODO T-01: assert the reply).
- `isVerifyAsk` (a check question versus new work) is a word list, not a model. It misjudged once and was fixed; it will misjudge again on odd wording (T-13).
- A strict gate means a lead that rephrases the task so that no keyword matches fails at once (FIXTURE NOT FOUND). Keywords are kept distinctive on purpose (one folder name per case).
- `allow_real_subAg` (real call when no fixture exists) is tested with a stub runner only; no case uses it together with a fixture agent yet (T-11).
- Only `expo-go` and the three `stage-*` agents are served by the gate; every other agent still runs for real on f1.
