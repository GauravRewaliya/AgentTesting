# harness_own_custom: stand-in for the sub-agents

**Short info:** the lead is a real `claude -p` (haiku) that thinks it calls sub-agents; this harness answers instead from recorded results (mod `.claude/mods/interrupt` via `--plugin-dir`, state in `.state/harness.jsonl`). It tests **how the lead hands work over and how sessions behave**, not what sub-agents can do.

**Approach:** spawn -> new session; send -> same session only; every step is an event. Lookup order: keywords+agent, then similarity to expected input (>= 0.15), else NOTFOUND. Guard: forbidden agent stops, unknown type retries. Cases do not assert: EXPECTED is printed next to ACTUAL and a person (or Claude) judges. Rules R1-R4 are checked offline (`bun test`).

## Passing (+ve)
- R1-R4 hold (new session per spawn, send continues only that session, sessions never see each other, every step is an event).
- Supported OK: spawn, sequential, session isolation, restart from log, lead resume, keyword lookup, NOTFOUND, guard (forbidden, unknown type, roles), persistence.
- Cheap: sub-agent cost is zero by design; `--real` adds real memory at ~$0.001 per case.

## Failing / weak (-ve)
- Not supported (cases skipped with a warning): nested sub-agents, background agents, real sub-agent edits/tools, git worktree, compaction, sub-agent token budget, auto verdict, repeat runs.
- Can falsely pass: follow-up memory is a template (guaranteed by code); sub-agent never fails, times out or edits files itself; files are written by the harness.
- Can falsely fail or mislead: small lead varies run to run (one run per case, no flakiness stats); similarity can pick a near-miss, keyword results shadow each other; NOTFOUND makes the lead do the work itself.
- Plumbing: a Claude Code update can break the mod's reply shape; `--real` is a different path; `.state/` is shared and can leak stale ids.
