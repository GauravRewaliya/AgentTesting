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

---

# Part 3 (2026-11-13, night): lookup agent, reference store, connected browser, audit, react-as-one-finishes

## Roles after this change (who does what)
| agent / tool | does | does NOT |
|---|---|---|
| `researcher` | TEXT based: facts, docs, search, WebFetch | look at a site (a WebFetch is a model-written summary) |
| **`lookup`** (new) | the visual UI/UX reference analyst: LOOKS at the section pictures of a studied site, writes `layouts/` and `briefs/` into the reference store; a big piece is split across COPIES of itself (see Part 4) | build pages |
| `builder` | builds the pages of ONE screens file from its brief, verifies with `browse` | study the reference, run `ref_capture`, hunt for assets |
| harness tools (no model) | `ref_capture`, `ref_assets`, `ref_store`, `ref_compare`, `browse`, `site_audit`, `proto_init`, `proto_check`, `preview`, `browser_*` | |
Flow for a site clone: lead `ref_capture` (13 s, builds the whole store) -> reads STORE.md / MAP.md / REF.md and decides pages -> `proto_init --kind site` -> **lookup** writes the briefs (2-4 min) -> `fork_all` builders in parallel, each from `briefs/BRIEF.md` + `briefs/BRIEF_<file>.md` -> the lead reacts with `wait --any` as each finishes -> `ref_compare` -> `preview` -> `site_audit` for improvements.

## The reference store (fixed layout, one per studied site: `run_test/_ref/<name>/`)
| path | what |
|---|---|
| `STORE.md` | index: what is where and how to reference it (start here) |
| `MAP.md` | the mind map: site -> sections -> components -> pictures -> assets -> layouts -> briefs, as a markdown tree AND a Mermaid `mindmap` block |
| `REF.md` | design tokens (fonts, colours, radius, css variables), motion, header / footer links, section list with the real computed styles |
| `outline.json` | the measured outline (`ref_compare` reads it) |
| `pictures/` | `desktop-light-full`, `desktop-light-section-NN` (one per section), `desktop-dark`, `mobile` |
| `assets/<logo|icons|images|social|backgrounds>/` + `assets.json` | the real images the page uses (22 for upwatchr.io, 3 s), source url, size, role; local test clones only |
| `raw/` | `page.html`, `styles.css` as served |
| `layouts/`, `briefs/` | written by the lookup agent; `ref_store --name <n>` rebuilds STORE.md and MAP.md with them linked in |

## Connected browser (UI page "Browser", CLI `browser_*`)
`browser_status | browser_connect | browser_launch | browser_toggle --on/--off | browser_disconnect`; `browse --tab "<part of url or title>"` inspects a tab that is already open (a logged-in page). Agents use the connected browser only while it is switched ON; the private headless Chrome is the default and the fallback (also when the connected one stops answering). Own tab per task, closed afterwards (the driver waits until it is gone). The UI page shows status, connect / launch / toggle, the open tabs with a picture of each, and a "Try it" that shows what an agent sees (full page + section outline). Later: Claude-in-Chrome can replace the CDP attach behind the same commands.

## Site audit (our own website)
`site_audit --dir run_test/<p> | --url <https://..>` opens every page (desktop + phone) in the real browser and writes `run_test/_audit/<n>/AUDIT.md` (high / medium / low with a fix each, a score): contrast (WCAG, gradients are skipped, not guessed), alt text, names of icon-only controls, dead links and unknown routes, heading order, h1, meta / lang / viewport, tap targets and horizontal overflow on a phone, content stuck invisible, form labels, oversized images, too many fonts, console errors. First run on the real clone (tickwatch): score 52, 5 genuine high items (white text on the `#10b981` button = 2.5:1 and a status badge = 2.0:1); the kit button now mixes the accent toward black so white text reaches 4.5:1 for any brand colour.

## Reacting while others work
`wait --any --agents a,b,c` returns as soon as ONE finishes, with the harness's own browser check of that agent's pages (`checks`: stub, dead link, JS error, undefined / NaN; verdict CLEAN or FIX). The lead sends the FIX to that builder at once or hands the free slot the next piece. Found in session t_real_site_clone: builder#2 finished at 2.2 min while the lead only saw it at 5.9 min.

