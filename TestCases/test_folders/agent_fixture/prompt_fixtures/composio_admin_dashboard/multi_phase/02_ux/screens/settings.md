---
audience: both
title: Settings
status: planned
source: invented (login page only was captured)
---
# Settings · `#/settings` · planned
> Profile, workspace, members and how the dashboard looks. · [all screens](../README.md) · [overview](../../README.md)

## Picture (rough sketch, click the menu inside it)
![sketch](../../wireframes/shell.html#settings)

## What you can do here
- Edit profile and workspace (saves with a toast)
- Invite and remove members
- Appearance: Light, Dark or System; the choice is kept after reload

## How it connects
- Comes from: (menu)
- Goes to: (none)

## How you check it works
Settings > Appearance > Dark, reload: still dark. (full steps: [test plan](../../PHASES.md))

## Source of this screen
Invented from typical agent platforms: the real dashboard is behind a login and was not captured. To make it exact, answer Q1 in [pending](../../README.md#decisions-and-open-questions).

## Want a change?
Open this page in the viewer, press **Ask Claude**, and write what you want changed. Claude edits THIS file, so the git history of the page is the history of the decision.

<!-- dev -->
## Layout spec (builders read this)
Picture: none captured. Built from dashboard structure. Forms in tabs.

1. Page header: h1 "Settings"; p "Workspace, people and how the dashboard looks." No actions.
2. `.tabs`: Profile / Workspace / Members / Appearance / Danger zone (tab switch, active accent underline).
3. Profile tab: card "Profile", `.form` grid-2: First name, Last name (prefilled "Alex", "Morgan"), Email (readonly, muted hint "Change in your login provider"), Role select (Admin / Developer / Viewer). Card footer `.form-actions` [Save changes] btn-primary; validation on blur (`.field-error`), toast "Profile saved".
4. Workspace tab: card "Workspace": Name input (prefilled "Acme Inc."), Slug input in mono (acme-inc, validated a-z 0-9 -), Default region select. Save.
5. Members tab: header with [Invite member] btn-primary (ui-modal: email, role; validation). `.table-wrap` 5 rows: Name, Email (muted), Role select inline, Status badge (Active / Invited), row action [Remove] btn-ghost (confirm).
6. Appearance tab: card "Theme" with 3 option tiles (Light / Dark / System, each 96x64 mini preview, selected = accent border). Choosing sets `html[data-theme]` and localStorage `agentdeck-theme` instantly. Below: card "Density" switch "Compact tables" (`.switch`), toast.
7. Danger zone tab: card with border danger-weak: "Delete workspace" text + [Delete workspace] btn-danger -> ui-modal, user types the workspace name to enable the button.

Interactions: tabs keep state; Save buttons disabled while nothing changed; theme tiles preview instantly. Empty states: none.

<!-- /dev -->
