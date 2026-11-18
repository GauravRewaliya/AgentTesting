# test_treejs_sakura / qa : the TWO real builds of the same request (used exactly as built, nothing mutated)

The request (verbatim, used by the suite):
> can you give me famous sakura animated rotating and falling leaf animation and minecraft look stuff using three js
> index.html with proper codes i want preview of it to look on can use any thing as you want
> also i want you to create a demo video of it too

| folder | role in the suite | where it came from |
|---|---|---|
| `build_b_cdn/` | **PASS case** (`tj_2_pass_build`): the good build: a voxel cherry grove with pink blossom trees, stone lanterns, a pond and falling pink petals; buttons `#btn-rotate`, `#btn-time` (day / sunset), `#btn-petals`; files `index.html`, `css/style.css`, `js/main.js`, `js/world.js`, `js/petals.js`. three.js comes from a CDN importmap, so the QA browser needs network | the real session `rs_sakura_page_mwm8na741` (3 builders; its QA ended PASS) |
| `build_a_vendored/` | **HARD NEGATIVE** (`tj_3_hard_negative`): very close to good, but not: a voxel island with a pagoda, torii gate and cherry trees whose falling petals are oversized and dense, so they clutter the view. It loads, rotates and every button works, only LOOKING shows it. three.js is vendored (runs offline) | the real session `rs_sakura_page_mwm8na740` (4 builders) |

`tj_1_full_real` has no seed: every agent is real, the workspace starts empty.

Rules the three cases pin (found in real sessions, 2026-11-18):
- ONE builder for a page this size, and a builder is never told to record a video, take screenshots or run a browser;
- QA LOOKS at the scene (only the pictures it must judge, none of motion), judges the quality, flags a close-but-not build, and never gives it a clean PASS;
- QA is bounded: time, tool calls, ONE video, at most two pictures, no ffmpeg / sleep (`Case.audit`).
Run (real agents cost credits, by case id): `bun testrun/run.ts test_treejs_sakura tj_2_pass_build` from the orchestrator folder.
