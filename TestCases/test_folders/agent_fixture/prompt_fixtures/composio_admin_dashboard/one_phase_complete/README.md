---
audience: both
title: AgentDeck (Composio-style dashboard)
status: phase 1 of 1 · planned
---
# AgentDeck (Composio-style dashboard) · phase 1 of 1 · planned
> An admin dashboard where a developer connects tools (GitHub, Slack, ...) to AI agents. Looks like the Composio dashboard, renamed AgentDeck.

> **This plan is ready to build.** File and folder names below are the layout of the new app; nothing here depends on any other project's files. Build from this plan alone.

> **Builders:** the build recipe and file owners are in the grey DEV block at the end of this file (switch the viewer to Builder). Everyone else can stop reading at *Share and change*.

| who reads | what | where |
|---|---|---|
| **Audience (users)** | You and your team, to review the screens before building; builders, who work from the same pages. | this page: What is it, What you get, Look, Motion |
| **Stakeholders** | decide scope, answer questions | Decisions and open questions, Phases at a glance |
| **Builders (dev)** | stack: Vue 3 from a CDN, no build; pnpm only (a Bun + SQLite mock server belongs to later plans, not this build) | `PHASES.md` and the grey DEV blocks (switch to Dev) |

## What is it
Ten screens with a left menu: set up apps (Toolkits, Auth Configs, Connected Accounts), use them (Triggers, Playground, Logs), and manage (Settings, API Keys, Docs). Light and dark theme, working buttons. First it runs on fake data; then it gets a small mock server with a SQLite file so what you create stays after a restart; then Playground runs are really stored and shown in Logs.

**For:** You and your team, to review the screens before building; builders, who work from the same pages.

## Picture (rough sketch)
![sketch](wireframes/shell.html)

## What you get (feature catalog)
| id | feature | what you see or do | phase | status |
|---|---|---|---|---|
| F1 | Shell and menu | left menu with 10 routes, top bar, active route highlighted | [1. Look and screens](PHASES.md) | planned |
| F2 | Light and dark | #fcfcfc light with black buttons and lavender accent; dark choice kept after reload | [1. Look and screens](PHASES.md) | planned |
| F3 | Home | stats + quickstart | [1. Look and screens](PHASES.md) | planned |
| F4 | Toolkits | 12 app cards, search, categories | [1. Look and screens](PHASES.md) | planned |
| F5 | Auth Configs | list, create, detail | [1. Look and screens](PHASES.md) | planned |
| F6 | Connected Accounts | list, connect drawer, reconnect | [1. Look and screens](PHASES.md) | planned |
| F7 | Triggers | switches, create, events | [1. Look and screens](PHASES.md) | planned |
| F8 | Settings | tabs incl. appearance | [1. Look and screens](PHASES.md) | planned |
| F9 | API Keys | create, copy once, revoke | [1. Look and screens](PHASES.md) | planned |
| F10 | Docs | reading page | [1. Look and screens](PHASES.md) | planned |
| F11 | Playground and Logs screens | Run shows a fake response and adds a Logs row | [1. Look and screens](PHASES.md) | planned |
| F12 | Things stay after restart | what you create is saved in a SQLite file by a small mock server | later, not in this build | - |
| F13 | Real stored runs | Playground Run is stored; Logs filters and exports real rows | later, not in this build | - |
| F14 | Phone width | works at 390 px; menu becomes a drawer | later, not in this build | - |

## Parts and how they connect
```mermaid
flowchart LR
  subgraph Shell[Shell: always visible]
    SB[Left menu, 10 routes] --- TB[Top bar + theme]
  end
  HM[Home] --> TK[Toolkits] --> AC[Auth Configs] --> CA[Connected Accounts]
  CA --> PG[Playground] --> LG[Logs]
  CA --> TR[Triggers]
  ST[Settings] --- AK[API Keys] --- DC[Docs]
  Shell --- HM
  subgraph Later[Phase 2-3]
    API[Mock server] --> DB[(SQLite file)]
  end
  AC -.saved by.-> API
  PG -.run stored by.-> API
  API -.read by.-> LG
```

