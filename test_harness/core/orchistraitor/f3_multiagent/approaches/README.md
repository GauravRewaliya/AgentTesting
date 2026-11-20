# approaches/

An approach decides ONLY how the lead delegates to sub-agents. Everything else (store, locks, worktrees, patches, bg, phases, monitor, FixtureGate, runners, skills) is shared in `../harness`.

```
approaches/
  approach_port.ts     ApproachSpec (the approach as data) + BaseApproach (the ONE runLead; subclasses override describeLaunch() / request())
  index.ts             picks one: CONFIG.approach (test_harness/core/config.ts), env APPROACH, or --approach=<name>
  resolve.ts           override lookup: custom/<approach>/ > custom/_all/ > <approach>/ > shared
  a1_team_cli/         lead delegates with Bash `team agent ...` (adapter.ts only)
  a2_native_hook/      lead uses Claude's Agent / SendMessage; hook.ts catches them and calls the shared `delegate` (adapter.ts, hook.ts, observe.ts, team_mcp.ts, prompts/)
  custom/              whole-file overrides (see its README)
```
Shared pieces every approach uses: `../harness/leadkit/` (`common.ts` run start, env, request, `team` command list; `guard.ts` lite guard; `delegate_docs.ts` sub-agent protocol). Agents, tools and skills are declared once in `core/agents/` (`agent.json`, `.claude/settings.json`, `skills.json`), never per approach.

## Add an approach
A folder here, a class extending `BaseApproach` (a spec + `describeLaunch` + `request`), one line in `index.ts`. Check with `bun self_test/approach_a2.ts` (copy its pattern) and `--approach=<name> --list`.

## How the lead calls sub-agents, by approach
| | a1_team_cli | a2_native_hook (default) | a2_native_observe |
|---|---|---|---|
| Lead tool | Bash `team agent <role>` | `Agent` / `SendMessage` (+ Bash `team ...` for the rest) | the same, but Claude's own engine runs the sub-agent |
| Who answers the call | the shared CLI `delegate` | PreToolUse hook -> the same `delegate` (reply as the hook's deny reason) | Claude itself; hooks only record and may refuse |
| Fixtures, locks, patches, budget | yes | yes | no |

## Hooks vs MODS (what we use, and what we could)
We use stock Claude Code HOOKS, passed with `--settings` (guard, Agent -> delegate, notes, Stop, monitor tick). Claude Code (2.1.328) also has a MOD runtime, which can do much more than hooks and is NOT used yet:
- A mod is a plugin folder: `.claude-plugin/plugin.json` + `hooks/hooks.json` (`{ "modules": ["./register.ts"] }`) + `hooks/register.ts` (`export const register: Register = (on, options) => {...}`, types from `'claude-code'`). Load it with `claude --plugin-dir <mod folder>`; check with `claude plugin validate <folder>` and `claude plugin test <folder>`. Under `claude -p` nobody can be asked to enable mods, so `--plugin-dir` is the way (NOT tried by us yet).
- Hooks are a chain `($, e, next)`: `next({...e, x})` rewrites what the rest sees, `await next(e)` wraps the result, returning without `next` answers with a REAL result (no deny-reason trick), `{ deny }` refuses. Events include `tool.call`, `prompt.submit`, `prompt.compose` (change the system prompt), `session.start`, `command.run`, `ui.render`.
- The engine `$`: `$.tool` (register tools the model calls, e.g. the `team` commands), `$.agent` (subagent types), `$.model`, `$.fs`, `$.process`, `$.clock`, `$.command` (slash commands), `$.state` / `$.store` (kept per session / across sessions), `$.ui` (panes, bands, toasts, status line, themes, tool-row cards), `$.audio`.
- Stock hooks (ours) can: allow/deny with a reason, run code before/after a tool, add context, refuse the end of a turn, answer a tool call as the deny reason. They cannot change the system prompt, register tools or agents, or draw UI.
- Loopferry examples: `/home/gr/projects/loopferry/.idea/.claude/dev-plugins/plugins/` (guard-rails, agent-monitor, gate-check, phase-band, bottom_bar, agent-flow).

## Plan (decided 2026-11-20)
1. Commit the hooks approach (done, `e14c944`).
2. Probe: does a tiny mod load under `claude -p --plugin-dir`, and can a `tool.call` hook for `Agent` return a real result? DONE, YES (`self_test/mod_probe/`, $0.003): the mod loaded, its `Agent` hook answered, the lead read the text as a sub-agent report ("[Subagent hand-back] ..."), not as an error. The result must match the tool's schema (`status: "completed"`, `prompt`, `usage`, `content`, `agentId`).
3. If yes: rename the hooks approach to `a2_native_hooks` (kept as the fallback) and add `a3_native_mod`: a mod that serves `Agent` / `SendMessage` from the shared `delegate`, registers the `team` commands with `$.tool`, applies the lite guard, runs the monitor, and shapes the lead prompt with `prompt.compose`. Same core, same fixtures.
