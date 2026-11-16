---
audience: both
title: Home
status: planned
source: invented (login page only was captured)
---
# Home · `#/home` · planned
> The landing page: how you are doing and what to do next. · [all screens](../README.md) · [overview](../../README.md)

## Picture (rough sketch, click the menu inside it)
![sketch](../../wireframes/shell.html#home)

## What you can do here
- See 4 numbers: runs in 24h, active connections, auth configs, error rate
- Follow a 3-step quickstart with a copyable code sample
- Jump to Create auth config or Docs

## How it connects
- Comes from: (start page)
- Goes to: [Toolkits](toolkits.md), [Auth Configs](auth-configs.md), [Docs](docs.md)

## How you check it works
Click tab "30 days": bars change. Click "Connect" in step 2: you land on Connected Accounts. (full steps: [test plan](../../PHASES.md))

## Source of this screen
Invented from typical agent platforms: the real dashboard is behind a login and was not captured. To make it exact, answer Q1 in [pending](../../README.md#decisions-and-open-questions).

## Want a change?
Open this page in the viewer, press **Ask Claude**, and write what you want changed. Claude edits THIS file, so the git history of the page is the history of the decision.

<!-- dev -->
## Layout spec (builders read this)
Picture: none captured for dashboard (login only). Built from dashboard structure; see BRIEF.md for shell.

1. Page header: h1 "Home"; p "Connect tools to your agents and watch them run." Actions: [Create auth config] btn-primary, [Open docs] btn-ghost.
2. Quickstart card (full width). Header "Quickstart" + right link "Skip for now" (hides card, toast).
   - `.steps` 3 items: 1 "Create an auth config" (done), 2 "Connect an account" (active), 3 "Run a tool" (idle).
   - grid-2 below: left = `.code` block, 9 lines, Python: install line + 6-line snippet + comment; copy button top right (toast "Copied"). Right = 3 rows (label + badge + muted hint) matching steps.
3. Stats: grid-4 of `.stat` (complete cards):
   - Tool executions (24h): 12,482, delta +8.4% (up)
   - Active connections: 1,206, delta +32 this week (up)
   - Auth configs: 9, delta no change (muted)
   - Error rate: 0.8%, delta -0.2 pts (up = good)
   Count-up on mount.
4. Usage row: grid 2fr 1fr.
   - Left card "Tool calls": header with `.tabs` (7 days / 14 days / 30 days). Body `.bars` 14 columns, heights vary 30-100%, x labels under (Nov 1 ... Nov 13) as 12px muted row. Hover shows tooltip with count.
   - Right card "Top toolkits": 5 rows: toolkit letter badge (24px square, black or accent), name, count right-aligned mono, thin bar 4px accent under name. Rows: GitHub 3,914; Slack 2,706; Gmail 2,118; Notion 1,402; Linear 1,079.
5. Recent executions card: header "Recent executions" + link "View all logs" -> #/logs. `.table-wrap` 6 rows: Time (mono, "14:02:11"), Tool (mono), Account (muted), Status (`ui-badge`: Success / Failed / Running), Duration (num, "412 ms"). Row click -> #/logs.

Interactions: tabs swap data (7 / 14 / 30 bars); toolkit row click -> #/toolkits/github-style slug; quickstart step 2 button "Connect" -> #/connected-accounts.
Empty state: none (mock data always present).

<!-- /dev -->
