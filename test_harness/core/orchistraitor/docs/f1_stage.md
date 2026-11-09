# f1_stage (`loop_ferry_f_1`): staged harness, no multi-agent

**Short info:** plan -> build -> review loop. Three roles (planner read-only, builder writes, reviewer read-only), each its own persistent `claude -p` session (`--resume`). A reviewer finding goes to the planner for triage, then back to the builder, until done, stuck, or a person is needed. A ledger (requests, reports, findings) keeps the facts, so losing a session loses tokens, never facts.

**Approach:** workflow decides the order (no model tokens on routine order); pipeline is data (`pipelines/default.json`); tiers T0 (chat) to T4 (person approves); a hook denies deleting protected paths; deterministic check beats a passing reviewer.

## Passing (+ve)
- Offline `f_1.ts`: **38 of 38** (happy path, issue loop with same sessions resumed and delta-only prompts, stuck finding, max rounds, `conflicts_with_request` goes to a person, failing check beats reviewer, session cap rolls visibly, spend cap halts, `agents:check`).
- Real `--index2` (haiku, ~$0.003/run): 41 of 42; copy task in 15 s, `index.html` untouched, bad-review replay kept the work 3 of 3.
- Old flow for contrast: 558 s, $1.81, deleted the wanted file. Staged: ~20 s, $0.003 to $0.004.

## Failing / weak (-ve)
- Real **I1b fails** (twice): after a later message the builder row shows `resume_count=0` and the session says it has no follow-up in its conversation.
- Planner can mark a real finding `out_of_scope` / `duplicate` (dropped, logged, not blocked).
- Parallel work: none (stages run one after another). Prototype only: JSON file instead of Postgres, one process, haiku only, no sandbox/GitHub/spend guard. Product code not built.
- Real suite often passes with `rounds=1`; the issue loop with real agents is only forced best-effort.
