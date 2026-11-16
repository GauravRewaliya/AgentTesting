---
audience: both
title: Plan index and scores
status: 10 plans · all planned (built once in a real run: pp_site, pp_composio)
---
# Index · plans with expected quality
> Two plans have been built for real (rank 1 and 2 below); the others are ready but not built yet. The scores in the table at the bottom are **predictions of the final output** from reading the plan, until a build is judged.

## Readiness (checked with the free `team plan_lint`, 0 errors on every plan below except the NES draft; no plan mentions any zip or other project's files)
A plan is **ready** when a builder can build it from the plan folder alone: README with a Build recipe, PHASES with tasks (owners, `needs` by task id) and browser-checkable Done-when lists, a contract / build inputs, `CONTEXT.txt`, honest provenance (`research:` line or sources), and README under about 12 KB (details in `build_inputs/`).

| rank | plan | state | why |
|---|---|---|---|
| 1 | `site_clone_pingharbor/one_phase_complete` | **built and proven** | pp_site: 4.2 min, $1.23, audit 98 on the first pass |
| 2 | `composio_admin_dashboard/one_phase_complete` | **built and proven** | pp_composio: 3.9 min, $1.46, every Done-when item checked by hand |
| 3 | `creative_browser_templates` | ready, not built | five standalone sub-projects, five parallel builders sharing no files, no build step: the cheapest and most parallel plan |
| 4 | `aistudio_eiffel_tower_3d` | **built once** | pp_eiffel: PASS, 26.6 min, $2.28 (two stalls, now fixed); builds, types, content and a real WebGL render checked by hand; 3 phases, 10 tasks |
| 5 | `wavelet_spotify_clone`, `linear_tab_bar`, `enzo_clerk_toast` | ready, not built | flat plans with tasks and checks; `linear_tab_bar` and `enzo_clerk_toast` target a phone app, so a web build only shows the Vue web stand-in (`native-only` rows stay unbuilt) |
| 6 | `aistudio_pocket_world_terrarium`, `aistudio_clockwork_sanctum`, `aistudio_research_visualization` | ready, not built | large 3D / game plans (13 to 17 KB contracts); polish cannot be judged headless |
| 7 | `aistudio_nes_midi_gen` | **draft, not ready (3/10)** | the complex one, needed; to be rebuilt as an 8/10 plan from the NES engine source: TODO 7.a |
| - | `_parked/` (`aistudio_info_genius`, `aistudio_image_to_voxel`, `aistudio_personalized_comics`) | parked | need a live AI model or image generation |

Known advice left (lint warnings, not errors): some Done-when lists have fewer than 4 checks, a few checks have no number or route, `research: none` on reverse-planned plans (their evidence is the original app, not web research), the big 3D plans have 13 to 17 KB contracts.


| plan (files) | ref: original | expected quality | tested quality score |
|---|---|---|---|
| [composio_admin_dashboard](composio_admin_dashboard/multi_phase/README.md) · PHASES · tasks.json · wireframes · EARS · data model | _later_ | **8/10**: 14 features, 10 screens, data model, code flow, test plan; best-specified plan | pending |
| [wavelet_spotify_clone](wavelet_spotify_clone/README.md) · PHASES · tasks.json · wireframes | _later_ | **8/10**: 11 features, test ids, behaviour rules per row, made-up content list; risk: audio feel | pending |
| [linear_tab_bar](linear_tab_bar/README.md) · PHASES · tasks.json · wireframes | _later_ | **8/10**: gesture rules, known issues, not-included list, real commit history; 6 phases | pending |
| [creative_browser_templates](creative_browser_templates/README.md) · PHASES · tasks.json | _later_ | **7/10**: 5 demos with control table (each row a test); long, reference demos already work | pending |
| [site_clone_pingharbor](site_clone_pingharbor/multi_phase/README.md) · PHASES · build_inputs | _later_ | **7/10**: reference capture first, design system, briefs; earlier run stopped at audit 72 (contrast, tap targets) | pending |
| [enzo_clerk_toast](enzo_clerk_toast/README.md) · PHASES · tasks.json | _later_ | **6/10**: see score below | pending |
| [aistudio_pocket_world_terrarium](aistudio_pocket_world_terrarium/README.md) · PHASES | _later_ | **7/10**: richest motion section (24 things, orb), 4 phases; risk: 3D polish | pending |
| [aistudio_eiffel_tower_3d](aistudio_eiffel_tower_3d/README.md) · PHASES | _later_ | **7/10**: 12-stop tour, EN/FR, build spec; risk: 3D model quality | pending |
| [aistudio_clockwork_sanctum](aistudio_clockwork_sanctum/README.md) · PHASES | _later_ | **6/10**: clear game loop, little motion detail; game feel untested | pending |
| [aistudio_research_visualization](aistudio_research_visualization/README.md) · PHASES | _later_ | **6/10**: 7 features, science content must be right | pending |

Method notes (not plans; they live in docs/planning/): [RESEARCH](../../../../docs/planning/RESEARCH.md) · [vue_web_targets](../../../../docs/planning/vue_web_targets.md)

## Score: enzo_clerk_toast (predicted final output) = 6/10
| part | score | why |
|---|---|---|
| Animation intent | 7 | right rules: springs only, no timing curves, one haptic per press, 20 rapid calls with no jump |
| Animation numbers | 3 | no spring stiffness/damping, offsets, scales or durations; "constants.ts: open question" |
| Visual look | 4 | "blurred gradient, soft shadows" only; no colours, sizes, radius, text styles, no wireframe |
| Feature coverage | 7 | 7 features cover show, stack, expand, haptics, load, status bar, upgrade |
| Checkability | 7 | video of 20 calls, haptic once; no frame/number threshold |
| Plan consistency | 5 | `tasks.json` lacks T04, T07, T08 and points to a `00_brief.md` that is not in the folder; phase page says T04 exists |
| Honesty | 9 | says clearly the cause of "unstable" is not known |

**Verdict:** good skeleton, poor on what makes a toast feel good. A builder would produce a working stack, but the spring feel and look would be generic. Not "all info and animation" yet.
**To reach 8:** record the real spring numbers and offsets per stack size (1, 3, 5), colours and sizes from the reference, a wireframe of collapsed vs expanded, fix `tasks.json` and add `00_brief.md`.

Parked in `_parked/` (not scored): aistudio_info_genius, aistudio_image_to_voxel, aistudio_personalized_comics (need a live AI).

**Draft, needed (the complex one):** `aistudio_nes_midi_gen` is **3/10** (a draft from the app name only: no look, no stack, one task). It must reach **8/10**; the work is written down as TODO 7.a; a second NES plan, the jsnes PLAYER (open .nes, controller options, speed, local save states with import/export, ROM -> states tree), is TODO 7.d in `TestCases/test_folders/TODO.md` for another agent.
