---
audience: both
title: Triggers
status: planned
source: invented (login page only was captured)
---
# Triggers · `#/triggers` · planned
> Run an agent when something happens in an app. · [all screens](../README.md) · [overview](../../README.md)

## Picture (rough sketch, click the menu inside it)
![sketch](../../wireframes/shell.html#triggers)

## What you can do here
- Switch triggers on or off in the list
- Create a trigger (event, account, JSON filter)
- See recent events and replay one

## How it connects
- Comes from: [Connected Accounts](connected-accounts.md)
- Goes to: [Logs](logs.md)

## How you check it works
Toggle a trigger: toast "Trigger paused". Type bad JSON in the filter: error shows. (full steps: [test plan](../../PHASES.md))

## Source of this screen
Invented from typical agent platforms: the real dashboard is behind a login and was not captured. To make it exact, answer Q1 in [pending](../../README.md#decisions-and-open-questions).

## Want a change?
Open this page in the viewer, press **Ask Claude**, and write what you want changed. Claude edits THIS file, so the git history of the page is the history of the decision.

<!-- dev -->
## Layout spec (builders read this)
Picture: none captured. Built from dashboard structure. A LIST: keep it a table.

1. Page header: h1 "Triggers"; p "Run an agent when something happens in a connected app." Actions: [Create trigger] btn-primary.
2. Toolbar: search (name, event), select Toolkit, select Status (Enabled / Paused). Right: count "7 triggers".
3. Table `.table-wrap` 7 rows: Name (600), Event (mono, e.g. GITHUB_PULL_REQUEST_OPENED), Account (muted), Status = `.switch` toggle (on/off, toast "Trigger paused"), Deliveries 24h (num), Last event (muted relative). Row click -> #/triggers/<id>.
4. Create modal (`ui-modal` "Create trigger", wide 640px): `.form`: Connected account select (required), Event select (filters by account's toolkit), Name input (required), Filter textarea (optional, JSON, mono, validated: `.field-error` "Filter must be valid JSON"), delivery URL readonly with copy. Footer [Cancel] [Create].
5. Detail (#/triggers/<id>):
   - header: name, status switch, [Delete] btn-danger.
   - grid-2: card "Configuration" `.kv` (event, account link -> #/connected-accounts/<id>, filter, created); card "Health" 2 `.stat` (Deliveries 24h 412; Failures 24h 3, delta up/down).
   - card "Recent events": table 6 rows (time, event id mono, result badge Delivered / Retried / Failed, response ms num). Row click opens ui-drawer with payload `.code` JSON (pretty, 14 lines) and a [Replay] btn-ghost (toast).

Interactions: switch toggles state; filter by status; drawer for payload; empty state `ui-empty` "No triggers yet" + [Create trigger].

<!-- /dev -->
