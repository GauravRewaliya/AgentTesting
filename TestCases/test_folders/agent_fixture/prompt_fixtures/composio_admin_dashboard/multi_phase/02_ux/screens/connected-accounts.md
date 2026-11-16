---
audience: both
title: Connected Accounts
status: planned
source: invented (login page only was captured)
---
# Connected Accounts · `#/connected-accounts` · planned
> The accounts agents act as, one per end user and app. · [all screens](../README.md) · [overview](../../README.md)

## Picture (rough sketch, click the menu inside it)
![sketch](../../wireframes/shell.html#connected-accounts)

## What you can do here
- List 10 accounts with status (Active, Expired, Pending)
- Connect a new account in a 2-step side panel
- Reconnect or disconnect from the detail page

## How it connects
- Comes from: [Auth Configs](auth-configs.md)
- Goes to: [Playground](playground.md), [Logs](logs.md)

## How you check it works
Connect an account: status moves to Pending. (full steps: [test plan](../../PHASES.md))

## Source of this screen
Invented from typical agent platforms: the real dashboard is behind a login and was not captured. To make it exact, answer Q1 in [pending](../../README.md#decisions-and-open-questions).

## Want a change?
Open this page in the viewer, press **Ask Claude**, and write what you want changed. Claude edits THIS file, so the git history of the page is the history of the decision.

<!-- dev -->
## Layout spec (builders read this)
Picture: none captured. Built from dashboard structure. A LIST: keep it a table.

1. Page header: h1 "Connected accounts"; p "Accounts your agents can use, one per end user and toolkit." Actions: [Connect account] btn-primary (opens ui-drawer).
2. Toolbar: search (user id, account id), select Toolkit, select Status (All / Active / Expired / Pending), `.spacer`, right: [Export CSV] btn-ghost (toast "Export started").
3. Table `.table-wrap` 10 rows: Account id (mono, "ca_8fK2…" truncated, copy on hover), User (name + muted user id), Toolkit (mark + name), Status (`ui-badge`: Active green / Expired warning / Pending info), Last used (muted relative: "2 min ago"), Created (muted). Row click -> #/connected-accounts/<id>. Checkbox column is NOT needed.
4. Connect drawer (`ui-drawer` title "Connect account"): `.steps` 2 steps (Choose toolkit, Authorise). Step 1 `.form`: Toolkit select, Auth config select (filters by toolkit), User id input (required, hint "Your own id for the end user"). Step 2: a card with the "Authorise" text and button [Open authorisation] btn-primary (toast "Window opened" + status moves to Pending in table). Footer [Back] [Next].
5. Detail (#/connected-accounts/<id>):
   - header: user name, status badge, [Reconnect] btn-ghost, [Disconnect] btn-danger (confirm modal).
   - `.kv` card: Account id (mono), User id, Toolkit, Auth config (link -> #/auth-configs/<id>), Scopes count, Created.
   - card "Recent calls": table 5 rows (time, tool mono, status badge, duration num). Row -> #/logs.

Interactions: filters with counts; expired row shows [Reconnect] inline; drawer steps; disconnect confirm. Empty state: `ui-empty` "No connected accounts" text "Connect an account to let an agent run tools for a user." button [Connect account].

<!-- /dev -->
