# Run findings: what we pointed out, what we found, what we fixed (catalog)

Context: plan-driven builds (`test_prompt_planning`: `pp_site`, `pp_composio`), the older `real_site_clone` run and the master session `smwf52sw8`.
Every number below was read from the run's `store.json` events and `store/logs/<task>/*.jsonl` (under `test_harness/.state/v1/<task>/`), not guessed.
Open work lives in `TestCases/test_folders/TODO.md` (Phases 3 to 6). Status words: **fixed** (code or plan changed, self-tests pass), **plan fixed**, **open**, **to verify** (changed, needs one real run).

## 1. The points you raised, and the answer

| your point | answer | status |
|---|---|---|
| Why did `pp_site` / `pp_composio` take so long even though the plan was ready? | Not the lead and not the prompt. The second lead sat in a queue behind the first (one machine-wide lead slot) and the UI showed it as "running". Real lead work: 25 s to the first delegate, 4.7 min in all. | fixed |
| Is it the core/harness or the prompt? | Core/harness (slot queue, cost accounting, judge, wait rule). The plan had one gap (quality rules came too late). | fixed |
| Did it use more tokens than before? | No. Output tokens were lower (45k against 101k). The dollar figure looked higher because the UI left out the lead's cost and the old run used Haiku for its lookups. | explained |
| If planning happened, why are the sub-agents not visible? | In these runs no planning ran: the plan is a frozen fixture copied in before the turn, and `--no-planning` keeps the planner out. Only lead and builders exist. | explained (a run with real planning not yet checked in the UI) |
| No need for the "hi" message; the plan is fetched at run time, right? | Right: the plan is copied in before the turn (free). "hi" only proved the lead does not self-start; it cost a lead call and a slot. | fixed |
| Check every action of the lead and the builders. | Done for `pp_site`, `pp_composio`, `smwf52sw8`: see sections 2 and 3. | done |
| Are the tools complicated, causing thinking time? | Thinking time is tiny (1.5 to 4 s per run). The cost is wasted calls (denied compound command, `(?i)` regex, sync-then-async `fork_all`), each an extra lead turn over 45-65k tokens of context. | partly fixed, rest open |
| Should folders carry a CLAUDE.md so fresh sessions hit the cache and do not read and read? | Sessions run with `--setting-sources ""`, so no project CLAUDE.md is loaded; only the agent's own `CLAUDE.md` (shared 14.6k prefix, cache hit). Each builder then re-read the same plan files with tool calls. Now: shared context in front of the prompt + a generated kit reference. | confirmed in the `pp_site` run |
| Is the plan good? Does the master trust it? | Yes. The lead read once, ran the kit, delegated, claimed nothing it had not checked. Gaps found and fixed in the plan (section 3). | plan fixed |
| Score the current state. | About 6.5 out of 10 before these fixes (good plan-driven delegation and quality, but hidden queue, wrong cost, brittle judge, paid idle resumes). Re-score after the confirming real runs. | open |

## 2. Issue catalog

