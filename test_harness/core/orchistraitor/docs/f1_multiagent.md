# f1_multiagent (`f_1_withmulti_ag`): staged harness + multi-agent on demand

**Short info:** the f1_stage harness plus a **lead** (never writes) that can call more agents (researcher, builder, ...) when work has independent parts. Includes `agent.call` as the one authority for every call, write locks (all-or-none, FIFO, leased), a git worktree per writer returning a patch, a board (notes, chat), a project manager, and a web console (`ui/`, `bun run dev`, port 5174). Off by default (`agentMaxDepth = 1`).

**Approach:** same stages as f1_stage; lead delegates by `session: new | <id> | fork:<id>`; depth limit 4, fan-out and instance limits; epoch discards a stopped run's late result; the person can talk while it works (notes arrive after the agent's next tool call).

## Passing (+ve)
- Offline `self_test/multi.ts`: **167 of 167**. Console: 18 of 18 server checks, 6 of 6 page checks (earlier run).
- Real comparison (haiku, 2 runs each, small sample): research 100% for solo and multi; multi-haiku $0.0055 / 34 s vs solo-haiku $0.0019 / 8 s. Coding pipeline 100%, $0.0063 / 36 s (haiku) vs solo $0.0026 / 16 s.
- Independent work is faster: three researchers ~12 s together vs ~32 s one after another.

## Failing / weak (-ve)
- **Not faster or cheaper on small work** (solo haiku beat it in every row above); worth switching on only for independent parts or live talk.
- Real multi-agent runs (`scenario.ts`, `compare.ts`) not re-run on 2026-11-09; real behaviour unverified today. Some web failures were an outside HTTP 429.
- Open loopholes: `Bash` writes bypass the edit lock (mitigated by worktree + `git status` audit); registry path reachable by `Bash(node *)`; lease lapses under a >120 s thinking step; lead retries/duplicate forks; several lead behaviours fixed by prompt only.
- More moving parts (locks, worktrees, patches, board, PM). Not covered: large repos, sandbox, GitHub, real spend limits, nested real sessions. Prototype only.
