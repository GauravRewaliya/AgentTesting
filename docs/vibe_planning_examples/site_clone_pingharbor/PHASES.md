---
audience: both
title: PingHarbor (clone of a real website) phases
status: phase 1 of 3 · planned
---
# Phases · PingHarbor (clone of a real website)
> phase 1 of 3 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Kit and contract](#phase-1) | the empty site exists with working header, footer, theme and 5 routes | **planned** | F6, F7 | - |
| 2 | [Build the pages](#phase-2) | five linked pages with original text | **planned** | F1-F5, F8 | 1 |
| 3 | [Verify and fix](#phase-3) | measured quality, defects fixed | **planned** | F1-F8 | 2 |

## Next up
**Kit and contract** (planned): run the harness `proto_init` tool with kind `site` (no reference capture: it is already in build_inputs).

---
<a id="phase-1"></a>
## Phase 1 · Kit and contract · planned
**Goal:** the empty site exists with working header, footer, theme and 5 routes  
**Covers:** F6, F7  
**Needs:** -

| task | what | owner | needs |
|---|---|---|---|
| T01 | `proto_init` kind `site` for project `pingharbor`: brand PingHarbor, accent #10b981, font DM Sans, dark background #0e1318, nav = home, blog, article, features, download; this writes `PROTO.md`, `theme.css`, `index.html`, `css/site.css`, `js/site.js` (kit files are never edited again) | lead | - |
| T02 | check the contract in `build_inputs/00_contract.md` matches the generated `PROTO.md` (routes, file owners, linking rules) | lead | T01 |

**Done when (you can check each one):**
- `run_test/pingharbor/` exists with the 5 routes in `proto.json`
- header and footer link to EVERY page
- theme follows the system and has a toggle
- `.reveal` content animates on scroll (kit)

---
<a id="phase-2"></a>
## Phase 2 · Build the pages · planned
**Goal:** five linked pages with original text  
**Covers:** F1-F5, F8  
**Needs:** 1

| task | what | owner | needs |
|---|---|---|---|
| T03 | builder 1: `js/screens/part-1.js` + `css/pages-part-1.css`: Home (sections S1-S9) and Blog list with article views. Brief: `build_inputs/02_brief_home_blog.md`; layouts 10 and 13 | builder | P1 |
| T04 | builder 2: `part-2`: Features and Article. Brief: `03_brief_features_article.md`; layouts 11 and 14 | builder | P1 |
| T05 | builder 3: `part-3`: Download. Brief: `04_brief_download.md`; layout 12 | builder | P1 |

**Done when (you can check each one):**
- every page replaced its stub (no 'TODO', no lorem ipsum)
- all links resolve; blog slugs are the six in the README rules; an unknown slug shows 'Article not found'
- dark theme works; PingHarbor brand only, original text (`grep -ri upwatchr` finds nothing)
- each builder touched only its own two files

---
<a id="phase-3"></a>
## Phase 3 · Verify and fix · planned
**Goal:** measured quality, defects fixed  
**Covers:** F1-F8  
**Needs:** 2

| task | what | owner | needs |
|---|---|---|---|
| T06 | `site_audit` + `preview` (the reference picture compare is not possible: no live reference is supplied) | qa-reviewer | P2 |
| T07 | fix contrast: small accent text on light must use `#047857` (design system); all text 4.5:1 or better, light and dark, desktop and phone | builder | T06 |
| T08 | fix phone tap targets (at least 40x40 px), add a meta description to every page, keep heading order, no text under 12 px | builder | T06 |

**Done when (you can check each one):**
- `site_audit` score 80 or more with 0 high findings
- preview opens with 0 console errors
- all 5 pages reachable from the header on desktop and phone

<!-- dev -->
**Reference result of the first (earlier) run:** `ref_compare` 100 on the blog; `site_audit` first job 44, last audit **72/100** (1 high, 4 medium, 3 low). Cost $1.39 (lead + 4 lookup-page + 3 builders). Details in the DEV block of the README.
<!-- /dev -->
