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

---

# Part 2 (2026-11-13, evening): website clones, a real browser for agents

Why: session `smwf14yje` ("do make ditto clone like https://upwatchr.io/blog", sections + animation + theme). The user: not working well, pages not linked, the aim was changed, the quality was nowhere near the site. Root causes found in its log (4 builders, 13 min, single `index.html` files, three different drafts):

| # | what lagged | evidence | fix |
|---|---|---|---|
| 1 | the researcher could not SEE the site: WebFetch returns a model-written summary (no CSS, colours, fonts, pictures); the lead itself said "I can't get the stylesheet, colours, fonts or spacing" | researcher#1/#2 reports | `ref_capture`: a real browser (Chrome DevTools Protocol) scrolls the page and saves one picture per section (light, dark, mobile), raw css tokens, the section outline with components and computed styles |
| 2 | the builder never saw the reference: it built from a text summary | builder#1 objective | builders `Read` the section pictures; REF.md lists every section with its components |
| 3 | the aim drifted: blog list, then "Example Blog", then a blog grid, then a product home page; one-file drafts each time | lead replies | lead prompt WEBSITE / CLONE FLOW: keep the brief, analyse first, decide the pages itself, never ask, never refuse a test clone (rename the brand, write own text) |
| 4 | no real pages and links: one `index.html`, links copied from the real site or `#` | builder#1/#2 | `proto_init --kind site`: header, footer and every page linked from the real route list, article detail routes, `preview` opens every route AND every detail link and reports `href="#"`, links to unknown pages, "not found" views |
| 5 | no sections, animation, theme: nothing provided | builder#3 "polished" rewrite took 4 min and still looked generic | `kits/site`: tokens with light/dark (follows the system, toggle, persisted), sticky header, hero with aurora, card grids, steps, stats, logos marquee, pricing, FAQ, CTA band, blog grid + article typography, scroll reveal (`.reveal`), reduced-motion support |
| 6 | nobody checked the result against the target | lead answered from the page-load check | `ref_compare`: score and one line per gap (sections, card grids, CTAs, icons, animation, fonts, dark theme, dead links, page height, mobile) measured in the browser, max 3 repair rounds |
| 7 | builders lost ~6 steps finding how to run `proto_check` (`command not found`, wrong `--dir`, "no index.html") | builder logs of `t_real_proto_fast_path` | real executables on every agent's PATH (`harness/bin/*`), and folder arguments resolve from anywhere (`.`, `x`, `run_test/x`, absolute) |
| 8 | the lead refused to publish the clone ("copies another company's branding") and asked for permission several times | lead replies | prompt: a ditto clone for test / education is fine (rename brand, original text); do not refuse, do not ask |
| 9 | a section picture was blank on sites that reveal content on scroll | first browser test | the browser scrolls through the page like a person before it takes pictures |

## The browser (answers "can we bind a Chrome extension?")
The harness drives Chrome over the DevTools protocol (`core/browse.ts`, no extension, no install, no model call). That is the same mechanism a browser extension uses and it can do what a person does: open a page, emulate light / dark / mobile, scroll, click by text or selector, evaluate JavaScript, screenshot the viewport, the full page or one section, read computed styles and an OUTLINE of every section (heading, background, font, card grid size, buttons, icons / images, animation). Commands (on every agent's PATH):

| command | use |
|---|---|
| `ref_capture --url <u> --name <n>` | study a site: `run_test/_ref/<n>/` (REF.md, outline.json, pictures per section, dark, mobile, page.html, styles.css), ~15 s |
| `proto_init --kind site --dir run_test/<p> --title <brand> --nav "Home, Features, Blog, ..." --accent #hex --font "Name" --bg-dark #hex --extra "Privacy, Terms"` | the working website shell, every page linked |
| `browse --url <u> \| --file run_test/<p>/index.html [--route /blog] [--scheme dark] [--mobile] [--shots <prefix>] [--steps '[{"scroll":900},{"click":"Features"},{"shot":"a.png"},{"eval":"location.hash"},{"outline":true}]']` | look at any page like a person; pictures go to `run_test/_shots/` and are opened with `Read` |
| `ref_compare --ref <n> --dir run_test/<p>` | score + gaps against the reference |
| `proto_check`, `preview` | as before; `preview` now also opens every route and detail link |

## Flow (WEBSITE / CLONE)
lead: `ref_capture` (+ one per other page type) -> reads REF.md, decides pages / sections / accent / font itself -> `proto_init --kind site` -> `fork_all` builders (~4 pages each, each LOOKS at the pictures, replicates sections, verifies its own pages with `browse --shots`) -> `ref_compare` gaps to the owning builder (max 3 rounds) -> `preview` (all routes + links) -> link.

## Files added / changed (under `test_harness/core/orchistraitor/f1_multiagent/harness/`)
`core/browse.ts` (CDP driver), `core/ref_capture.ts`, `core/ref_compare.ts`, `kits/site/{site.css,site.js}`, `core/proto_init.ts` (`siteInit`), `core/preview.ts` (`smokeRoutes`: dead links, unknown routes, detail links), `bin/*` + `core/base/runner.ts` (`binEnv`), `tools.ts` (`browse`, `ref_capture`, `ref_compare`, path resolver), lead + builder `CLAUDE.md`, lead `settings.json`, `core/launch.ts`. Tests: `self_test/multi.ts` PK7-PK12 (incl. real-browser checks), case `real_site_clone`.

## How to keep improving response quality (ideas, in order of value)
1. A SECTION-level repair loop: `ref_compare` is page-level; give it a per-section visual score (downscaled picture difference) so the lead can say "section 4 does not match" and send exactly that section.
2. Builder model: for clones the builders are the quality ceiling. Try `HARNESS_MODELS='{"builder":"sonnet"}'` on the case and compare the `ref_compare` score and cost with haiku (cents per run): decide with numbers.
3. Reference of OTHER page types: the lead already captures home / article / pricing; store them as `--name <n>-article` and tell the matching builder.
4. Real images: the clone uses gradients and inline svg; an optional `ref_capture --assets` could download the reference's images for the test to place, if licences allow.
5. Keep the measured numbers: each real case writes time, cost and `ref_compare` score into `PROGRESS.md` (a regression shows at once).
6. Idle waits: the lead still starts a `wait` per round; a harness-side "run all builders and return when `ref_compare` is clean" would save turns.
