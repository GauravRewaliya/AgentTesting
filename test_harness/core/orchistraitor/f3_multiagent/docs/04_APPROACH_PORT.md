# 04 The Approach port (pseudo code, not real code)

```ts
// approaches/approach_port.ts
export interface Approach {
  name: "a1_team_cli" | "a2_mod" | "a3_native" | string
  // `no` carries a NOT_POSSIBLE note; a case that needs it is skipped with a warning
  capabilities: Record<Capability, "ok" | "partial" | "no">

  // 1. launch the lead
  launchLead(ctx: LeadCtx): { args: string[]; env: Record<string, string>; promptFiles: string[]; tools: string[] }
  //   a1: --tools Bash, --allowedTools "Bash(team *)", env HARNESS_*   // ref: f1_multiagent/harness/lead.ts:14-47, harness/core/base/runner.ts:74-81
  //   a2: --plugin-dir <mod>, stock tools incl. Agent + SendMessage      // ref: harness_own_custom/README.md "Approach"
  //   a3: --agents <json>, env nativeEnv()                               // ref: f1_multiagent/harness/core/launch.ts:63-75

  // 2. lead -> core
  decode(raw: LeadCall): CallReq | Deny
  //   a1: parse `team delegate` flags;  a2: tool_input of Agent{...} / SendMessage{...}

  // 3. core -> lead
  encode(res: CallRes, req: CallReq): LeadReply
  //   a1: one JSON line;  a2: the Agent tool's result shape   // ERROR: a Claude Code update can reject it (harness_own_custom/README.md:115)

  // 4. prompts the lead sees
  prompts(ctx: LeadCtx): PromptSet
  //   a1: lead CLAUDE.md + sub-agent declarations + team tools;  a2: system_prompt.md rules

  // 5. optional extras
  extraTools?(): ToolSpec[]
  //   a1: wait, plan_submit, phase_pass, apply_patches, peek, ...   a2/a3: // NOT_POSSIBLE:
}
```

```ts
// core/delegate.ts  (shared by every approach)
function delegate(req: CallReq): CallRes {
  const g = agentCall(store, defs, policy, req)          // ref: f1_multiagent/harness/core/agent_call.ts
  if (!g.ok) return g
  return agent.fixtures
    ? FixtureGate.serve(req, g)                          // ref: f1_multiagent/harness/core/fixture_gate.ts
    : callee.run(g)                                      // ref: f1_multiagent/harness/core/callee.ts
}
```

Flow for any approach: `lead call -> approach.decode -> core.delegate -> approach.encode -> lead`.

## Capability matrix (planned)
| Capability | A1 | A2 | A3 |
|---|---|---|---|
| spawn / follow-up | ok | ok (follow-up faked) | ok |
| async + wait | ok | // NOT_POSSIBLE: | // NOT_POSSIBLE: |
| fork session | ok | // NOT_POSSIBLE: | // NOT_POSSIBLE: |
| write locks + worktrees + patches | ok | // NOT_POSSIBLE: | // NOT_POSSIBLE: (native only has `isolation: worktree`) |
| phase gates / plans | ok | // NOT_POSSIBLE: | // NOT_POSSIBLE: |
| budget / kill switch | ok | // NOT_POSSIBLE: | // NOT_POSSIBLE: |
| tests a stock lead calling `Agent` | // NOT_POSSIBLE: | ok | ok |

The pattern (skip with warning when a case needs a `no` capability) already exists in `harness_own_custom/capabilities.ts` and `skip_test.ts`.
