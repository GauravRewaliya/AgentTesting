// The `team` commands as TYPED TOOLS (`mcp__team__<name>`): registered once at session.start from the shared list (team_tools.ts), served by running the same CLI. No Bash for the lead,
// no shell quoting, no command list in every turn (the schemas load on demand). Every tool is a thin call of `tools.ts <command> --flag value`; nothing else happens here.
import type { On } from 'claude-code'
import { cliText } from './cli'
import { listed, toArgv } from './team_tools'

/** Called by the one session.start hook (register.ts): the engine allows one unmatched hook per event. */
export async function registerTools($: any) {
  for (const t of listed()) await $.tool.register({ name: t.name, description: t.description, inputSchema: { type: 'object', properties: t.props, ...(t.required ? { required: t.required } : {}) }, isDeferred: false })
}

export function registerTeam(on: On) {
  for (const t of listed())
    on('tool.run', { tool: 'mcp__team__' + t.name } as any, async ($: any, e: any) => {
      const argv = toArgv(t.name, e as Record<string, unknown>)
      if ('error' in argv) return { deny: argv.error }
      return { result: (await cliText($, argv)) || JSON.stringify({ ok: false, reason: 'no output' }) }
    }).catch(($: any, e: any, next: any) => (next.called ? next(e) : { deny: 'the team tool failed, nothing ran' }))
}
