# Prototype starter kit (fast, parallel, corporate-looking prototypes)

Written 2026-11-13. Why: a real session (`smwex2xnw`, "clickable admin mockup like Composio") took 77 min, cost $2.40 and used 25 calls to make a wireframe. Target now: a preview link in about 4 minutes (hard limit 10).

## Past vs now
| | PAST (session smwex2xnw) | NOW |
|---|---|---|
| first 15 min | researcher + planner + ux-designer wrote spec and markdown wireframes nobody asked for; 3 round trips lost to undeclared writes / Bash denied | nothing before the build: the lead picks the screens from the person's words and runs `proto_init` (10 ms, no model call) |
| build type | the "new project: ask generator options" rule made a Vite + TS + Pinia + ESLint app (84 files, 20 min of pnpm release-age trouble, lead turn timed out at 30 min) | no build, no npm: Vue 3 from a CDN, plain files; prototypes are exempt from the ask-first rule |
| design | the base builder wrote tokens/shell/router each run: slow, quality varied | harness-owned corporate kit (`kit.css`, `kit.js`), identical every time |
| parallelism | builders `delegate`d one after another; v2 restyle resumed old heavy builders ($0.49 per call) | `fork_all` starts one builder per screens file at once, one `wait` |
| lock lease | 2 min: a long silent Write lost its lock, 4 min retry | 20 min (`HARNESS_LOCK_TTL_MS`, `guardEdit`, `activity.ts`); builder told to save each screen as soon as drafted |
| check before showing | `preview` only asked "does the page load" | `preview` opens EVERY route in headless Chrome and lists stubs, undefined/NaN, empty tables, JS errors (about 3 s) |
| page check time | about 28 s (WebGPU probe on every preview) | 0.8 s (probe only if the page has a canvas) |
| lead prompt | said "killed after 10 min" (limit is 30) | corrected; TIME BUDGET rule; stalled builder (8 min, no new file) is stopped and split |
| writes | a writer called without `--writes` failed on its first Write and cost a second call | defaults to the `run_test/<project>` named in the objective (`withWrites`) |

## How it works
1. Lead: `tools.ts proto_init --dir run_test/<p> --title "<name>" --nav "Overview, Apps, Build>Logs, Build>Playground, Settings"` (`Group>Label` groups screens into one file; at most 4 groups).
2. Result in `run_test/<p>/`: `index.html` (shell, already runs), `css/kit.css`, `js/kit.js`, `js/screens/<group>.js` (one stub per screen, says TODO), `css/pages-<group>.css`, `proto.json`, `PROTO.md` (contract: route -> screen -> file -> owner, rules, class list, example).
3. Lead: `fork_all --role builder --tasks '[...]'` one task per screens file (writes = its screens file and its pages css), then ONE `wait`. A small prototype (up to ~4 screens) is one builder.
4. Builders replace the stubs (finished screens: search/filter that works, detail view, empty state, modal/toast, validated forms, 8-15 believable rows), run `proto_check`.
5. Lead: `preview --dir run_test/<p>`: every route is opened; problems are returned per route with the owning file; the lead hands them to that builder; max 3 identical failures (same loop as `qa_check`).
6. Changes later go to the owning builder (`--session <id>`); a new screen = a stub + a `nav` entry in `index.html` (the one allowed edit).
A tiny wireframe without `proto.json` is a SINGLE `index.html` (artifact style: CDN libs, inline style/script). The full build (pnpm, Vite, `qa_check`) is only for "the REAL app".

## Files (all under `test_harness/core/orchistraitor/f1_multiagent/`)
| file | role |
|---|---|
| `harness/kits/proto/kit.css`, `kit.js` | design system + app shell, router, `ui-modal`, `ui-drawer`, `ui-badge`, `ui-empty`, `ui-icon`, toast |
| `harness/core/proto_init.ts` | `proto_init`: parse nav, copy kit, write shell, stubs, `proto.json`, `PROTO.md` |
| `harness/core/proto_check.ts` | now also reads inline `<script>`/`<style>` and `app.component('x-y')` (single-file prototypes) |
| `harness/core/preview.ts` | `smokeRoutes` (all routes in parallel), WebGPU probe only for canvas pages |
| `harness/tools.ts` | `proto_init` command, route problems in `previewGate`, `withWrites` default for `delegate` and `fork_all` |
| `harness/core/launch.ts`, `harness/agents/lead/.claude/{CLAUDE.md,settings.json}`, `harness/agents/builder/.claude/CLAUDE.md` | lead PROTOTYPE FAST PATH, builder KIT / SINGLE-FILE modes, `proto_init` allowed for the lead |
| `self_test/multi.ts` (suite `protokit`, PK1-PK6; NP1 and M4h updated) | offline checks, 175/175 |
| `TestCases/test_folders/real_planning_prototype/main.ts` `real_proto_fast_path` | real case: proto_init first, parallel builders, no planner/research/build |

## Measured (real run, haiku lead + haiku builders, Docker sandbox, case `real_proto_fast_path`)
| | PAST (smwex2xnw) | NOW |
|---|---|---|
| time to a working preview link | 77 min (first no-build prototype at 41 min) | **3 min 10 s** (builders done at 1.9 min) |
| cost | $2.44 | **$0.056** |
| calls | 25 (researcher 2, planner 1, ux-designer 4, builder 18) | 2 builders (+ the lead) |
| planner / ux-designer / research / pnpm / qa_check | all used | none |
| result | 3 prototype versions, no reliable check | 8 screens, 54 KB of screens, all 8 routes pass the browser smoke check |
Defect found by looking at the screenshots and fixed in the kit: `.stat` was not a complete card (no border, values right-aligned because the builder combined it with `.num`); icon guess gave "Connected accounts" and "Members" the same icon. The case expects 2 builders for 8 screens (rule: ceil(n/4) screens files, at most 4).
Self-tests: 175/175 (SL1/SL2, the process-slot timing tests, fail only when the machine is loaded by other runs; they pass alone).

## Open / not done
- Models are still haiku everywhere. If screens look thin, try the builders on sonnet (`HARNESS_MODELS='{"builder":"sonnet"}'`): costs more credits.
- `maxInstancesPerRole` is 4: at most 4 builders in parallel (the 4-group limit in the lead prompt).
