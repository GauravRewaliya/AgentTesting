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

### Plan (`TestCases/test_folders/agent_fixture/prompt_fixtures`)
| # | issue | cause | fix | status |
|---|---|---|---|---|
| P1 | first pass scored 77, all 3 builders resumed for a fix round | audit rules (contrast with `#047857`, 40 px taps, no text under 12 px, heading order, reveal finishes) were only in task T06, after the audit | "Quality bar" section in `00_contract.md` (both shapes) | plan fixed |
| P2 | README contradicted its own recipe | "Planning phase only" banner and a diagram with `ref_capture`, `site_build`, `lookup-page x4` | banner and diagram replaced; task ids aligned (README Team table, `PHASES.md`); T06 only if the audit is under 80 | plan fixed |
| P3 | composio: one builder wrote all 8 screens (6+ min) | the plan did not balance the file groups | 3 balanced groups and the exact `proto_init` command in the fixture | plan fixed |
| P4 | the living source differs from the fixture | edits made in the fixture only | P1 and P2 repeated in `docs/vibe_planning_examples/site_clone_pingharbor` (contract, README, `CONTEXT.txt`) | plan fixed |

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

## 3. How a good run looks now (reference numbers)
- `pp_site` before the fixes: 11.3 min (6.5 min queued), $1.97, audit 77 then a fix round to 98. After: **4.2 min, $1.23, audit 98 on the first pass, no fix round, no queue wait**, judge PASS (run alone; confirmed).
- `pp_composio` (10 screens, fake data, 3 balanced builders): **3.9 min, $1.46**, judge PASS, no premature stop (before: one builder wrote all 8 screens for 6+ min and the lead gave up). Cost split: builders $0.30 / $0.38 / $0.61, lead $0.17.

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
| plans used | `TestCases/test_folders/agent_fixture/prompt_fixtures/` (`index.md` = expected quality and result log) |
| harness code touched | `harness/core/base/{slots,runner,call}.ts`, `harness/core/{agent_call,callee,proto_init,workspace_read}.ts`, `harness/tools.ts`, `testrun/{run,cases}.ts` |

When a new issue is found, add a row here (issue, cause, fix, status) instead of a dated note, and keep the open ones in `TODO.md`.
