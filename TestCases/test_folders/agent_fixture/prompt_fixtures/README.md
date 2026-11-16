---
audience: both
title: Plan catalog
status: 15 plans
---
# Plan catalog: how every plan looks
> **These are plans, not products.** Each plan stands alone: everything a builder needs is in its folder (README, PHASES, `build_inputs/`, `CONTEXT.txt`); no plan refers to any other project's files. Cases in `TestCases/test_folders/test_prompt_planning/` give a plan to the lead and judge the build. Open any plan in the plan viewer (`docs/dev_exp/plan_viewer/`).

## The plans
| plan | what it is | status |
|---|---|---|
| [AgentDeck (Composio-style dashboard)](composio_admin_dashboard/multi_phase/README.md) | admin dashboard, 10 screens, then SQLite mock backend | phase 1 of 4 · planned |
| [Wavelet (music player)](wavelet_spotify_clone/README.md) | Spotify-desktop-like web player, own colours, generated covers and sounds | phase 1 of 4 · planned |
| [Stacked toast](enzo_clerk_toast/README.md) | springy stacked pop-ups for a phone app | phase 1 of 4 · planned |
| [Five creative demos](creative_browser_templates/README.md) | 3D scene, action game, granular synth, feel tuner, sound-reactive world | phase 1 of 2 · planned |
| [Linear-style tab bar](linear_tab_bar/README.md) | glass pill tab bar with gesture rules | phase 1 of 6 · planned |
| [Eiffel Tower 3D](aistudio_eiffel_tower_3d/README.md) | museum-style 3D exhibit, 12-stop tour, EN/FR | phase 1 of 3 · planned |
| [Pocket World Terrarium](aistudio_pocket_world_terrarium/README.md) | place 24 things on a tiny planet in a glass orb | phase 1 of 4 · planned |
| [Clockwork Sanctum](aistudio_clockwork_sanctum/README.md) | sunbeam puzzle-chase on 4 sky islands | phase 1 of 4 · planned |
| [Research Visualization](aistudio_research_visualization/README.md) | science visualisation with 3D and charts | phase 1 of 3 · planned |
| [NES MIDI Gen](aistudio_nes_midi_gen/README.md) | chiptune generator (2 pulse, triangle, noise) with .mid export; **DRAFT 3/10, needed because it is the complex one: TODO 7.a** | draft, not ready |
| [NES Player (jsnes)](nes_player_jsnes/README.md) | browser NES player around the jsnes library: speed, controllers, save states as a tree per ROM with export and import | phase 1 of 3 · planned |
| [PingHarbor (site clone)](site_clone_pingharbor/multi_phase/README.md) | clone of a real website, 5 pages | phase 1 of 5 · planned |

**Parked** (`_parked/`, not buildable to a verifiable result today): `aistudio_info_genius`, `aistudio_image_to_voxel`, `aistudio_personalized_comics` (they need a live AI model or image generation; a mocked build can only check the screens).

## The one format (so you always know where to look)
**README.md:** what is it · for whom · picture · **feature catalog** (id, feature, what you see, phase, status) · parts and how they connect · real or guessed · decisions and open questions · how to share and change. Builder detail sits in grey **DEV** blocks (toggle User / Dev).
**PHASES.md:** one table (phase, goal, status, covers, needs), then **Next up**, then per phase: tasks (owner, needs) and **Done when** (things a person can check).

**Status words:** `planning` (being written or missing facts) · `planned` (split into tasks, **nothing built yet**: where every plan is today) · `in progress` · `review` · `done`. `site_clone_pingharbor` is planned like the rest; its earlier test run is kept only as evidence.

## How it stays one source of truth
- The plan is the files in this folder. To see how the plan moved, read `git log -p TestCases/test_folders/agent_fixture/prompt_fixtures/<plan>/`.
- To move a phase forward: change its status in `PHASES.md` and the matching `status:` line at the top of the plan's `README.md`; if scope changes, update the feature catalog row (its phase column) and the next phase's *Next up* text.
- When a project is in the middle, read `PHASES.md` first: it says what is done, what is next and what each phase must prove.
- `tasks.json` (where present) is what the build harness reads; it follows the phases and is never the place to explain anything.

## Also here (method, not plans)
[RESEARCH](../../../../docs/planning/RESEARCH.md) · [vue_web_targets](../../../../docs/planning/vue_web_targets.md)