### Harness and core
| # | issue | cause | fix | status |
|---|---|---|---|---|
| H1 | second lead idle for 6.5 min, shown as "running" | `HARNESS_MAX_LEADS` default 1; a lead holds the slot for its whole turn, also while it waits for builders | default 3; agent shows "queued: waiting for a lead slot (held by pid N)"; events `agent.queued` / `agent.dequeued` (`base/slots.ts`, `runner.ts`, `call.ts`) | fixed |
| H2 | UI cost lower than the run log (about $0.3 per run; `smwf52sw8` showed $0.95, real $2.38) | `costOf` summed `store.reports`, which only sub-agents write; the lead's cost was missing | `costOf` sums `agent.done` / `agent.failed` events (every run, lead included); `testrun/run.ts` uses it, so UI = run log | fixed |
| H3 | lead gave up on a builder that was still writing ("3 waits in a row") | the hint said "3 timeouts: answer the person", blind to activity | `wait` returns per agent `last_tool_s_ago`, `tool_calls`, `running_s` and a keep-waiting hint; rule: stop only after 5 min without tool use | fixed |
| H4 | a good build showed FAIL | `expected_roles` compared exact multisets: 3 new + 3 resumed builders never equalled one expected builder | each expected role at least once, extra calls of it fine (`testrun/cases.ts matchCalls`) | fixed |
| H5 | double lines in the session logs | not a harness bug: Claude Code writes one line per content block and repeats usage | readers dedupe by message id; cost no longer reads these logs | explained |
| H6 | `grep` failed on `(?i)` | models write the PCRE prefix, JS rejects it | prefix stripped (matching was already case-insensitive) | fixed |
| H7 | a lead resume days later cost $0.5 for a 6 s answer | cold cache: about 60k tokens re-billed at write price; "status" answered by a paid lead turn | a plain status question typed in the console is answered from the board with no model call (`harness/core/status_reply.ts`, exact-match whitelist only; anything longer still goes to the lead) | fixed |
| H8 | `fork_all` called twice by the lead | not sync-vs-async (`fork_all` is always async): the first call used the alias form `T=...; $T fork_all` which no allow rule matches, so it was denied | one short command `team <cmd>` (`harness/bin/team`, allowed by one rule), used in the lead prompt | fixed |
| H10 | `pp_eiffel`: 8.5 min lost on one builder that had already finished | the `claude` CLI wrote the builder's final answer (13:47:41, `stop_reason: end_turn`) but never wrote its closing `cost-state` record and never exited, so the harness (which waits for process close, 20 min for a builder) showed it as "running"; the lead peeked, nudged, waited by its 5-minute silence rule, stopped it at 13:56:14, read the files (complete) and started another builder to redo finished work; the cost of the stopped call was recorded as 0 | `core/base/hung.ts` + a watchdog in `runner.ts`: when the session log shows a finished turn, nothing after it and 45 s of silence, the call is done: the answer comes from the log, the cost is estimated from the usage (flagged `cost_estimated`, event field `hung_after_answer`), the leftover process is killed. Tested on the real hung log (detected, with its real report) and on a clean exit (not touched); self-test CX15 | fixed (tested offline; not yet seen live) |
| H11 | the same hang is possible for sandboxed (docker) agents | the watchdog is in the host runner only | port it to `docker_runner.ts` | open |
| H14 | `pp_eiffel`: about 7 min and two extra builder rounds lost on `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | the plan pinned the newest versions (`vite ^8.3.0`, `typescript ^7.0.2`, copied from the original app); the harness's pnpm refuses a release younger than its age policy; the builders' plain install passed (host policy 24 h) while `qa_check` failed (its container uses 14 days), so the lead needed two hand-overs and three `qa_check` runs (about 1.5 min each) to find the one lockfile entry | open: (1) plans must not pin a version released in the last 2 weeks (`plan_format.md` + a lint hint), say "newest version at least 14 days old" or pin an older one; (2) make the host and container age policies the same so a green install means a green check; (3) the Eiffel plan: pin Vite and TypeScript to releases older than 14 days | open |
| H15 | the lead polled every 90 s: 16 of its 38 calls in the 26-minute `pp_eiffel` run were `wait` / `plan_status` wake-ups, each a paid model turn over a large cached context; its first call also ran `plan_lint` and read a chapter it did not need | the 90 s wait was advice in the prompt and in tool hints | `wait` / `plan_status` now last at least 4 minutes (a quick look of under 30 s stays short) and END EARLY on anything that needs the lead: a task finished, a phase completed (the gate is the lead's), a failure, an agent stalled or asking. The lead prompt: call one and let the team work, do not poll or start side checks; RECIPE PLAN: no chapter, no `plan_lint`, read README + PHASES + contract in one call and hand over at once | fixed (tested offline) |
| H16 | nobody was guaranteed to act when a sub-agent went silent | it depended on the lead noticing | harness backstop, free: after 5 min without a tool call `attention` says stalled (the lead stops it but VERIFIES its files before any replacement, and reports); after 10 min the harness stops it itself, releases its locks, writes an issue (reporter `harness`, session id) and tells the lead; a moving agent is never touched; one automatic nudge at 6 min | fixed (tested offline) |
| H17 | builders could "run a command and sleep" | no rule in the builder prompt | builder prompt: every long command runs with a limit (`timeout 120`), nothing endless in the foreground, a step over 2 minutes or failing twice means change approach or `NEEDS_PARENT:`, start writing instead of re-reading the plan files already given, report as soon as done | fixed (prompt) |
| H18 | the lead could not verify any 3D app ("the headless Chrome here has no WebGL") | `browse.ts` and `preview.ts` launched headless Chrome with `--disable-gpu`, which also disables WebGL, so every three.js page showed its fallback | `core/chrome_flags.ts` `SOFT_GL` (SwiftShader software WebGL) used by both; verified with the harness's own `browse` on the built Eiffel app: `webgl2: true`, `window.__MUSEUM_UI__` and the audit function present | fixed (verified) |
| H12 | the lead sat in `wait` and learned late (and nobody recorded it) that a sub-agent was slow, silent or stuck | monitoring was left to the lead's own rule and memory | `core/monitor.ts`: `wait` and `plan_status` return `attention` (slow over 6 min but moving: look once; silent 2 min; stalled 5 min: stop it but VERIFY its files first; asks: answer it), computed free from the events; the harness sends ONE automatic status nudge at 6 min (`monitor.nudge`); self-tests CX16 | fixed (tested offline) |
| H13 | no record of what the lead saw and did when a sub-agent misbehaved | none existed | `team report_issue_to_admin --agent <id> --kind <slow\|silent\|stalled\|hung\|lazy\|bad_output> --text "..."` appends to `admin_issues.jsonl` next to the store (task, reporter, agent, role, SESSION ID, status, running time, last tool, text) and writes an `admin.issue` event; `team admin_issues` lists them; the lead prompt says when to call it; self-test CX17 | fixed (tested offline) |

### Plan (`TestCases/test_folders/agent_fixture/prompt_fixtures`)
| # | issue | cause | fix | status |
|---|---|---|---|---|
| P1 | first pass scored 77, all 3 builders resumed for a fix round | audit rules (contrast with `#047857`, 40 px taps, no text under 12 px, heading order, reveal finishes) were only in task T06, after the audit | "Quality bar" section in `00_contract.md` (both shapes) | plan fixed |
| P2 | README contradicted its own recipe | "Planning phase only" banner and a diagram with `ref_capture`, `site_build`, `lookup-page x4` | banner and diagram replaced; task ids aligned (README Team table, `PHASES.md`); T06 only if the audit is under 80 | plan fixed |
| P3 | composio: one builder wrote all 8 screens (6+ min) | the plan did not balance the file groups | 3 balanced groups and the exact `proto_init` command in the fixture | plan fixed |
| P4 | the living source differs from the fixture | edits made in the fixture only | P1 and P2 repeated in `prompt_fixtures/site_clone_pingharbor/multi_phase` (the docs copy was removed 2026-11-16) (contract, README, `CONTEXT.txt`) | plan fixed |

