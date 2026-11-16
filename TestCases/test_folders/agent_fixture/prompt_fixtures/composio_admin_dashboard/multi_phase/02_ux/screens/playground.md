---
audience: both
title: Playground
status: planned
source: invented (login page only was captured)
---
# Playground · `#/playground` · planned
> Try a tool by hand and see the exact request and answer. · [all screens](../README.md) · [overview](../../README.md)

## Picture (rough sketch, click the menu inside it)
![sketch](../../wireframes/shell.html#playground)

## What you can do here
- Pick app, tool and account
- Edit the JSON params and press Run
- Read the response; the run also lands in Logs

## How it connects
- Comes from: [Connected Accounts](connected-accounts.md), [Toolkits](toolkits.md)
- Goes to: [Logs](logs.md)

## How you check it works
Pick GitHub + create issue, press Run: response fills and Logs has a new top row. (full steps: [test plan](../../PHASES.md))

## Source of this screen
Invented from typical agent platforms: the real dashboard is behind a login and was not captured. To make it exact, answer Q1 in [pending](../../README.md#decisions-and-open-questions).

## Want a change?
Open this page in the viewer, press **Ask Claude**, and write what you want changed. Claude edits THIS file, so the git history of the page is the history of the decision.

<!-- dev -->
## Layout spec (builders read this)
Source: NOT CAPTURED. The reference holds only the sign-in page. Structure = typical dashboard playground (request + response split), NOT a picture. Palette: pictures/desktop-light-section-02.png and desktop-dark.png. Do not copy any reference text.

## Page frame
- Page: full width inside the shell, padding 24px, max-width none. Background `--bg` (light #fcfcfc, dark black).
- Body split into 3 columns on desktop (>=1200px): 280px | 1fr | 1fr, gap 16px, all cards top-aligned. Below 1200px: stack 1 column (picker, then form, then response).

## 1. Page header
- Left: h1 "Playground" + one line "Run a tool with a connected account and read the exact request and response."
- Right actions: `btn-ghost` "Copy as code", `btn-primary` "Run" (black button, white text; shortcut hint ⌘ Enter in `.muted .mono`).

## 2. Toolbar
- `.toolbar`: search box "Search tools" (left, 280px), `.select` "Toolkit: All", `.select` "Account: Acme production".
- Right: `.badge-success` "Connected" with a dot, and a `btn-sm` "Reset".

## 3. Tool picker (left column, card)
- `.card` header "Tools" + count `.muted` "24".
- List of 8 rows, each: toolkit icon square 24px (letter tile, mono), tool name in mono 13px (e.g. GITHUB_CREATE_ISSUE), one-line description muted 12px. Selected row: lavender fill (#b1a9ff at 20% alpha) and 2px left bar #5753c6.
- Click selects the tool and fills the form. Filter by search.

## 4. Request form (centre column, card)
- `.card-header`: "Request" + `.badge-neutral` "POST".
- Fields `.form-field`: Tool (`.select`, read-only mono slug), Connected account (`.select`), Input (`.textarea.code` mono, 10 lines, pre-filled JSON with 3 keys, e.g. {"repo":"acme/web","title":"Fix login redirect","labels":["bug"]}).
- `.form-hint` under Input: "Valid JSON. Keys follow the tool schema."
- Invalid JSON: `.field-error` "Unexpected token at line 4"; Run disabled.
- `.form-actions`: `btn-primary` "Run" (duplicated), `btn-ghost` "Load example".

## 5. Response (right column, card with tabs)
- `.tabs`: Response (active) | Request | Headers | Timing.
- Response tab: `.code` block, mono 12.5px, JSON of 12-14 lines (id, number, url, state "open"), copy button top-right `btn-sm`.
- Status line above code: `.badge-success` "200 OK" + `.muted .mono` "412 ms · req_8fK2x91".
- Request tab: same code block with the sent body. Headers tab: `.kv` 4 rows (content-type, x-request-id, x-account-id, user-agent). Timing tab: `.bars` 5 bars with labels (auth, queue, upstream, parse, total).
- Error state (shown on a sample button in the picker footer): `.badge-danger` "401 Unauthorized", message box `.card` red-tinted: "The connected account token expired. Reconnect it." + `btn` "Reconnect account" -> `#/connected-accounts`.

## 6. Recent runs (full width, below the 3 columns)
- `.card` header "Recent runs" + `btn-sm` ghost "Open logs" -> `#/logs`.
- `.table-wrap > table.table`: Time (muted), Tool (mono), Account, Status (`ui-badge`), Duration (`td.num`, "412 ms"), Request id (mono, muted). 6 rows; `tr.row-link` click loads that run into the form and response.
- `.pagination` under the table.

## Interactions
- Run: button shows spinner for ~0.6s then response appears with a fade (opacity 0 -> 1, 180ms).
- Tab change: no slide, instant swap.
- Copy: `$toast('Copied')`.
- Hover row: background `--surface-2`.
- No scroll animation on this screen.

<!-- /dev -->
