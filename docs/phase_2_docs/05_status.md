# 05 Status (2026-11-13)

## Done
- Planning approach agreed: dynamic, master decides, planner plans with the user, FE team builds the prototype on the fly.
- Lead prompt: planning section added (`harness/agents/lead/.claude/CLAUDE.md`).
- Planner: can call `ux-designer` and `builder`; "product planning" section in its prompt (`harness/agents/planner/`).
- Docs: `docs/planning/README.md` and `docs/PHASES.md` reworded as guidance, not locks.
- Test suite `real_planning_prototype`: 6 real cases (no fixtures), expectation comment, `--fake` PASS.
- `test_harness/scripts/check_plan_links.ts`: free link check for plan folders.
- `test_harness/scripts/check_phases.ts`: n+1 waits for n; lead prompt (phases, WHY in every hand-over, fewer turns).
- Free check `scripts/check_fixtures.ts`: 0 missing.

## Open
- A first real run of the two `real_` cases (cost: credits, sandbox).
- TODO items: 2.b (LSP and type checks for builders, agent lookup), 2.c (more lead prompt work: tell each agent WHY, fewer turns), 2.d (end-to-end case).
- Nothing is committed (your rule: you commit and push).

## Tools (2026-11-13)
- builder / ux-designer: `Read, Write, Edit, Glob, Grep, Bash` (plain Bash: mv, git, pnpm, tsc...). qa-reviewer and planner stay restricted (read-only).
- LSP WORKS via plugin `harness/plugins/ts-lsp` (tested: findReferences, hover). No diagnostics op, so `pnpm exec tsc --noEmit` stays for type errors. See PROJECT_MEMORY.
- Agents share one workspace; writers get a git worktree + file locks (`--writes`); builder prompt forbids git stash/reset/commit; refused tool/command -> `NEEDS_PARENT:`.
- Agents do not read a project's own `.claude` (runner uses `--setting-sources ""`).

## Docker (2026-11-13)
Image `agent-testing-claude:1` rebuilt: Node 22 default, Node 20 + 24 via `fnm` (`fnm exec --using=20 pnpm ...`, `.nvmrc` via `--using=file`), tsc 5.9.3, typescript-language-server, Claude Code 2.1.322, pnpm 12. Agents that delegate (planner, builder, lead, pm) run on the host (`sandboxable` in `docker_runner.ts`); their LSP server is started in the image by `plugins/ts-lsp/lsp.sh`, so nothing is installed on the host. Tested 2026-11-13 on a project without its own typescript: findReferences and hover work.