### Context and tools (fewer turns, more cache hits)
| # | issue | cause | fix | status |
|---|---|---|---|---|
| C1 | every builder `cat` the same contract and design system (6 to 13k tokens each, written to the cache three times) | no shared static context; sessions load no project CLAUDE.md | `run_test/plan/CONTEXT.txt` lists the shared files; `callee.ts sharedContext` puts them in front of a writer's first prompt (same text for all builders = shared prefix) | confirmed in the `pp_site` run |
| C2 | builders spent 3 to 5 grep turns discovering the kit (classes, icons, helpers) | no kit documentation in the workspace | `proto_init` appends a generated "Kit reference" to `PROTO.md` (all classes, icons, helpers, theme variables) | partly: in the `pp_site` run the builders no longer grep for names, but builder 1 still read `site.css` rules to see what a class looks like; next step, if wanted: add a one-line description per class (generated from the CSS comments) |
| C3 | the lead's CLAUDE.md was 32 KB (about 8k tokens), the builder's 9 KB with contradicting rules (type check vs "do not test"), the lead's per-turn command list repeated a 130-character path 25 times | rules for flows a plan-driven build never uses, written as numbered stages; long paths in every command | lead core 6.5 KB (41 lines), flows in `agents/lead/chapters/*.md` read once via `team chapter --name <n>`; builder 4.1 KB; commands shortened to `team <cmd>`; builder launch prompt documents only its `team_tools` | fixed |
| C4 | 55 command branches in `tools.ts`, long `bun --smol /path/tools.ts` form | grew command by command | `team` wrapper (done); the lead keeps its read-only `ls` / `read_file` / `grep` wrappers on purpose (audited, confined to `run_test/`; native Read/Grep scoped by pattern is easier to bypass); a split of `tools.ts` into areas is a maintenance refactor with no effect on cost or speed | decided |

