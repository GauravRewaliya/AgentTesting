# approaches/

An approach decides ONLY how the lead delegates to sub-agents. Everything else (store, locks, worktrees, patches, bg, phases, monitor, FixtureGate, runners, skills) is shared in `../harness`.

```
approaches/
  approach_port.ts     ApproachSpec (the approach as data) + BaseApproach (the ONE runLead; subclasses override describeLaunch() / request())
  index.ts             picks one: CONFIG.approach (test_harness/core/config.ts), env APPROACH, or --approach=<name>
  resolve.ts           override lookup: custom/<approach>/ > custom/_all/ > <approach>/ > shared
  a1_team_cli/         lead delegates with Bash `team agent ...` (adapter.ts only)
  a2_native_hook/      lead uses Claude's Agent / SendMessage; hook.ts catches them and calls the shared `delegate` (adapter.ts, hook.ts, observe.ts, team_mcp.ts, prompts/)
  a3_native_mod/       the same, done by a MOD (Claude Code's plugin runtime): mod/ = the template of the lead's plugin folder, built into test_harness/core/.build/ by harness/leadkit/build.ts
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

## a3_native_mod (built 2026-11-20)
- **What it is:** `A3 extends A2` (same prompt pieces, `--agents`, Bash `team ...`, fixtures, locks, budget). It swaps the hook for a mod: `buildLeadMod()` (adapter.ts) builds `core/.build/team-lead.<hash>/` from `mod/` + a generated `hooks/config.ts` + a copy of `harness/leadkit/guard.ts` (now Node-free, so the mod and the a2 hook run the same file), and the lead starts with `--plugin-dir <it>`.
- **What the mod does** (`mod/hooks/register.ts`, ~90 lines, typed with `claude-code`): `tool.call` for `Agent` and `SendMessage` runs the shared `tools.ts delegate` (a stream via `$.process.spawn`, so no 10-minute cap) and answers with a REAL tool result; a timer (`$.clock.every`) ticks the monitor every 15 s while the call blocks; `tool.call` for Read/Glob/Grep/Bash applies the lite guard. A `.catch` on the Agent gates REFUSES the call if the mod itself fails (otherwise Claude's own engine would start a real sub-agent: this happened on the first run, see below).
- **Engine rules learned (debug log: `claude -p ... --debug-file f`):** a `.catch` handler must be a top-level `function` (not a const inside `register`); `$.clock.every` returns a Timer (`.cancel()`), not a function; import plugin files without the `.ts` suffix; the Agent result must match the tool's schema; `$.process.spawn` is read with `for await` and `$.process.run` waits at most 10 min.
- **Tested:** `self_test/approach_a3.ts` (5 free checks, incl. `claude plugin validate`); real run `test_web_setup web_vue_setup` on a3 ($0.20): turn 1 asked first (no call), turn 2 the lead's `Agent` call went through the mod to the recorded fixture (served), `SendMessage` continued `web-setup#1`, the lead read the report as a sub-agent hand-back. The case first FAILED for a fixture reason, not the mod: the fixture's option parser (`store/web_setup/scaffold.ts`) read the lead's "NOT wanted ...", "ESLint NO" and "ACCEPTANCE: no eslint, prettier ..." lines as chosen options, so the real generator added Cypress / Playwright / ESLint / Prettier and the lead rightly asked for fixes (4 calls, limit 4). Parser fixed ("none of", trailing "NO", ACCEPTANCE sections cut); after that BOTH `web_vue_setup` and `web_react_setup` PASS on a3 ($0.15 lead per case, one `web-setup` call each). The mod's guard was probed too: a `.env` read is refused with the GUARD text, a normal file reads.
- **Sub-agents:** their skills are built by the same builder into `core/.build/skills-<agent>.<hash>/` (`harness/core/skills.ts` -> `buildPlugin`), declared once in `core/agents/skills.json` (the library is every agent's `.claude/skills/*` plus `core/agents/skills/*`, so a skill such as a UX one can be shared by listing several agents). Sub-agents still run as `claude -p` through the core and call others with `team agent ...`.
- **Not done yet (phase 3):** the `team` commands as `$.tool.register` tools (then no Bash and no 3 KB command list per turn); `prompt.compose` for the lead prompt; interrupts and extra context as mod events (`prompt.submit`, `turn.step`, `session.start`, `$.prompt.submit` to wake a quiet session); session create / continue / fork from the mod (`$.agent.spawn`, `$.session`); a flag that switches the mod to the test flow (fixtures on) or to real sub-agents (`next(e)` lets Claude's own engine run the call); building a plugin folder per sub-agent (agents/*.md, skills, guard) instead of `claude -p` with `team agent`. a3 is NOT the default: `CONFIG.approach` stays `a2_native_hook` until a3 passes the web_setup and handover suites.
