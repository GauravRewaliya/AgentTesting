# 02 UX: routes, owners, sources
> Status: draft · Updated: 2026-11-16 · One owner per file. Index of `screens/`.

| route | screen | layout | file (owner edits ONLY this + its css) | package | source |
|---|---|---|---|---|---|
| #/home | Home | `screens/home.md` | js/screens/part-1.js | builder-1 | invented |
| #/toolkits (+/<slug>) | Toolkits | `screens/toolkits.md` | js/screens/part-1.js | builder-1 | invented |
| #/auth-configs | Auth Configs | `screens/auth-configs.md` | js/screens/part-1.js | builder-1 | invented |
| #/connected-accounts | Connected Accounts | `screens/connected-accounts.md` | js/screens/part-1.js | builder-1 | invented |
| #/triggers | Triggers | `screens/triggers.md` | js/screens/part-2.js | builder-2 | invented |
| #/playground | Playground | `screens/playground.md` | js/screens/part-2.js | builder-2 | invented |
| #/logs | Logs | `screens/logs.md` | js/screens/part-2.js | builder-2 | invented |
| #/settings | Settings | `screens/settings.md` | js/screens/part-3.js | builder-3 | user-given (theme) + invented |
| #/api-keys | API Keys | `screens/api-keys.md` | js/screens/part-3.js | builder-3 | invented |
| #/docs | Docs | `screens/docs.md` | js/screens/part-3.js | builder-3 | invented |

Shared (not owned by a screen): `index.html`, `css/kit.css`, `js/kit.js` = DONE by `proto_init`, nobody edits them. Shell and light-theme overrides: `css/pages-part-1.css` (builder-1); dark theme: `css/pages-part-3.css` (builder-3).
Flow: Home -> Create auth config (#/auth-configs) -> Connect (#/connected-accounts) -> Playground -> Logs.
See also: `theme.md`, `motion.md`, [work split](../README.md).

**File names:** fixed by the `proto_init` nav in the plan README (groups part-1 / part-2 / part-3, owners builder-1 / 2 / 3). Playground and Logs stay in the SAME file (`part-2`) because they share `window.AgentDeck.executions`. Never rename the kit's files.
