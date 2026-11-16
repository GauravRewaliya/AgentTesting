---
audience: both
title: AgentDeck phases (one phase, complete)
status: phase 1 of 1 · planned
---
# Phases · AgentDeck (one phase, complete)
> phase 1 of 1 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Look and screens](#phase-1) | all 10 screens look right and every button works, on fake data | **planned** | F1-F11 | - |

## Next up
**Look and screens** (planned): decide the reference (T00), then shell and theme, then the screens in two parallel groups. This is the whole build: there is no server, no database and no phone layout in it.

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
## Not in this build (later plans, do NOT build now)
Mock backend with a SQLite file, live Playground runs stored and shown in Logs, phone width (390 px) and the final audit. They are listed in the full plan; this build ends when the *Done when* list above passes.
