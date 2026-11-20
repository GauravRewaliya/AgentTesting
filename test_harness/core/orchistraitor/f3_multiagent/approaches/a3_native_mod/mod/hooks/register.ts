// THE a3 MOD (Claude Code's own plugin runtime, loaded with --plugin-dir; harness/leadkit/build.ts copies this folder and writes config.ts next to it). One file per job, this file only wires them:
//   delegate.ts  Agent / SendMessage -> the shared core, real tool result, monitor tick while it blocks      team.ts     the `team` commands as typed tools (mcp__team__*)
//   context.ts   per-turn context (notes, running sub-agents, bg tasks, digest)                              wake.ts     wake-up / interrupt timer (A3_WAKE=1)
//   compose.ts   the agent list as a system prompt section                                                   guard (here)  the lite guard for Read / Glob / Grep / Bash
// Identity (HARNESS_STORE / TASK / AGENT ...) is in the process environment, which `$.process` children inherit.
import type { Register } from 'claude-code'
import { CFG } from './config'
import { registerCompose } from './compose'
import { registerContext } from './context'
import { registerDelegate } from './delegate'
import { registerTeam, registerTools } from './team'
import { armWake } from './wake'
import { liteGuard } from './guard'

export const register: Register = on => {
  registerDelegate(on)
  registerTeam(on)
  registerContext(on)
  on('session.start', async ($: any, e: any, next: any) => {   // the ONE session.start hook: the typed tools, then the wake-up timer
    await registerTools($)
    await armWake($)
    return next(e)
  })
  registerCompose(on)
  for (const tool of ['Read', 'Glob', 'Grep', 'Bash'] as const)
    on('tool.call', { tool } as any, async ($: any, e: any, next: any) => {
      const v = liteGuard({ tool_name: tool, tool_input: e }, CFG.guard as any, { workspace: (await $.env.get('HARNESS_CWD')) ?? '' })
      return v.allow ? next(e) : { deny: v.reason }
    }).catch(($: any, e: any, next: any) => (next.called ? next(e) : { deny: 'GUARD: the check failed, nothing is allowed until it works' }))
}