## Known gap (found by looking at the result, not by the score)
`ref_compare` scores structure (sections, card grids, CTAs, icons, animation, height): the real clone scored 100 on the blog page although the reference lists articles in ONE column and the clone made a 3-column card grid. The lookup briefs now state the layout in words and numbers per section, and the next step is a per-section layout signature (columns of the repeating items) inside `ref_compare`.

## Tests
`self_test/multi.ts --suite protokit` = PK1-PK21 (starter kits, site kit, theme and navigation in a real browser, connected browser attach / own tab / `--tab` / fallback / toggle, ref_assets, lookup agent definition, reference store and mind map, site audit on planted defects and a clean page). Real case: `real_site_clone`.

---

# Part 4 (2026-11-14): what the real runs showed, and what was simplified

## Measured (real_site_clone, haiku, same request each time)
| run | what | time | cost |
|---|---|---|---|
| no lookup, 3 builders | structure 100 but the blog was a card grid (the reference is a one-column list) | 2.6-7 min | $0.2-0.7 |
| one lookup agent doing everything | read 17 pictures one by one, wrote 6 documents in a row, died on a missing command | 7.9 min | $1.25 |
| lead skipped the pipeline ("one file, one builder, to stay fast") | no briefs, no checks | 2.2 min | $0.36 |
| `site_build` pipeline | briefs 1.8 min (parallel), builders overlap, checks + fixes 2.6 min; blog is a faithful one-column list | 6.7 min | $1.75 |
Split of the $1.75: lead $0.36, lookup calls $0.07, builders' first build $0.64, builders' FIX rounds $0.68. The fix rounds chased a FALSE alarm of my own audit (a `color-mix()` colour it could not read: 1.0:1 reported, 5.3:1 real). So: the separation itself is cheap ($0.07 for the lookups); the waste was the false alarm plus resumed big-context builders (4-5x the cost of a fresh small one).

## Simplifications made
- ONE `lookup` agent (the `lookup-page` role is gone): a role that lists itself in `agents[]` may start copies of itself, one level deep (`agent_call.ts`: `selfSplit`; `checkAgents` accepts the self-reference). It does a small job itself and splits a big one across at most 3 copies.
- `site_build` (generated plan, runs by itself): ONE lookup call per screens file (the first also writes the design system), a builder per file that depends only on its own brief; ~2 pages per file; the output carries an ETA and `plan_status` says "healthy, nothing to do but wait". Works for sites and admin dashboards. A lone builder is REFUSED once a reference store exists.
- Routing: any request with a URL / "like <product>" is RECIPE CLONE, also when it says "admin dashboard" (a real session skipped the lookup because it read "admin dashboard" as RECIPE APP). A login wall is reported, not silently cloned.
- FIX policy for the lead: must-fix (dead link, missing slug, JS error, stub, missing section) goes to a NEW small builder; style findings (contrast, tap targets) are reported, not looped on; one fix round.
- Audit: colours are normalised by the browser (canvas), no hand-written parser. Kit: `--accent-text` and the primary button reach WCAG 4.5:1 for any brand colour.
- Plan validator: tasks that write DIFFERENT files are not "the same work given twice".
- Capture: contact sheets (4 sections per picture, one browser for all), dark / mobile first screen only, clean capture (cookie dialogs, bars, chat widgets, ad slots, modal backdrops, fixed header pinned, no scrollbar), `--more` for several pages at once; a full capture is ~10-20 s.
- Background jobs (`--async`) + `wait --any` for slow tools; polling every 0.4 s.

## Browser modes (final)
Agents use the PRIVATE HEADLESS Chrome by default (same engine, same pictures; nothing opens on your screen). The UI page "Browser": **Launch Chrome** opens a real visible Chrome with its own profile so the PERSON can log in; launching or connecting does NOT hand it to the agents. Switch **agents use it** ON only when a page needs your login (then agents work in a tab of their own and close it). Every look-at-pages tool reports which browser did the work (`browser`), the UI header shows a status chip, and nothing is ever started or restarted behind your back. Later: Claude-in-Chrome can sit behind the same `browser_*` commands.

## Rules learned
- Do not run real tests while the person is using the system: the machine-wide single lead slot made a user's session wait 303 s behind a test run.
- The sandbox rule stays: agents with no sub-agents run in Docker. `lookup` now lists itself, so it runs like the lead and the builder (host), and only reads pictures and writes markdown in its own folder.
