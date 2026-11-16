---
audience: both
title: API Keys
status: planned
source: invented (login page only was captured)
---
# API Keys · `#/api-keys` · planned
> Keys your code uses to call AgentDeck. · [all screens](../README.md) · [overview](../../README.md)

## Picture (rough sketch, click the menu inside it)
![sketch](../../wireframes/shell.html#api-keys)

## What you can do here
- Create a key (shown once), copy it, revoke it
- Filter by Live or Test
- Copy a ready cURL example

## How it connects
- Comes from: [Docs](docs.md)
- Goes to: [Docs](docs.md)

## How you check it works
Create a key: it is shown once with a copy button, then the row is added. (full steps: [test plan](../../PHASES.md))

## Source of this screen
Invented from typical agent platforms: the real dashboard is behind a login and was not captured. To make it exact, answer Q1 in [pending](../../README.md#decisions-and-open-questions).

## Want a change?
Open this page in the viewer, press **Ask Claude**, and write what you want changed. Claude edits THIS file, so the git history of the page is the history of the decision.

<!-- dev -->
## Layout spec (builders read this)
Picture: none captured. Built from dashboard structure. A LIST: keep it a table.

1. Page header: h1 "API keys"; p "Keys let your code call AgentDeck. Keep them secret." Actions: [Create API key] btn-primary.
2. Notice bar (card, accent-weak bg, 1 line): "Keys are shown once. Store them in a secret manager." with [Dismiss] btn-ghost (remembered in localStorage).
3. Toolbar: search (name or prefix), select Environment (All / Live / Test).
4. Table `.table-wrap` 5 rows: Name (600), Key (mono masked "ad_live_•••• 7Q2F" + copy icon button), Environment (`ui-badge`: Live = success, Test = info), Scopes (muted "tools:run, triggers:read"), Last used (muted relative), Created (muted), row action [Revoke] btn-danger btn-sm.
5. Create modal (`ui-modal` "Create API key"): `.form`: Name input (required, 3-40), Environment select (Live / Test), Scopes checkboxes in grid-2 (tools:run, tools:read, triggers:write, triggers:read, accounts:read). Footer [Cancel] [Create key].
6. Created state (same modal, step 2): mono key box `.code` with the full key, [Copy key] btn-primary (toast "Copied"), warning text "You will not see this key again." Footer [Done] closes and inserts row.
7. Revoke: `ui-modal` confirm "Revoke key 'Production backend'?" text "Requests with this key stop working at once." [Cancel] btn-ghost, [Revoke] btn-danger; row removed with toast.
8. Quick use card below table: `.code` cURL example with the header line `Authorization: Bearer <your key>` (placeholder, no real key), copy button.

Interactions: masked key reveal on row hover only shows last 4; empty state `ui-empty` "No API keys yet" + [Create API key].

<!-- /dev -->
