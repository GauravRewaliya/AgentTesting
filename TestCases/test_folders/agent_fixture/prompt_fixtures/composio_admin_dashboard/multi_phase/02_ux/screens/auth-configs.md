---
audience: both
title: Auth Configs
status: planned
source: invented (login page only was captured)
---
# Auth Configs · `#/auth-configs` · planned
> How AgentDeck signs in to each app for you. · [all screens](../README.md) · [overview](../../README.md)

## Picture (rough sketch, click the menu inside it)
![sketch](../../wireframes/shell.html#auth-configs)

## What you can do here
- List 9 configs, filter by app and sign-in type
- Create one in a pop-up (checks the form)
- Open one: settings, connections, scopes, disable or delete

## How it connects
- Comes from: [Toolkits](toolkits.md), [Home](home.md)
- Goes to: [Connected Accounts](connected-accounts.md)

## How you check it works
Create an auth config: it appears at the top with a toast. (full steps: [test plan](../../PHASES.md))

## Source of this screen
Invented from typical agent platforms: the real dashboard is behind a login and was not captured. To make it exact, answer Q1 in [pending](../../README.md#decisions-and-open-questions).

## Want a change?
Open this page in the viewer, press **Ask Claude**, and write what you want changed. Claude edits THIS file, so the git history of the page is the history of the decision.

<!-- dev -->
## Layout spec (builders read this)
Picture: none captured. Built from dashboard structure. A LIST: keep it a table.

1. Page header: h1 "Auth configs"; p "How AgentDeck signs in to each toolkit on your behalf." Actions: [Create auth config] btn-primary (opens modal).
2. Toolbar: search (name or toolkit), select Toolkit (all + 6), select Scheme (All / OAuth 2 / API key / Bearer), right: tabs-like counter "9 configs".
3. Table `.table-wrap` 9 rows, columns: Name (600, with toolkit mark), Toolkit (muted), Scheme (`.badge-neutral`), Status (`ui-badge`: Active / Disabled), Connections (num), Created (muted, "Oct 2, 2026"). Row click -> #/auth-configs/<id>. Pagination footer (`.pagination`, "1-9 of 9").
4. Create modal (`ui-modal` title "Create auth config"):
   - `.form`: Toolkit select (required); Scheme select (OAuth 2 / API key); name input (required, 3-40 chars, `.field-error`); for OAuth 2: Client ID + Client secret (password-style, masked), Scopes textarea with hint "One scope per line". For API key: nothing extra, hint "Keys are added per connected account".
   - footer: [Cancel] btn-ghost, [Create] btn-primary (disabled until valid). On create: toast "Auth config created", row appears at top.
5. Detail (#/auth-configs/<id>): header with name + status badge + [Disable] btn-ghost + [Delete] btn-danger (confirm modal, requires typing the name).
   - grid-2: card "Settings" `.kv` (Toolkit, Scheme, Redirect URL in mono with copy button, Created); card "Connections" stat (`.stat` 318 active) + mini table of 5 accounts -> #/connected-accounts/<id>.
   - card "Scopes" `.chip` list (6 chips).

Interactions: row click; search; scheme filter; disable switch with toast; copy redirect URL toast. Empty state: `ui-empty` "No auth configs yet" + [Create auth config].

<!-- /dev -->
