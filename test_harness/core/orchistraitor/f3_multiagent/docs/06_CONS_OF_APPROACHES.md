# 06 Cons of the three approaches

`// ref:` paths relative to `test_harness/core/orchistraitor/` unless absolute.

## A1: team CLI, process per agent (f1)
- Not faster or cheaper on small work: multi-haiku $0.0055 / 34 s vs solo $0.0019 / 8 s. ref `f1_multiagent/README.md:13`, `docs/f1_multiagent.md:9`
- Real multi-agent runs not re-run on 2026-11-09; real behaviour unverified. ref `docs/f1_multiagent.md:14`
- Loopholes: Bash writes bypass the edit lock; registry reachable via `Bash(node *)`; lease lapses under a >120 s thinking step; duplicate forks; several lead behaviours fixed by prompt only. ref `docs/f1_multiagent.md:15`
- Process overhead: a waiting lead holds a slot; the CLI answers but never exits, so a watchdog polls the transcript and kills it. ref `f1_multiagent/harness/core/base/runner.ts:65, 89-100`
- Each wake-up is a paid turn (`wait` loops). ref `f1_multiagent/harness/agents/lead/.claude/CLAUDE.md:17`
- // NOT_POSSIBLE: tests a stock lead calling the native `Agent` tool.
- Two engines in one folder (current lead engine + legacy stage loop). ref `f1_multiagent/README.md:3-6`

## A2: mod interception (harness_own_custom)
- // ERROR: the mod source is NOT in this repo or its git history. Copies exist only outside the repo:
  `/home/gr/projects/loopferry/.idea/Test_agent_3/.claude/mods/interrupt/` and `.../RECOVERED/.idea/Test_agent_3/.claude/mods/interrupt/` (`hooks/register.ts`, `.claude-plugin/plugin.json`). The recovered `register.ts` is a `tool.call` hook for `Agent`/`SendMessage` that runs `bun .../harness_own_custom/main.ts spawn|send`.
- // ERROR: `test_harness/core/claude.ts:36` says the mod is "NOT available any more" and `run.ts` forces `mod:false`. What runs today is a PreToolUse hook on `Agent|SendMessage|Task` calling `core/interpose.ts` plus thin REAL haiku sub-agents declared with `--agents` (`claude.ts:19-20`). The mod branch (`claude.ts:36-41`) is dead code. (Paths for `claude.ts` / `interpose.ts` come from the research summary; confirm exact location.)
- // TODO: check the recovered `register.ts` still matches the current `main.ts spawn|send` CLI.
- Tied to one Claude Code build's plugin API; an update can reject the mod's reply shape. ref `harness_own_custom/README.md:115`
- Fake follow-ups (template over history), sub-agent never fails/times out/edits, files written by the harness, similarity can pick a near-miss, NOTFOUND makes the lead do the work itself. ref `harness_own_custom/README.md:96-117`
- // NOT_POSSIBLE: nested agents, background, sub-agent tools, worktree, compaction, sub-agent cost. ref `harness_own_custom/README.md:69-88`
- Haiku-specific: the thin sub-agent relies on haiku copying a heredoc verbatim (hook path). ref `harness_own_custom/core/agent_prompt.md`
- A mod in a shared Claude profile would also intercept f1's real `claude -p` calls (see 09).

## A2 status (2026-11-18): BUILT as `approaches/a2_native_hook/` (hook, not the mod)
- The lost mod is NOT rebuilt. The lead calls the stock `Agent` / `SendMessage`; a PreToolUse hook (`hook.ts`) turns the call into `tools.ts delegate` (shared core: agentCall, FixtureGate, store rows, patches), so `judgeTurn` sees the calls exactly as in a1. The answer goes back as the deny reason `AGENT RESULT ...` (no extra haiku sub-agent, unlike `harness_own_custom/runner`).
- Parity powers (2026-11-18): `Agent{run_in_background}` = `delegate --async`; the lead also has the `team` commands (wait, fork_all, plan_*, phase_pass, apply_patches, ledger_get, ls/read_file/grep); locks/worktrees/patches/FixtureGate come from the same core; the lead's routing rules are the same CLAUDE.md as a1 (+ `prompts/translate.md`). Real runs, same verdict as a1: ho_8 (2 calls), wf_1, wf_2, eg_tw_01.
- Cons: reply is not the native Agent tool_result shape (it arrives as a hook deny reason); only a hook-supporting Claude Code build; the lead has `Bash(team *)` so it COULD still call `team delegate` (prompt forbids it).
- `a2_native_observe` findings (real run 2026-11-18): this Claude build launches native sub-agents in the BACKGROUND (`status: async_launched`, agentId in the tool_response object); PostToolUse is the launch, the `SubagentStop` hook (field `agent_id`) is the end. Sub-agents share the lead's permission list; our lock hook / FixtureGate / patches do not see their tools.
- Still open from the list above: the dead mod branch in `harness_own_custom/runner/claude.ts`.

## A3: native stock subagents ("Backend N", inside f1)
- // TODO: defined (`f1_multiagent/harness/core/launch.ts:63-75`) and only unit-tested (`self_test/multi.ts:160-161`, key count + env values). Never launched: no `HARNESS_BACKEND`, `runLead` has no `--agents` hook (`lead.ts:17`).
- `Agent` is not in `--tools` / `--allowedTools`, and `dontAsk` refuses it. ref `f1_multiagent/harness/core/base/runner.ts:76-81`
- Harness mechanisms do not see native calls: registry rows, locks, worktrees, patches, fixture gate, `max_agent_calls`, cost ledger, and `judgeTurn` (reads `store.calls`).
- Written reason f1 uses its own CLI (Loopferry plan, outside the repo): persistence across our processes "Unproven"; spend guard, kill, cancel only through events. ref `/home/gr/projects/loopferry/handbook/PLANS/20261105_ARCHITECTURE_PLAN.md:500-502, 606-616, 1364-1365`
- // ERROR: that plan contradicts itself on P1 ("Not verified" line 495 vs "Pass" line 1143).
- // ImprovementsNeeded: no decision record inside f1's own docs (`dependency.md`, `README.md`, `PROGRESS.md`). Add a short one in f3 docs.
