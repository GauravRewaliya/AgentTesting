# harness_own_custom

```
harness_own_custom/
├─ core/   the harness itself: main.ts, interface.ts, system_prompt.md, agent_prompt.md, .claude/mods/interrupt (the mount)
└─ test/   its tests and reports: harness.test.ts, capabilities.ts, skip_test.ts, judgements.json, make_report.ts, test_report.md
```

The part of Test_agent_3 that stands in for the sub-agents. The lead (a real `claude -p`) thinks it is calling
sub-agents; this harness answers instead, from recorded results, so we test **how the lead hands work over and how
sessions behave**, not what the sub-agents can do.

## Approach (one page)

```
lead (claude -p, haiku)
  │ Agent{subagent_type, prompt}  /  SendMessage{to, message}
  ▼
.claude/mods/interrupt   (loaded with --plugin-dir; answers the tool call itself, no sub-agent starts)
  │  guard: forbidden agent -> GUARD stop | unknown type -> GUARD-RETRY (lead retries, not counted)
  ▼
main.ts  Harness   spawn -> NEW session (fresh id) | send -> SAME session only | every step = event in .state/harness.jsonl
  │  Interceptor hooks (interface.ts): onSpawn / onSend / onEvent  <- where we step in
  ▼
lookup:  results/<id>.ts by keywords+agent, else similarity to expected_input.text (>= 0.15), else NOTFOUND
  ▼
result.run(req)   cp from agent_fixture/store, req.write(...), return the reply text   (the only thing a result has)
```

Rules the harness keeps (R1-R4, checked offline by `bun test core/harness_own_custom`):
R1 spawn always makes a new session · R2 send continues that session only · R3 sessions never see each other · R4 every step is an event.

Cases do not assert. Each says `expected: { context, expected_agents_res }` in plain text; `core/report.ts` prints
EXPECTED next to ACTUAL and a person (or Claude) judges.

## What it supports (tree; source of truth is `capabilities.ts`, print it with `bun core/harness_own_custom/capabilities.ts`)

```
harness_own_custom
├─ multiagent
│  ├─ spawn [ok] new session + id per spawn
│  ├─ sequential [ok]
│  ├─ parallel [partial] separate one-shot CLI calls; no real concurrency test
│  ├─ nested [no] a sub-agent cannot call the harness
│  └─ background [no] every call is answered at once
├─ sandbox
│  ├─ files [partial] written by the recorded run(req); the sub-agent never edits or runs anything
│  ├─ tools [no] no Edit/Write/Bash by a sub-agent, so no permission prompts or denials
│  ├─ persistence [ok] run_test + checkpoint copy
│  └─ worktree [no] by design one workspace per main agent, shared by its sub-agents; no git worktree/branch
├─ session
│  ├─ isolation [ok] R1, R3
│  ├─ followup [partial] reply is a template over the history, not a model
│  ├─ restart [ok] rebuilt from .state/harness.jsonl
│  ├─ compaction [no] no long-history / context-limit behaviour
│  └─ lead_resume [ok] --resume of the `after` checkpoint
├─ lookup
│  ├─ keywords [ok]
│  ├─ similarity [partial] threshold 0.15 may pick a near-miss
│  └─ notfound [ok] NOTFOUND + miss event
├─ guard
│  ├─ forbidden [ok]
│  ├─ unknown_type [ok]
│  └─ roles [ok] role order, required facts and minimum hand-over size per role (core/guard.ts, rules per case)
├─ subagent_cost [no] zero by design
├─ judging
│  ├─ auto_verdict [no] by design: a person / Claude judges
│  └─ repeat_runs [no] one run per case
└─ claude_code_build
   └─ agent_result_shape [partial] an update can break the mod's reply shape
```

A case lists what it relies on: `needs: ["session.followup", ...]`. The runner then:
`no` -> the case is **skipped** with `WARNING NOT SUPPORTED by this harness: ...`; `partial` -> it runs with a `WARNING partial: ...`;
an unknown path -> skipped as a typo.

## skip_test (scenarios we never run here)

List lives in `skip_test.ts`; the runner skips these ids and prints the reason.

```
skip_test = [
  nested_subagents ............... needs multiagent.nested    a sub-agent is a lookup, it cannot spawn another
  background_agent_status ........ needs multiagent.background every call is answered at once
  subagent_edits_files_for_real .. needs sandbox.tools         no Edit/Write/Bash by a sub-agent: permission and persistence bugs cannot show
  worktree_isolation ............. needs sandbox.worktree      by design per main agent only (sub-agents share it); no git worktree/branch
  long_session_compaction ........ needs session.compaction    history is never trimmed or summarised
  subagent_token_budget .......... needs subagent_cost         sub-agent cost is zero by design
  lsp_rename_define_lookup ....... (lead-only)                 tests the lead's own LSP use, not hand-over
]
```

## Loopholes and weaknesses (read before trusting a green run)

```
what it can falsely pass
├─ follow-up memory is faked
│  └─ the reply is a template over the session history, so "the sub-agent remembers" is guaranteed by code, not tested
│     (real sessions can forget, truncate or confuse; use `--real` for real memory, it costs ~$0.001 per case)
├─ the sub-agent never fails by itself
│  ├─ it always returns the recorded text at once: no timeouts, partial work, retries, rate limits
│  └─ the only failure we can inject is a recorded ERROR text (wf_5) or NOTFOUND
├─ files are written by the harness, not by an agent
│  └─ permission denials, wrong paths, files outside run_test, lost writes can never happen
what it can falsely fail or mislead
├─ the lead is a small model (haiku) and varies run to run
│  ├─ one run per case; a green run may be luck, a red one may be noise (no repeat/flakiness stats)
│  └─ it needs the system prompt rules (answers are final, only listed agent types) or it verifies, goes deeper, picks Explore
├─ lookup can hit the wrong result
│  ├─ similarity (bag of words, threshold 0.15, hand-tuned stoplist) can return a near-miss; a rewritten hand-over can fall below it
│  └─ keyword results shadow each other (first match wins; a second builder call about "signup" re-serves the first result)
├─ mock results must look like normal work (tool count > 0) or the lead distrusts them and sends follow-ups
├─ NOTFOUND makes a small lead try to do the work itself (it may call another agent type or answer alone)
coupling and plumbing
├─ the mod returns the Agent tool's full output shape; a Claude Code update can reject it (the error is explicit)
├─ `--real` mode is a different path (thin real sub-agent via core/interpose.ts): do not mix its numbers with mod mode
├─ state: .state/ checkpoints and harness.jsonl are shared by all suites; stale ones can leak ids (delete .state/<id> to rerun fresh)
├─ parallel Agent calls run as separate bun processes reading the same log: ids stay unique, but ordering is not tested
└─ nothing is committed or isolated per run: run_test is wiped, .state is not
```

## Add a scenario the harness cannot handle yet

1. Add the missing capability as a node in `capabilities.ts` with status `no` (and a note), and mirror it in the tree above.
2. Put the case id in `skip_test.ts` with the reason (or give the case `needs: ["that.path"]`: it will be skipped with a warning).
3. When the harness learns it, flip the node to `ok`/`partial` and remove the skip row.
