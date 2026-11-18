# Requirements, data model, code flow, test plan (builder reference)
> Moved out of `README.md` so the front page stays one screen of reading. Stakeholders do not need this file.

## Packages and owners (no file owned twice)
> Status: draft · Updated: 2026-11-16

| file | owner agent | owns (no one else touches) | tasks |
|---|---|---|---|
| part-1 | builder-1 | `js/screens/part-1.js`, `css/pages-part-1.css` (Home, Toolkits, Auth Configs, Connected Accounts; shell + light theme) | T01, T03-T06 |
| part-2 | builder-2 | `js/screens/part-2.js`, `css/pages-part-2.css` (Triggers, Playground, Logs; `window.AgentDeck.executions`) | T07-T09 |
| part-3 | builder-3 | `js/screens/part-3.js`, `css/pages-part-3.css` (Settings, API Keys, Docs; dark theme + toggle) | T02, T10-T12 |
| research | lookup (ONE call, only if a re-capture is asked) | `_ref/*` | T00 |
| qa | qa-reviewer | nothing (read only) | every task |

Parallel: the three builders run at the same time after the kit exists (disjoint files).

## Requirements (EARS)

| id | requirement | source |
|---|---|---|
| R1 | The app shall show a left sidebar with the 10 routes; the active route is highlighted. | invented (typical) |
| R2 | When the user switches Settings > Appearance to dark, every screen shall use the dark palette in `theme.md` and keep the choice after reload. | user-given |
| R3 | Toolkits shall be a card grid with live search and category chips; a card opens `#/toolkits/<slug>`. | invented |
| R4 | Every list shall have a working search or filter, an empty state, and a row that opens a detail view. | PROTO rule |
| R5 | Every button shall do something (modal, drawer, toast, route). No "TODO" / "coming soon" text. | PROTO rule |
| R6 | Playground shall let the user pick a toolkit + action, edit JSON params, press Run, and see a mock response and a new row in Logs. | invented |
| R7 | Forms shall validate and show `.field-error`. | PROTO rule |
| R8 | The layout shall work at 390px width (sidebar becomes a drawer). | user-given ("exact" site is responsive) |


## Data model (mock)
> Status: draft · Updated: 2026-11-16

Shared shapes so Logs/Playground/Home show consistent names (types in words; no TS in a no-build prototype):
| entity | fields | used by |
|---|---|---|
| Toolkit | slug, name, category, auth ("OAuth 2"/"API key"), actions (n), connected (n), description | Toolkits, Home, Playground |
| AuthConfig | id, toolkit, scheme, name, created, status | Auth Configs |
| ConnectedAccount | id, toolkit, label, user, status (active/expired), created | Connected Accounts, Playground |
| Trigger | id, toolkit, event, target_url, status | Triggers |
| Execution | time, tool (mono `GITHUB_CREATE_ISSUE`), account, status (Success/Failed), ms | Logs, Home (recent), Playground (new row) |
| ApiKey | id, name, prefix (`ad_live_ab12…`), created, last_used | API Keys |

Slugs fixed across screens: github, slack, gmail, notion, linear, google-sheets, hubspot, jira, salesforce, stripe, google-calendar, dropbox.
Cross-screen link: Playground "Run" appends an Execution to a `window.AgentDeck.executions` array that Logs reads (the only shared runtime state; owner: part-2 (builder-2); Home in part-1 only READS it).

## Code flow
> Status: draft · Updated: 2026-11-16 · Raw generated contract: `04_code_flow_proto_contract.md`

- No build, no npm: `index.html` + `css/kit.css` + `js/kit.js` (Vue 3 CDN). Done by `proto_init`; nobody edits.
- Router: hash routes; `Screens.<Name> = { template, data, computed, methods }` in the owner's file; detail views branch on `$route.parts[1]`.
- Helpers from the kit: `$go(path)`, `$toast(msg)`, `ui-modal`, `ui-drawer`, `ui-badge`, `ui-empty`.
- Styles: each builder adds only its own classes in its own `css/pages-part-N.css`; shell/light-theme overrides in `css/pages-part-1.css`, dark theme in `css/pages-part-3.css`.
- Only runtime link between packages: `window.AgentDeck.executions` (see `03_data_model.md`).
- Check: `proto_check --dir run_test/agentdeck` (<1 s), then `preview`, then the browser steps.

## Test plan (original)
> Status: draft · Updated: 2026-11-16

| task | steps (human-style) | pass when |
|---|---|---|
| P1-T01 theme | open `#/home`; read computed page bg, button bg | page bg rgb(252,252,252), primary button rgb(0,0,0), accent link #5753c6 |
| P1-T02 dark | Settings > Appearance > Dark; reload | bg #000, surface #191919, choice kept (R2) |
| P2-T01 home | open `#/home`; click tab "30 days"; click "Connect" in step 2 | bars change; route becomes `#/connected-accounts` |
| P2-T02 toolkits | type "git" in search; click chip Developer; click first card; clear search | list filters, detail `#/toolkits/github` opens, empty state shows for "zzz" |
| P2-T09 playground | pick GitHub + create issue; Run | response panel fills; Logs has a new top row (R6) |
| P2-T10 logs | filter status=Failed; click a row | only Failed rows; detail drawer opens |
| P3-T01 responsive | resize 390px; open sidebar drawer; visit all routes | no horizontal scroll, drawer works (R8) |
| P3-T02 sweep | `proto_check`, `preview` all routes, `site_audit`, `ref_compare` | 0 console errors, no dead links, score >= Phase 1 value |
(Other P2 screens follow the R4/R5/R7 pattern: search, empty state, detail, buttons act, form validates.)

Negative cases (the evaluator must catch these): a button with no handler; a screen showing "TODO"; two packages editing one file; a hard-coded colour outside tokens.

## Planner notes
Capture facts come from `_ref/composio/REF.md` (copy of key lines in `ref_notes/capture_facts.md`). The login URL carries a session token: never store it. The raw generated contract is kept as `04_code_flow_proto_contract.md` (dev, not for reading).