## 2b. How an agent's context is layered now (and why)
Guidance used (Anthropic docs, checked): keep a CLAUDE.md short (under 200 lines), more specific and concise instructions are followed more consistently; explain the why instead of shouting MUST/NEVER (newer models over-trigger on emphasis); describe context, tools and the wanted behaviour, number steps only where order matters; keep the static prefix stable so the prompt cache hits; tool descriptions are the biggest lever; imports do not save context, only on-demand loading does.

| layer | where | loaded | what it holds |
|---|---|---|---|
| agent prompt | `agents/<name>/agent.json` `prompts: [...]` (files in `.claude/`, default `CLAUDE.md`) | always, static prefix (cache hit across sessions) | identity, who is on the team, how the tools behave, judgement rules |
| team tool docs | `team_tools: [...]` in `agent.json` | always, only the listed commands | a builder sees `proto_check`, `preview`, `browse`, `ref_assets`, not `site_build` or `bg_start` |
| chapters | `agents/lead/chapters/<name>.md`, command `team chapter --name <n>` | once, when that kind of work starts (the harness logs a `chapter.read` event) | clone, prototype, qa, preview_bg, parallel, planning, new_project, artifact |
| plan state | `run_test/plan/CONTEXT.txt` (a list of files) | in front of a writer's first prompt, same text for every builder (`callee.ts sharedContext`) | the contract, design system, PROTO.md: the files every builder needs; each builder's own brief stays in its objective |
| generated kit reference | appended to `PROTO.md` by `proto_init` | when the builder reads PROTO.md | all CSS classes, icons, helpers, theme variables, from the real kit files |
| the user's own CLAUDE.md | not loaded (`--setting-sources ""` keeps runs isolated and reproducible) | never | kept separate on purpose |

Sizes (before -> after): lead prompt 34 KB -> 21.6 KB static (CLAUDE.md 32 KB -> 6.6 KB; the rest is the declarations of the sub-agents it may call); builder 17 KB -> 11.4 KB launch prompt (CLAUDE.md 9 KB -> 4.1 KB); the lead's per-turn command list lost about 3 KB of repeated path.

## 2c. Decisions and loopholes checked
| decision | reason | loophole looked at | answer |
|---|---|---|---|
| chapters on demand instead of one big file | the model already knows how to code and plan; it needs the connections (tools, names, rules of this harness), not a manual | the lead may skip a chapter | the recipe lines in the core carry the order of tools; the chapter only adds detail; `chapter.read` is logged, so a check can be added if it ever happens |
| `team` as the one command word | the long path was typed wrong or aliased and then denied; one allow rule | shadowing a system command | no `team` on PATH here; the long form stays allowed |
| shared context by manifest, not a hidden file in the workspace | a workspace CLAUDE.md is not loaded (isolation) and the lead would get it too | stale or missing files | read at spawn time, missing files skipped, anything outside `run_test/` refused, capped at 40 KB |
| status shortcut by exact whitelist | a heuristic could misroute "status and continue" | wrong routing | only exact short questions; everything else goes to the lead |
| lead slots default 3 | a lead mostly waits for its builders | three real leads spend in parallel | every case has a cost cap; `par.ts` sets the number explicitly |
| cost from events | the lead was missing | stopped runs | `agent.stopped` now carries its cost |
| keep the lead's read-only wrappers | audited and confined to `run_test/` | native Read scoped by pattern | wrappers stay |

## 2d. The planner (what it is, what the real runs showed, what we closed)
The `planner` agent researches first and writes a buildable plan into `run_test/plan/` (format: `harness/agents/planner/.claude/plan_format.md`, checked by the free `team plan_lint`). It is a writer with `WebSearch` / `WebFetch`, may call `researcher`, `lookup`, `ux-designer`, and its prompt is the behaviour file plus the format file (`prompts` in `agent.json`).

