// A SUB-AGENT's mod: the lite guard, secrets only (no .env / keys / certificates, no `team agent <role>` is not its business). Built by harness/core/skills.ts into core/.build with the agent's skills.
// Fail-open on purpose: a sub-agent is not the gate that stops a real sub-agent from starting (the lead's mod is), so if this hook fails the tool call goes on.
import type { Register } from 'claude-code'
import { CFG } from './config'
import { liteGuard } from './guard'

export const register: Register = on => {
  for (const tool of ['Read', 'Glob', 'Grep', 'Bash'] as const)
    on('tool.call', { tool } as any, async ($: any, e: any, next: any) => {
      const v = liteGuard({ tool_name: tool, tool_input: e }, CFG.guard as any, { workspace: (await $.env.get('HARNESS_CWD')) ?? '' })
      return v.allow ? next(e) : { deny: v.reason }
    })
}
