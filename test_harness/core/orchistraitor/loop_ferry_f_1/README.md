> **DEPRECATED (2026-11-20)**: see DEPRECATED.md in this folder. The live engine is ../f3_multiagent.

# loop_ferry_f_1: the new harness WITHOUT multi-agent (test 1)

Prototype + test of the architecture in `handbook/PLANS/20261105_ARCHITECTURE_PLAN.md`, the flow every task uses by default:
**plan -> build -> review**, a reviewer issue goes back to the planner then the builder, until satisfied or a person is needed.
Each role is its own persistent `claude -p` session (resumed with `--resume`, never re-told what it already knows).

```
loop_ferry_f_1/
├─ harness/                        the code under test (stages and all, kept in the harness)
│  ├─ main.ts                      bun harness/main.ts check | graph | run --repo <dir> --request "..." [--check "cmd"]
│  ├─ pipelines/default.json       the pipeline as data (stages, `when`, on_issue, approval)
│  ├─ agents/<role>/               planner, builder, reviewer: one folder each
│  │   ├─ agent.json               role, description, model, session, writes, max_children, agents[], tiers
│  │   └─ .claude/                 CLAUDE.md (the prompt), settings.json (tools), skills/, plugins/, agents/ (EMPTY: filled at run time)
│  └─ core/                        types, store (registry+ledger+events in one JSON file), agents (load + agents:check),
│                                  sessions (the session rule), briefs (what is sent), stages (pure: which stages, decide()),
│                                  runner (RealRunner = claude -p, ScriptRunner = offline), call (callAgent), checks, loop (runTask)
└─ test/f_1.ts                     the test (+ lib.ts, test_report.md)
```

## Run
```
bun test/f_1.ts            offline: scripted agents through the REAL harness code (free, ~1 s)      28 checks
bun test/f_1.ts --real     also real claude -p haiku sessions in temp git repos (~13 calls, a few cents)
node ../../../../node_modules/typescript/bin/tsc -p tsconfig.json     type check (syntax: bun build --no-bundle <file>)
```

## What it proves
- Offline F1-F17: happy path, issue loop with the SAME sessions resumed and delta-only prompts, stuck detection (same finding twice),
  max rounds, `conflicts_with_request` goes to a person without another build, failing deterministic check beats a passing reviewer,
  a planner cannot waive a failing check, two tasks never share rows/sessions, session cap rolls to a new session visibly,
  follow-up request resumes all three roles, agent failure and spend cap halt, no-verdict is never a pass, minor note does not block,
  pipeline as data (T2 skips plan, T4 waits for approval), `agents:check` (missing callee, cycle, write tool on a read-only agent).
- Real R1-R4: the loop ends on a deterministic check; each role has a persistent session and its transcript exists; the CLI used the session id
  the harness chose; a follow-up resumes the same sessions with a shorter prompt; the builder recalls request 1 from its own session;
  task B has its own sessions and does not know task A; R4 sends work around the loop once if the (hidden) check disagrees.

## Limits (be careful trusting the green)
- A JSON file stands in for Postgres; one process at a time. Haiku only. No sandbox, no Worker, no GitHub, no spend guard.
- The real suite passes `rounds=1` when haiku gets it right first time; the issue loop with real agents is only forced best-effort (R4).
- `Bash(node *)`/`cat`/`ls` are allowed to the builder; the real product has the sandbox for that.
