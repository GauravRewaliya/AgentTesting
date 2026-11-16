---
audience: both
title: Toolkits
status: planned
source: invented (login page only was captured)
---
# Toolkits · `#/toolkits` · planned
> A catalog of the apps your agents can use. · [all screens](../README.md) · [overview](../../README.md)

## Picture (rough sketch, click the menu inside it)
![sketch](../../wireframes/shell.html#toolkits)

## What you can do here
- Browse 12 app cards (GitHub, Slack, Gmail ...)
- Search live and filter by category
- Open an app for its detail and Connect account

## How it connects
- Comes from: [Home](home.md)
- Goes to: [Auth Configs](auth-configs.md), [Connected Accounts](connected-accounts.md)

## How you check it works
Type "git": list filters. Click the first card: GitHub detail opens. Type "zzz": empty state. (full steps: [test plan](../../PHASES.md))

## Source of this screen
Invented from typical agent platforms: the real dashboard is behind a login and was not captured. To make it exact, answer Q1 in [pending](../../README.md#decisions-and-open-questions).

## Want a change?
Open this page in the viewer, press **Ask Claude**, and write what you want changed. Claude edits THIS file, so the git history of the page is the history of the decision.

<!-- dev -->
## Layout spec (builders read this)
Picture: none captured. Built from dashboard structure. A catalog: keep it a GRID of app cards (it is a catalog, not a list).

1. Page header: h1 "Toolkits"; p "Apps your agents can act in. Connect an account to start." Actions: [Request a toolkit] btn-ghost (modal with name + use case, toast).
2. Toolbar: search input (260px, filters cards live by name and description), `.chip` category tabs row above: All (48), Developer (12), Communication (9), Productivity (11), Sales (6), Data (7). Chip active = black bg. Right: select "Sort: Popular / A-Z / Recently added".
3. Catalog grid: `.card-grid` (min 240px), 12 cards from mock data. Each card 160px high:
   - top row: 32px app mark (letter in a square) + right `.badge-neutral` "OAuth 2" or "API key"
   - name 14px 600; 2-line description muted 13px
   - footer row: "Actions 24" mono muted left; "Connected 318" right
   - whole card clickable -> #/toolkits/<slug>; hover border accent.
   Mock: GitHub, Slack, Gmail, Notion, Linear, Google Sheets, HubSpot, Jira, Salesforce, Stripe, Google Calendar, Dropbox.
4. Empty state (when search has no hits): `ui-empty` title "No toolkits match" text "Try another word or clear the category." button [Clear filters].
5. Detail view (#/toolkits/<slug>, same screen, branch on $route.parts[1]):
   - page header with app mark, name, category badge, [Connect account] btn-primary (opens ui-drawer: pick auth config, toast).
   - `.tabs`: Overview / Actions / Triggers / Auth.
   - Overview: 2-column: left card "About" (2 short paragraphs, original copy), right card `.kv` (Auth: OAuth 2; Scopes: 6; Version: 3.2.0; Maintained by: AgentDeck).
   - Actions tab: `.table-wrap` 8 rows: Action name (mono, e.g. GITHUB_CREATE_ISSUE), description, Calls 24h (num). Row click -> small drawer with input schema `.code` JSON.
   - Triggers tab: 3 rows (name, type "webhook", status badge).
   - Back link "All toolkits" -> #/toolkits.

Interactions: category chip sets filter; search debounced 150ms; detail tabs; drawer open/close. Animation: cards fade-up 120ms stagger 20ms once.

<!-- /dev -->