## Screens
| screen | what it does | page |
|---|---|---|
| Home | 4 stats, 3-step quickstart with code sample | [home](02_ux/screens/home.md) |
| Toolkits | 12 app cards, search, category filter, detail | [toolkits](02_ux/screens/toolkits.md) |
| Auth Configs | how sign-in works per app; create; detail | [auth-configs](02_ux/screens/auth-configs.md) |
| Connected Accounts | accounts per end user; connect in 2 steps; reconnect | [connected-accounts](02_ux/screens/connected-accounts.md) |
| Triggers | on/off switches, create, recent events, replay | [triggers](02_ux/screens/triggers.md) |
| Playground | pick a tool, edit JSON, Run, see the response | [playground](02_ux/screens/playground.md) |
| Logs | every run, newest first; search, filter, export | [logs](02_ux/screens/logs.md) |
| Settings | profile, workspace, members, appearance (dark mode) | [settings](02_ux/screens/settings.md) |
| API Keys | create (shown once), copy, revoke | [api-keys](02_ux/screens/api-keys.md) |
| Docs | 3-column reading page with quickstart and errors | [docs](02_ux/screens/docs.md) |

## Typical walk-through
Home → Create auth config → Connect account → Playground (Run) → Logs (see the run).

Look and feel: [theme](02_ux/theme.md) · animations: [motion](02_ux/motion.md) · all routes in one table: [UX index](02_ux/README.md).

## Look and feel
- **Light (default):** page `#fcfcfc`, black buttons (white text), lavender accent `#b1a9ff` / `#5753c6` for links and highlights. **Dark:** background `#000`, surface `#191919` (set in Settings > Appearance, kept after reload). Code and ids in **IBM Plex Mono**.
- **Shell:** left menu with 10 routes and an active highlight, top bar with the theme switch. Cards, tables, badges, modals, drawers and toasts come from the shared kit (`css/kit.css`, `js/kit.js`), nobody edits them.
- Full tokens, type scale, spacing and component list: [theme](02_ux/theme.md). The look comes from the real login page only; screens are invented in the same style.

## Motion and animation
| where | animation | time |
|---|---|---|
| buttons, nav items, rows | colour fade on hover | 120 ms |
| modal / drawer | fade + 8 px slide up / slide in from right | 160 ms |
| toast | slides in bottom-right, hides after 3 s | 160 ms |
| Home stats and bars | numbers count up once; bars grow from 0 | 600 ms / 300 ms |
| theme switch | colours cross-fade | 150 ms |
| `prefers-reduced-motion` | turns all of it off | rule |

No looping or decorative animation. Source: invented (the capture found none); full list: [motion](02_ux/motion.md). Real motion can replace it if you supply a logged-in capture (Q2).

## Team: who does what
| who | does | tasks |
|---|---|---|
| lookup (one call) | reads the reference and writes the briefs | T00 |
| builder-1 | writes `part-1` (Home, Toolkits, Auth Configs, Connected Accounts) and the shell + light theme; its own files only | T01, T03-T06 |
| builder-2 | writes `part-2` (Triggers, Playground, Logs) and `window.AgentDeck.executions`; its own files only | T07-T09 |
| builder-3 | writes `part-3` (Settings, API Keys, Docs) and the dark theme + toggle; its own files only | T02, T10-T12 |
| qa-reviewer | checks every phase in a real browser or build; writes pass/fail, never builds | T03, T02 |

You (the owner) answer the open questions and judge each phase; Claude edits this plan when you ask (see Share and change).

## Quality bar (what 'professional' means here)
- Every list has search or filter, an empty state and a row that opens a detail view; every button acts (no 'TODO', no 'coming soon')
- Forms validate and show a field error
- Light and dark both pass text contrast 4.5:1
- Works at 390 px (menu becomes a drawer); no horizontal scroll
- 0 console errors on every route; no file owned by two builders
- Honest labels: invented screens are marked invented

## Real or guessed
**Real (from you / the capture):** colours #fcfcfc, black buttons, lavender #b1a9ff / #5753c6, IBM Plex Mono, dark toggle, the name AgentDeck, the list of 10 screens. **Guessed:** everything inside the 10 screens: the capture only saw the login page (the dashboard is behind a login). No Composio logo, text or font files are copied.