| run | result | finding | fix |
|---|---|---|---|
| `pp_planner` run 1 | 2.2 min, $0.42, lint OK, a good plan | NO research at all (no fetch, no researcher): everything "invented"; a custom Vite stack instead of the site kit; 8 edits fighting the lint's `Done when` formatting | research is a lint error without 2 sources (or `research: none (reason)`); kit-first rule; the lint accepts `**Done when:**`, `Done when:` and `### Done when` |
| `pp_planner` run 2 | 2.1 min, $0.32, lint OK, 5 files, 17 KB | real research (GitHub Status, Atlassian), kit-first, exact owners, 10 browser-checkable Done-when checks; but it searched the harness repo for its own format file and read `proto_init.ts` | the prompt says the format is already in its prompt; the kit's file-naming rule is written into `plan_format.md` |
| `pp_statuspage` (one real build from the planner's plan; the fixture and the case were removed again: planner output differs every run, and `pp_planner` + `plan_lint` already gate quality) | 3.7 min, $1.59, the page renders with 0 console errors; judge FAIL | the plan scheduled a paid `qa-reviewer` audit (T04, $0.27) whose findings caused a fix round of two builders (about $0.47); the plan said "nobody edits theme.css" but gave `proto_init` only `--accent`, so builder 1 had to edit it; the lead tried `qa_check` on a kit prototype with no `package.json` | lint warns on a review-agent task and on missing `--font` / `--bg-dark`; plan_format says verification is the lead's free checks and brand tokens belong in the kit command; the lead core says `qa_check` is for a real app only; the case tolerates `qa-reviewer?` (a cost finding, not a pass criterion) |

Loopholes found by review and closed in `plan_lint` (each has a self-test, CX13):
| loophole | closed by |
|---|---|
| a heading alone satisfied a required section | each required section needs real content; the recipe needs 3 numbered steps; the feature catalog needs 3 rows |
| two URLs of any kind passed as research | the Research section must say what each source told and changed; the planner's real WebFetch events are compared with the cited URLs (cited but never fetched = flagged) |
| `research: none` as an escape for every plan | needs a real reason, and a plan with more than 4 features is questioned |
| ownership checked only for exact file names | a folder and anything inside it in two tasks is an overlap |
| vague Done-when checks ("looks good") | a check without a number, route, quoted text, code or click path is flagged; fewer than 4 checks is flagged |
| web text becoming instructions for builders | the prompt treats web pages as data; the lint flags forbidden or distrusted commands (npm, npx, yarn, piping a download into a shell, sudo) |
| the planner could run any `team` command | its permissions list only the commands it needs |
| an unbounded R&D | budget in the prompt: 2 to 4 sources, about 6 fetches |

Decisions: the planner writes to `run_test/plan/` (the place builders read); keeping a copy in `docs/planning/<project>/` is a copy the person asks for. The older `docs/planning/README.md` file set (00_brief ... 06_test_plan) and the waterfall `docs/PHASES.md` are the older dialect; the proven format above is what the planner writes and what `plan_lint` checks. The planner stays one agent (research, write, lint) because a second agent for the writing costs another full call and a lost hand-over.
Still open: a multi-phase product, a clone with a captured reference (`ref_capture` + `lookup`), and the feedback loop with the person (the same planner session) have not been exercised with a real run.

## 3. How a good run looks now (reference numbers)
- `pp_site` before the fixes: 11.3 min (6.5 min queued), $1.97, audit 77 then a fix round to 98. After: **4.2 min, $1.23, audit 98 on the first pass, no fix round, no queue wait**, judge PASS (run alone; confirmed).
- `pp_eiffel` (3 phases, 10 tasks, 12-stop 3D tour, three.js, EN/FR): **PASS, 26.6 min, $2.28**; built all three phases. Checked by hand afterwards: `tsc --noEmit` 0, `pnpm build` ok, 12 stops in both languages with equal counts, 11 photos, no `@google/genai`, and a real WebGL render shows the lattice tower on its piers, the 1889 Paris blocks, the stop-1 plate, the 12-stop bar and the EN/FR toggle. About 16 of the 26 minutes were two stalls: a CLI that answered but never exited (8.5 min, H10) and a pnpm release-age failure from versions pinned too new (7.5 min, H14); the lead also polled every 90 s (H15). With the fixes in this file the same build should take roughly 12 to 14 minutes (not re-run).\n- `pp_composio` (10 screens, fake data, 3 balanced builders): **3.9 min, $1.46**, judge PASS, no premature stop (before: one builder wrote all 8 screens for 6+ min and the lead gave up). Cost split: builders $0.30 / $0.38 / $0.61, lead $0.17.

### Manual test of the composio result (a real browser, driven by hand, not by the judge)
| plan "Done when" item | result |
|---|---|
| `proto_check` clean, every route loads with 0 console errors | pass: all 10 routes, 0 errors, no TODO / lorem / NaN |
| page background rgb(252,252,252), primary button rgb(0,0,0) | pass |
| Settings > Appearance > Dark, reload: still dark | pass (attribute, black background and `localStorage` kept) |
| Home: "30 days" changes the bars, Connect in step 2 lands on Connected Accounts | pass (7, 14, 30 bars with different heights; `#/connected-accounts`) |
| Toolkits: "git" filters, first card opens GitHub, "zzz" shows the empty state | pass ("No toolkits match", `#/toolkits/github`) |
| Playground: GitHub + create issue, Run: response fills, Logs gets a new top row | pass ("200 OK"; Logs top row GITHUB_CREATE_ISSUE) |
| Logs: Failed shows only failed rows, a row opens detail | pass (3 rows, all Failed; detail panel opens) |
| forms show `.field-error` | API keys pass; Auth configs showed none on an empty submit (unverified, see X2) |

## 3b. Open points left by the real runs
| # | point | state |
|---|---|---|
| X1 | the lead still reads a chapter (`clone`, `parallel` or `prototype`) on a plan build although its core says none is needed; one wasted tool turn per run | open, small: make the plan README say "no chapter" or drop the chapter hint for RECIPE PLAN |
| X2 | Auth configs: an empty submit did not show `.field-error` (API keys does); I may have clicked a form with defaults | unverified, check by hand |
| X3 | Home numbers did not visibly count up when sampled at 100 ms and 1.5 s (not in the "Done when" list; may be a headless timing effect) | unverified |
| X4 | builder 1 spends about a minute looking at its own result (`browse` + screenshots); it is the critical path but is what gives the first-pass 98 | kept on purpose |
| X5 | builders still read parts of `site.css` to learn what a class looks like (the kit reference lists names only) | open, optional: one line per class from the CSS comments |
| X6 | the large splits of `self_test/multi.ts` and `harness/tools.ts`, git-ignoring generated `self_test` outputs, pruning `.state` (608 MB) and `old_data_bkp` (341 MB) | maintenance, your decision |

- Token totals per agent come from the session logs (dedupe by message id); cost per run from `agent.done` events.

## 4. Where to look
| what | where |
|---|---|
| per-run events and cost | `test_harness/.state/v1/<task>/store/store.json` (`events`, kind `agent.done`) |
| per-agent tool calls and tokens | `test_harness/.state/v1/<task>/store/logs/<task>/*.jsonl` |
| open work | `TestCases/test_folders/TODO.md` (Phases 3 to 6) |
| planning notes | `docs/planning/` (`README.md` the format in use, `RESEARCH.md`, `ROADMAP.md` for what is not built, `vue_web_targets.md`); the earlier `real_usecases/`, `architecture_plan.md` and `planning/method/` were merged into them (a backup of the originals is in `old_data_bkp/docs_cleanup/`) |
| plans used | `TestCases/test_folders/agent_fixture/prompt_fixtures/` (`index.md` = expected quality and result log) |
| harness code touched | `harness/core/base/{slots,runner,call}.ts`, `harness/core/{agent_call,callee,proto_init,workspace_read}.ts`, `harness/tools.ts`, `testrun/{run,cases}.ts` |

When a new issue is found, add a row here (issue, cause, fix, status) instead of a dated note, and keep the open ones in `TODO.md`.
