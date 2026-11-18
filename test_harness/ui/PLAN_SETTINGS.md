# Settings page: plan + status (2026-11-18: BUILT, see `## Built` at the end)

**Decisions taken (by the owner, 2026-11-18):** ONE simple user home shaped like a session: `test_harness/.state/home/` (settings.json, secrets.json, `custom_claude/{agents,skills}` = the "extra claude" added on top of the container's profile, `chrome-profile/`, `browser.json`, `artifact_runs/`). No second volume. Tests never see it (`HARNESS_USER_HOME=1` is set only for runs the dashboard starts). User agents may only sit under agents already in the tree (no loops). The sections below that say `USER_DATA/...` mean this folder.

Goal: one **Settings** page (left menu) with **Agents**, **Integrations**, **Browser** (moved here), **Usage** (bottom block). One user for now (`default`), but every path and API already takes a `user`, so more users later cost nothing.
Rules kept from `CLAUDE.md`: live data over the ONE WebSocket (no `setInterval`), pnpm only, no secrets in the repo, logs of socket traffic stay.

## 0. What exists today (read before planning)
| Thing | Where | Note |
|---|---|---|
| UI stack | `test_harness/ui`: Vue 3 + vue-router + `@vue-flow/core`, Bun server (`server/index.ts`, `hub.ts` WebSocket) | tree editor can reuse vue-flow (already a dependency) |
| Pages | `Flow`, `SubAgents`, `ExperimentRun`, `Browser` (top menu), `/test/:caseId` | `BrowserPage.vue` moves under Settings |
| Browser | `server/browser.ts` (status, connect, launch, tabs, snapshot, try) over `core/browser_conn.ts` | **violates the no-poll rule**: `BrowserPage.vue` and `App.vue` use `setInterval(…, 5000)` -> becomes a `browser` hub topic |
| Agents | folders `test_harness/core/agents/main_flow_agents/<name>/{agent.json,.claude/CLAUDE.md,settings.json,skills}`; tree = `agent.json` `agents: []` (who may call whom); `loadAgents(roots)` takes a list of roots | defaults are repo files = **read-only** by design |
| Claude profile | `CLAUDE_CONFIG_DIR` (`~/.claude`, `~/.claude-personal`; Docker mounts it) holds sessions, skills, plugins | `claudeDirs()` / `profileOfSession()` in `harness/core/base/runner.ts` |
| Tools to agents | a1: `team` shell commands; a2: typed MCP tools `team_mcp.ts` + `--mcp-config` | the SAME `--mcp-config` mechanism carries user integrations |
| Usage | `~/.claude/stats-cache.json` exists but is **stale** (`lastComputedDate 2026-04-08`) | compute from the session transcripts instead (below) |

## 1. Where user data lives (the volume)
```
$USER_DATA = <claude profile dir>/../.agent_testing/users/<user>/      (docker: a named volume mounted next to .claude; local: ~/.agent_testing/users/<user>/)
  profile.json            { id, name }
  integrations.json       { github: { enabled, token_ref, scopes }, jira: { enabled, site, email, token_ref } }   (tokens: see 6, never in the repo)
  agents.json             overrides on the defaults: { disabled: ["ux-designer"], position: { builder: { parent: "lead", order: 2, x, y } } }
  agents/<name>/          USER agents and clones: agent.json (+ CLAUDE.md, settings.json) same shape as a default one; agent.json adds { origin: "user"|"clone", cloned_from?, locked: false }
  browser/                the Chrome profile of this user (logins stay)        <- today `bc.profileDir()`
  usage-cache.json        computed usage rows (optional cache, rebuildable)
```
Claude's own things stay where Claude looks for them: **skills** `<profile>/skills`, plugins `<profile>/plugins`, sessions `<profile>/projects`. Our files sit beside them, in the same volume, so one backup/mount covers both.
Defaults (repo) are never written to. A clone is a COPY into `agents/<name>/`.

## 2. Pages and components
```
/settings                      -> redirects to /settings/agents
/settings/agents               Agents (tree editor)
/settings/integrations         GitHub, Jira
/settings/browser              the current BrowserPage content (/browser redirects here)
/settings/usage                Usage chart, banner at the bottom
```
Wireframe:
```
+--------------------------------------------------------------+
| Test_agent_3  Flow  Sub-agents  ExperimentRun  Settings ...  |
+----------------+---------------------------------------------+
| Settings       |  Agents                         [+ New agent]|
|  > Agents      |  +--------- tree (vue-flow) ----------+     |
|    Integrations|  |  [lead]-+-[researcher] (default 🔒) |     |
|    Browser     |  |         +-[builder]    (default 🔒) |     |
|    Usage       |  |         +-[my-reviewer] (yours ✎)  |     |
|                |  +-------------------------------------+    |
|                |  right panel: selected agent                 |
|                |   name, description, model, tools, prompt    |
|                |   default: read-only + [Clone] [Disable]     |
|                |   yours:   editable   [Delete] [Move]        |
+----------------+---------------------------------------------+
```
Components (`src/components/settings/`), all wrapped in `DebugFrame` like the rest:
| Component | Job |
|---|---|
| `SettingsLayout.vue` | left menu + `<router-view>`; one `settings` store |
| `AgentTree.vue` | vue-flow tree of lead -> callees; drag = change parent/position (user agents + positions of defaults); disabled nodes greyed |
| `AgentNode.vue` | node: name, 🔒 default / ✎ yours, enable switch, clone button |
| `AgentPanel.vue` | read-only view for defaults; form for user agents (name, description, model, tools checklist, integrations checklist, prompt editor) |
| `AgentCreateDialog.vue` | new agent / clone (name, parent, start from) |
| `IntegrationCard.vue` | one card per integration (GitHub, Jira): status, Add/Remove, fields, "test connection" |
| `IntegrationAgents.vue` | which agents may use an added integration (default: none until chosen) |
| `BrowserSection.vue` | existing BrowserPage body, fed by the `browser` topic |
| `UsageSection.vue` | chart + (later) sessions table + bottom banner |
| `UsageChart.vue` | stacked bars: tokens per day per model (no chart library: inline SVG, same as the rest of the UI) |
| `PlanBanner.vue` | bottom banner "Plan limits are not shown here" + link to claude.ai usage |

## 3. Agents: rules and how the harness learns about them
- **Defaults cannot be edited** (API refuses a write to `origin: default`; UI shows read-only). They CAN be disabled (`agents.json.disabled`) and cloned.
- **Disable** = removed from every parent's `agents` list at load time (`loadAgents` merge step), so the lead's declarations and the `Agent` tool no longer offer it. A disabled agent keeps its node (greyed), re-enable restores it.
- **Clone** = copy the folder to `agents/<name>-copy/`, `origin: "clone"`, `cloned_from`, editable.
- **Create** = new folder from a template (`description`, `model`, `tools`, `prompts`, `team_tools`); name validated (`^[a-z][a-z0-9-]*$`, unique, not a reserved one).
- **Position** = the parent (whose `agents` list contains it) plus the canvas x/y; dragging a node onto another parent rewrites the PARENT's callee list in `agents.json` (defaults) or in the user agent's own `agent.json`.
- **Loader change (small, one place):** `loadAgents()` gets a third root (`USER_DATA/agents`) and a merge function that applies `agents.json` (disabled, position). Every approach (a1, a2) and every case already calls `loadAgents()`, so they see the result without further change. Cases that name an agent which the user disabled fail with a clear "agent disabled in Settings" (the test harness may pin defaults only: `HARNESS_DEFAULT_AGENTS=1`, so the test suite is never affected by a person's settings).
- A user agent with `fixtures: true` is not allowed (fixtures belong to test stand-ins).

## 4. Integrations (GitHub, Jira only for now)
- Each is an MCP server definition the harness injects with `--mcp-config` (the mechanism `a2_native_hook/adapter.ts` already uses). Not added = no server, no tool names, nothing in the prompt.
- **Add** (card): GitHub = a token (fine-grained, scopes shown); Jira = site URL + email + API token. "Test connection" calls one cheap read endpoint and shows ok/denied. **Remove** deletes the token.
- **Which agents get it:** per integration a checklist of agents (default none). The agent's launch adds the matching `mcp__github` / `mcp__jira` to its allow list and `--mcp-config` entry ONLY if the user ticked it. Read-only vs write scopes are separate switches (default read-only).
- The MCP servers themselves: use the vendors' maintained MCP servers when installed; otherwise a thin `integrations/<name>_mcp.ts` (same style as `team_mcp.ts`: typed tools over the REST API). Decision in section 9.
- Later (not now): user-added skills / MCP servers (a generic "Add MCP server" card), plugins from the volume.

## 5. Browser (moved)
Same content and same server code (`server/browser.ts`), under Settings. Changes: (a) delete both `setInterval`s, add hub topic `browser` (status + tabs, pushed on change; `{kick:1}` after connect/launch/disconnect); (b) the header chip in `App.vue` reads the same topic; (c) the Chrome profile dir becomes per user (`USER_DATA/browser/`), so "logins stay" is per person.

## 6. Secrets (hard rules)
- Tokens live only in `USER_DATA/integrations.json` (mode 600) or the OS keyring later; the API NEVER returns a token (only `has_token: true`, last 4 chars).
- Never written into prompts, hand-overs, store rows, events, logs or fixtures; the MCP config env is built at launch from the file and not persisted.
- The docker sandbox (T-13 in `TestCases/test_folders/TODO.md`) must not mount `integrations.json` into agent containers: only the launch code reads it and passes the one needed variable to the one MCP process.

## 7. Usage (like `/usage`, first cut)
- **Source = Claude's own session transcripts** (`<profile>/projects/**/*.jsonl`, each assistant message has `usage` and `model`): accurate, local, no network, no credentials. `stats-cache.json` is NOT used (stale).
- Server `server/usage.ts`: scans the transcripts incrementally (cache keyed by file mtime+size, the same trick `hub.ts` uses), returns `{ days: [{date, model, input, output, cache_read, cache_create}], sessions: n }`. Pushed as hub topic `usage` only when it changed.
- UI now: **usage chart** (tokens per day, stacked by model, last 30 days fixed; no date picker yet). Later (placeholders only, no code): sessions table, other tabs.
- **Bottom banner** (`PlanBanner`): "Plan limits (5-hour and weekly) are not shown here." + a button linking to the Claude usage page (`https://claude.ai/settings/usage`). The real limit percentages come from Claude's account API with the login token; we do NOT read that token for now.

## 8. API and WebSocket (new)
```
GET  /api/settings                       { user, agents[], integrations[] }   (no secrets)
POST /api/settings/agents                create | clone                       (refused for origin default)
PUT  /api/settings/agents/:name          edit a user agent
POST /api/settings/agents/:name/enable|disable    (defaults too)
POST /api/settings/agents/:name/move     { parent, x, y }
DELETE /api/settings/agents/:name        user agents only
PUT  /api/settings/integrations/:id      { enabled, fields..., agents:[...] , write:boolean }
POST /api/settings/integrations/:id/test
hub topics: settings (agents + integrations state), browser, usage          (client: live.watch({ settings:true, usage:true, browser:true }))
```
All logged like the existing topics (`[hub] -> push topic size`, console `[live] ← …`).

## 9. Decisions I need from you (my default in bold)
1. GitHub/Jira MCP servers: **use the vendors' MCP servers if installed, else our thin typed `*_mcp.ts`**, or always ours?
2. Where does `USER_DATA` live in Docker: **a second named volume next to the `.claude` one**, or inside the `.claude` volume (`<profile>/agent_testing/`)?
3. Should a disabled/edited agent affect the TEST runs? **No: tests pin the defaults** (`HARNESS_DEFAULT_AGENTS=1`), the UI/real use sees the user's settings.
4. User agents may call: **only agents already in the tree** (no loops: the tree must stay a DAG, depth <= `agentMaxDepth`).

## 10. Build order (each step leaves the app working; check `bun run typecheck` and the UI checks)
1. `server/userdata.ts` (paths, `profile.json`, read/write helpers) + `loadAgents` third root + merge + unit test (free): defaults untouched, disable removes from parents, clone works.
2. Router: `/settings/*` + `SettingsLayout`; move Browser (`BrowserSection`), add `browser` hub topic, remove the two `setInterval`s, `/browser` redirects.
3. Usage: `server/usage.ts` + topic + `UsageChart` + `PlanBanner` (smallest visible win).
4. Agents: API + `AgentTree` / `AgentPanel` / create / clone / disable / move.
5. Integrations: card + test + per-agent checklist + `--mcp-config` injection in the launch path (a1 and a2) + secrets rules.
6. Docs: `ui/STRUCTURE.md`, `TestCases/test_folders/TODO.md` (T-29), `CLAUDE.md` pointer.

## 11. Not in this plan (on purpose)
Date ranges and per-session usage, plan-limit percentages, per-user login/auth, user skills/plugins, MCP servers beyond GitHub and Jira, editing the defaults.

## Built (2026-11-18)
- `core/userhome.ts` (paths, settings, secrets mode 600, integrations GitHub/Jira as `pnpm dlx` MCP servers, `homeLaunch(agent)`, `applyUserLayer`, `cloneAgent`); `loadAgents()` applies the layer only with `HARNESS_USER_HOME=1`; `tools.ts` adds the MCP config + allow entry for the ticked agent only.
- `ui/server/settings.ts` (agents: clone/create/edit/move/disable/delete with defaults locked and loops refused; integrations incl. connection test), `ui/server/usage.ts` (tokens per day and model from the session transcripts, parsed once per mtime+size), hub topics `settings`, `usage`, `browser` (the two 5 s polls are gone; `live.always()` keeps the header chip fed on every page).
- UI: `SettingsPage` (left menu Agents / Integrations / Browser / Usage), `AgentsSection` (vue-flow tree + panel), `IntegrationsSection` (+ skills folder note), `UsageSection` (inline SVG chart, bottom banner linking to claude.ai/settings/usage), Browser moved in (`/browser` redirects).
- Moved into the home: `.state/artifact_runs` (done, both runners), `.state/browser.json` (done); `.state/chrome-profile` keeps working through a fallback and is NOT moved automatically (a Chrome may be using it): move it by hand when Chrome is closed.
- Free check: `bun self_test/userhome.ts` (18 checks, temp home). Live smoke: API + WebSocket topics + `vite build` OK.
- Not tried: the real GitHub/Jira MCP server packages and a real run with an integration ticked (package names in `INTEGRATIONS` are data: verify on first use); the UI in a browser by a person.

## Update 2026-11-18 (second pass): Figma, GitHub, Jira + the user's Claude plugins
- **Probe result:** our runner starts agents with `--setting-sources "" --strict-mcp-config`: they see NO claude.ai connector and none of the user's installed plugins (a plain `claude -p` loads 167 connector tools). That isolation stays.
- **Integrations** (definitions are data in `core/userhome.ts` `INTEGRATIONS`): GitHub = official remote MCP `https://api.githubcopilot.com/mcp/` (bearer token; the same server Claude's own `github` plugin uses); Jira = Atlassian Rovo remote MCP `https://mcp.atlassian.com/v1/mcp`, Basic `base64(email:api_token)` (an org admin must enable API-token auth; some sources say `/v2/mcp`: verify); Figma = community Framelink `figma-developer-mcp --stdio` via `pnpm dlx` with `FIGMA_API_KEY` (Figma's own remote server is OAuth-only, no static token).
- **Plugins:** `installedPlugins()` reads `<profile>/plugins/installed_plugins.json` (the volume), the Settings > Integrations page lists them with per-agent ticks, a tick adds `--plugin-dir <installPath>` for that agent only. Claude.ai connectors (Slack, Docs ...) are account-level OAuth and are NOT passed; a global "use my connectors" switch would mean dropping `--strict-mcp-config` (all tools to all agents) and was not built.
- **Checks:** `bun self_test/userhome.ts` 23/23 (figma/jira/github launch shapes, plugin ticks, no token in any API output). NOT verified live: the CLI accepting these MCP definitions against the real GitHub/Atlassian/Figma endpoints (a probe with fake tokens against live services was not run), and Jira's `/v1/mcp` vs `/v2/mcp`.

## Update 2026-11-18 (third pass): extras are visible, OFF, and unused
Settings > Integrations > "What you already have in Claude" lists the user's installed Claude plugins and (after a Scan button, `claude mcp list`, no model call) their claude.ai connectors, each with a disabled OFF switch and "not supported yet". Server side: `SUPPORTED_PLUGINS` (core/userhome.ts) is EMPTY, so `setPlugin` refuses a tick and `pluginArgs` ignores even a hand-edited settings.json. Only Figma, GitHub and Jira can be enabled. To open one more up, add its name to `SUPPORTED_PLUGINS`. Free check: `bun self_test/userhome.ts` 24/24.