## Decisions and open questions
| id | what | answer / default | state |
|---|---|---|---|
| Q1 | How to fill the 10 screens? (a) I invent them from typical agent platforms, (b) you log in once in the connected browser and I capture the real dashboard, (c) you drop screenshots in `ref_notes/` | (a) | open |
| Q2 | Animations: keep the small invented set (`02_ux/motion.md`) or send the real ones? | keep | open |
| D-01 | Name | AgentDeck, original copy, no Composio logo or text | agreed |
| D-02 | Mock data lives inside each screen file in phase 1 | no shared `data.js`; only `window.AgentDeck.executions` is shared | agreed |
| D-03 | a screens file holds 8 screens | split into `main_a/main_b` if it passes 600 lines | open |
| D-04 | Phase 2 backend | Bun + `bun:sqlite`, one file `agentdeck.sqlite`, no auth, seeded from the data model | proposed |

## Phases at a glance
**1. Look and screens** (planned) → [full phase page](PHASES.md)

## Share and change
- **Share:** press *Copy link* in the plan viewer; one link = one page.
- **Change something:** press *Ask Claude* on the page and write your wish. Claude edits THIS file (and the phase page if scope moves), so `git diff docs/` shows what the plan changed.
- Status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done.

<!-- dev -->
## Build recipe
1. **Read in this order:** this README, `PHASES.md`, `build_inputs/01_requirements_data_flow_tests.md` (requirements, data model, code flow, tests, file owners), `02_ux/README.md`, `02_ux/theme.md`, `02_ux/motion.md`, then the screen pages in `02_ux/screens/`.
2. **Where it is built:** `run_test/agentdeck/` (brand AgentDeck).
3. **Start from the kit:** run the harness tool exactly as `proto_init --dir run_test/agentdeck --title "AgentDeck" --accent "#5753c6" --nav '[{"label":"Home","file":"part-1"},{"label":"Toolkits","file":"part-1"},{"label":"Auth Configs","file":"part-1"},{"label":"Connected Accounts","file":"part-1"},{"label":"Triggers","file":"part-2"},{"label":"Playground","file":"part-2"},{"label":"Logs","file":"part-2"},{"label":"Settings","file":"part-3"},{"label":"API Keys","file":"part-3"},{"label":"Docs","file":"part-3"}]'` (a no-build Vue 3 prototype: `index.html`, `css/kit.css`, `js/kit.js`, the 10 routes). The nav text FIXES the file names and the split below; never edit the kit files.
4. **Build only the phase you are asked for.** Phase 1 = look and screens on FAKE data (no server, no SQLite: those are phases 2-3).
5. **Three builders in parallel, one per screens file** (groups below); each edits ONLY its own two files. Do not give one builder many screens: the lead stops waiting after three waits on the same builder.

**File groups (fixed by the nav above, so the work splits evenly):**
| file | owner | screens | also owns |
|---|---|---|---|
| `js/screens/part-1.js` + `css/pages-part-1.css` | builder-1 | Home, Toolkits, Auth Configs, Connected Accounts | the shell and the LIGHT theme overrides (`#fcfcfc`, black buttons, lavender accent) |
| `js/screens/part-2.js` + `css/pages-part-2.css` | builder-2 | Triggers, Playground, Logs | `window.AgentDeck.executions` (Playground writes a row, Logs reads it: both in this file) |
| `js/screens/part-3.js` + `css/pages-part-3.css` | builder-3 | Settings, API Keys, Docs | the DARK theme (`html[data-theme=dark]` tokens, toggle in Settings > Appearance, `localStorage` key `agentdeck-theme`, applied at load) |

6. **Verify** with `proto_check` and the preview, then the *Done when* list of the phase.
7. **Do not invent** screens, files or features the plan does not name. The real dashboard was not captured (only its login page): screens are invented in the plan's style and marked so.
8. **This plan IS the planning.** Do not write a new plan, a separate wireframe or placeholder screens. Each builder delivers its screens FINISHED in one pass: fake data, the theme (light and dark) and the interactions in the screen pages.
9. **Builders self-check before reporting:** `node --check` on their file, the kit's `proto_check`, and every route and link exists in `PROTO.md`. They report any difference from the screen pages.
10. **The lead verifies before it claims.** Run `proto_check` and the preview, open every route, read EVERY builder report, and state only what the checks and reports show. List every deviation from the plan. If a check could not be run, say so.

**Moved out of this page:** requirements (EARS), the mock data model, code flow, the original test plan and the file-owner table are in `build_inputs/01_requirements_data_flow_tests.md`.
<!-- /dev -->

research: none (the real dashboard was not captured, only its login page, see ref_notes/capture_facts.md; every screen is invented in the plan's style and marked so)
