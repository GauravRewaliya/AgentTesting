---
audience: both
title: PingHarbor phases (one phase, complete)
status: phase 1 of 1 · planned
---
# Phases · PingHarbor (one phase, complete)
> phase 1 of 1 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Build the whole site](#phase-1) | kit, five linked pages and a verified result in one go | **planned** | F1-F9 | - |

## Next up
**Build the whole site** (planned): run the kit, give each of 3 builders its brief, then audit and fix. Nothing else is planned after this.

---
<a id="phase-1"></a>
## Phase 1 · Build the whole site · planned
**Goal:** a finished, verified 5-page website in `run_test/pingharbor/`.  
**Covers:** F1-F9  
**Needs:** nothing (all inputs are in `build_inputs/`)

| task | what | owner | needs |
|---|---|---|---|
| T01 | harness `proto_init` kind `site` for `pingharbor`: brand PingHarbor, accent #10b981, font DM Sans, dark bg #0e1318, nav = home, blog, article, features, download (writes `PROTO.md`, `theme.css`, kit files; kit files are never edited again) | lead | - |
| T02 | builder 1: `js/screens/part-1.js` + `css/pages-part-1.css`: Home (S1-S9) and Blog with article views. Brief `build_inputs/02_brief_home_blog.md`, layouts 10 and 13 | builder | T01 |
| T03 | builder 2: `part-2`: Features and Article. Brief `03_brief_features_article.md`, layouts 11 and 14 | builder | T01 |
| T04 | builder 3: `part-3`: Download. Brief `04_brief_download.md`, layout 12 | builder | T01 |
| T05 | `site_audit` + preview (the lead runs both itself, no extra agent) | lead | T02-T04 |
| T06 | ONLY if the audit is under 80 or has a high issue (the builders already know the quality bar from `00_contract.md`): fix what the audit finds: small accent text on light `#047857`, all text 4.5:1 or better, phone tap targets 40x40 px, meta description on every page, heading order, no text under 12 px | builder | T05 |

**Done when (you can check each one):**
- `run_test/pingharbor/` has the 5 routes; header and footer link to EVERY page; theme follows the system and has a toggle; scroll reveal works
- every page replaced its stub (no 'TODO', no lorem ipsum); all links resolve; blog slugs are the six in the README rules; an unknown slug shows 'Article not found'
- PingHarbor brand only, original text (`grep -ri upwatchr` finds nothing); each builder touched only its own two files
- `site_audit` score 80 or more with 0 high findings; preview opens with 0 console errors

<!-- dev -->
Reference result of an earlier run (not this build): `ref_compare` 100 on the blog; `site_audit` first job 44, last audit 72/100; cost $1.39.
<!-- /dev -->
