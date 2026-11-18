---
audience: both
title: AgentDeck (Composio-style dashboard) phases
status: phase 1 of 4 · planned
---
# Phases · AgentDeck (Composio-style dashboard)
> phase 1 of 4 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Look and screens](#phase-1) | all 10 screens look right and every button works, on fake data | **planned** | F1-F11 | - |
| 2 | [Mock backend (SQLite)](#phase-2) | what you create stays after a restart | **planning** | F12 | 1 |
| 3 | [Live Playground and Logs](#phase-3) | a Playground run is a real stored row that Logs shows | **planning** | F13 | 2 |
| 4 | [Hardening](#phase-4) | phone width, audit, reference match | **planning** | F14 | 3 |

## Next up
**Look and screens** (planned): decide the reference (T00), then shell and theme, then the screens in two parallel groups.

---
<a id="phase-1"></a>
## Phase 1 · Look and screens · planned
**Goal:** all 10 screens look right and every button works, on fake data  
**Covers:** F1-F11  
**Needs:** -

| task | what | owner | needs |
|---|---|---|---|
| T00 | decide capture source (Q1); if you log in, re-capture the dashboard | lookup (one call) | - |
| T01 | run `proto_init` exactly as in the README (this makes the kit and the three screens files), then shell + light theme in `css/pages-part-1.css` | builder-1 | T00 |
| T02 | dark theme + toggle in Settings (`html[data-theme=dark]` tokens in `css/pages-part-3.css`, key `agentdeck-theme`) | builder-3 | T01 |
| T03 | Home, Toolkits | builder-1 | T01 |
| T04 | Auth Configs, Connected Accounts | builder-1 | T01 |
| T07 | Triggers | builder-2 | T01 |
| T08 | Playground (Run adds a row to `window.AgentDeck.executions`) | builder-2 | T01 |
| T09 | Logs (reads `window.AgentDeck.executions`) | builder-2 | T08 |
| T10 | Settings (all tabs incl. Appearance) | builder-3 | T02 |
| T11 | API Keys | builder-3 | T01 |
| T12 | Docs | builder-3 | T01 |

**Done when (you can check each one):**
- `proto_check` clean and every route loads with 0 console errors
- page background is rgb(252,252,252), primary button rgb(0,0,0), accent link #5753c6
- Settings > Appearance > Dark, reload: still dark
- Home: click tab '30 days', bars change; click Connect in step 2, you land on Connected Accounts
- Toolkits: type 'git', list filters; click first card, GitHub detail opens; 'zzz' shows the empty state
- Playground: pick GitHub + create issue, Run: response fills and Logs has a new top row
- Logs: filter Failed shows only failed rows; click a row opens detail
- every list has search or filter, an empty state and a row that opens detail; forms show `.field-error`; no button without a handler; no 'TODO' text

---
<a id="phase-2"></a>
## Phase 2 · Mock backend (SQLite) · planning
**Goal:** what you create stays after a restart  
**Covers:** F12  
**Needs:** 1

| task | what | owner | needs |
|---|---|---|---|
| P2-T01 | SQLite schema + seed from the data model (6 tables) | builder-3 | P1-T12 |
| P2-T02 | mock server routes: list/create/update/delete for toolkits, auth configs, accounts, triggers, keys | builder-3 | P2-T01 |
| P2-T03 | screens read and write through the server instead of in-file data | builder-1 | P2-T02 |

**Done when (you can check each one):**
- create an auth config, restart the server, reload: it is still there
- delete the SQLite file and restart: seed data comes back
- all screens still work (no console errors)

---
<a id="phase-3"></a>
## Phase 3 · Live Playground and Logs · planning
**Goal:** a Playground run is a real stored row that Logs shows  
**Covers:** F13  
**Needs:** 2

| task | what | owner | needs |
|---|---|---|---|
| P3-T01 | `POST /run`: mock a tool call, store an execution row (tool, account, status, ms, request, response) | builder-3 | P2-T02 |
| P3-T02 | Logs reads executions with search, status, toolkit and time filters; CSV export | builder-2 | P3-T01 |
| P3-T03 | end-to-end check: Run in Playground, row on top of Logs, still there after restart | qa-reviewer | P3-T02 |

**Done when (you can check each one):**
- Run in Playground: a new row is on top of Logs
- restart the server: the row is still there
- filter status = Failed and export CSV match what is shown

---
<a id="phase-4"></a>
## Phase 4 · Hardening · planning
**Goal:** phone width, audit, reference match  
**Covers:** F14  
**Needs:** 3

| task | what | owner | needs |
|---|---|---|---|
| P4-T01 | responsive 390 px, menu drawer | builder-1 | P1-T12 |
| P4-T02 | sweep: `proto_check`, `preview` all routes, `site_audit`, `ref_compare` | qa-reviewer | P4-T01 |

**Done when (you can check each one):**
- 390 px: no horizontal scroll, drawer works, all routes visited
- 0 console errors, no dead links
- `ref_compare` score is at least the value recorded after phase 1
- no file owned by two packages (`git diff --stat` matches the split)
