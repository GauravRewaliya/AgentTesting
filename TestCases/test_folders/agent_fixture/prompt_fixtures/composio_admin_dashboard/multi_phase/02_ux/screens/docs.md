---
audience: both
title: Docs
status: planned
source: invented (login page only was captured)
---
# Docs · `#/docs` · planned
> Short guides to get started. · [all screens](../README.md) · [overview](../../README.md)

## Picture (rough sketch, click the menu inside it)
![sketch](../../wireframes/shell.html#docs)

## What you can do here
- Search the sections
- Read quickstart, authentication, errors and limits
- Links go to API Keys, Toolkits, Triggers

## How it connects
- Comes from: [Home](home.md), [API Keys](api-keys.md)
- Goes to: [API Keys](api-keys.md), [Toolkits](toolkits.md)

## How you check it works
Type in the search: sections filter. (full steps: [test plan](../../PHASES.md))

## Source of this screen
Invented from typical agent platforms: the real dashboard is behind a login and was not captured. To make it exact, answer Q1 in [pending](../../README.md#decisions-and-open-questions).

## Want a change?
Open this page in the viewer, press **Ask Claude**, and write what you want changed. Claude edits THIS file, so the git history of the page is the history of the decision.

<!-- dev -->
## Layout spec (builders read this)
Picture: none captured. Built from dashboard structure. A reading layout: 3 columns on wide screens.

1. Page header: h1 "Docs"; p "Guides for agents, toolkits and triggers." Actions: [API keys] btn-ghost -> #/api-keys, [Quickstart] btn-primary -> #/home.
2. Search input full width of the header row ("Search the docs", filters the section list below).
3. Layout grid 200px | 1fr | 200px (collapses to 1 column under 900px, contents become a `.chip` row).
   - Left: section nav (list of 8 links, active = accent text + left 2px accent bar): Quickstart, Authentication, Toolkits, Connected accounts, Triggers, Tools and actions, Errors, Limits.
   - Centre: article, max 70ch, one section per heading:
     - h2 "Quickstart": 3 numbered steps (ol), a `.code` block (Python, 8 lines) with copy button.
     - h2 "Authentication": p, `.kv` (Header: Authorization, Format: Bearer key, Test keys prefix: ad_test_) with link [Create API key] -> #/api-keys.
     - h2 "Toolkits": p + link -> #/toolkits.
     - h2 "Connected accounts": p + link -> #/connected-accounts.
     - h2 "Triggers": p + link -> #/triggers.
     - h2 "Errors": `.table-wrap` 5 rows (Code mono 401/404/422/429/500, Meaning, What to do).
     - h2 "Limits": `.callout` (card with accent-weak left border), 2 sentences.
   - Right: "On this page" list (h3 small) mirroring the centre headings, active on scroll (IntersectionObserver).
4. Footer strip (inside content): "Still stuck?" card with [Open logs] btn-ghost -> #/logs and [Contact support] btn-ghost (toast "Message sent").

Interactions: section nav and "On this page" jump to anchors; copy code toast; search hides non-matching nav items (with empty text "No section matches"). Empty state: only the search text.

<!-- /dev -->
