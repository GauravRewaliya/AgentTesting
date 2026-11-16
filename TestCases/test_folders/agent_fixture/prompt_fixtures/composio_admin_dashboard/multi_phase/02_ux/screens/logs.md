---
audience: both
title: Logs
status: planned
source: invented (login page only was captured)
---
# Logs · `#/logs` · planned
> Every tool run, newest first. · [all screens](../README.md) · [overview](../../README.md)

## Picture (rough sketch, click the menu inside it)
![sketch](../../wireframes/shell.html#logs)

## What you can do here
- Search and filter by status, app and time
- Open a row to see its request and response
- Export CSV

## How it connects
- Comes from: [Playground](playground.md)
- Goes to: [Connected Accounts](connected-accounts.md)

## How you check it works
Filter status = Failed: only failed rows. Click a row: detail opens. (full steps: [test plan](../../PHASES.md))

## Source of this screen
Invented from typical agent platforms: the real dashboard is behind a login and was not captured. To make it exact, answer Q1 in [pending](../../README.md#decisions-and-open-questions).

## Want a change?
Open this page in the viewer, press **Ask Claude**, and write what you want changed. Claude edits THIS file, so the git history of the page is the history of the decision.

<!-- dev -->
## Layout spec (builders read this)
Source: NOT CAPTURED. The reference holds only the sign-in page. Structure = typical dashboard tool-execution log table, NOT a picture. Palette: pictures/desktop-light-section-02.png and desktop-dark.png.

## Page frame
- Width: shell content, padding 24px. Background `--bg`. Single column.
- Table is a LIST: keep rows, never turn into cards.

## 1. Page header
- Left: h1 "Logs" + "Every tool execution across your connected accounts, newest first."
- Right: `btn-ghost` "Export CSV" (toast "Export started"), `btn` "Refresh" (reloads the mock list with a skeleton for 0.4s).

## 2. Filter bar (`.filter-bar`)
- Search box "Search by tool, request id or account" (flex 1, max 360px).
- Selects: "Status: All" (Success, Failed, Pending), "Toolkit: All" (GitHub, Gmail, Slack, Notion, Linear, HubSpot), "Time: Last 24 hours" (1h, 24h, 7d).
- Right: segmented `.tabs` "All | Failed" count badge on Failed (`.badge-danger` 3).
- Active filters: chips `.chip` with x, "Clear all" `btn-sm` ghost when any filter is set.

## 3. Summary strip (`.card-grid` of 3 `.stat`)
- `.stat` "Executions (24h)" value 1,284 delta up 6.2%.
- `.stat` "Success rate" value 98.4% delta up 0.3%.
- `.stat` "Median duration" value 412 ms delta down 18 ms (down = good, shown in green).

## 4. Log table (`.table-wrap > table.table`)
- Columns: Time (muted mono "14:32:08"), Tool (mono slug, e.g. SLACK_SEND_MESSAGE), Toolkit (small letter icon + name), Account (text), Status (`ui-badge`: Success green, Failed red, Pending amber), Duration (`th.num td.num`), Request id (mono muted, copy on hover).
- 12 rows on page 1, mock data across GITHUB_CREATE_ISSUE, GMAIL_SEND_EMAIL, SLACK_SEND_MESSAGE, NOTION_CREATE_PAGE, LINEAR_CREATE_ISSUE, HUBSPOT_CREATE_CONTACT; 3 Failed rows (401 expired token, 429 rate limited, 422 invalid input).
- Row click (`tr.row-link`) opens `ui-drawer` title "Execution" (see section 5).
- Sort: click the Time and Duration headers (arrow in header).
- `.pagination` bottom right: "Showing 1-12 of 1,284", prev/next, page size select 12/25/50.
- Empty state (when filters match nothing): `ui-empty` title "No executions match", text "Change the filters or the time range.", button "Clear filters".

## 5. Detail drawer (`ui-drawer`, width 560px)
- Header: tool slug (mono), `ui-badge` status, request id with copy button.
- `.kv` (dl): Account, Toolkit, Started, Duration, Attempts (1), Region.
- `.tabs`: Input (active) | Output | Error | Timeline.
- Input / Output: `.code` JSON block 10-14 lines, copy button.
- Error (failed rows only): `.card` tinted red with the error code and one-line message; link "Open connected accounts" -> `#/connected-accounts`.
- Timeline: `.steps` 4 steps (Received, Auth checked, Sent to toolkit, Response parsed) with timestamps (mono muted), `.done` for completed.
- Footer: `btn-ghost` "Replay" (toast "Replay queued"), `btn` "Open in Playground" -> `#/playground`.

## Interactions
- Row hover: background `--surface-2`; cursor pointer.
- Drawer slides in from right, 200ms ease-out; scrim fades 150ms.
- Filters apply on change without a button; the table shows a 3-row `.skeleton` for 250ms.
- No scroll-reveal animation.

<!-- /dev -->
