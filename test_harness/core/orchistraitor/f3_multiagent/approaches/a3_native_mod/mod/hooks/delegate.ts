// Agent / SendMessage: answered by the shared `delegate` (checks, fixtures or a real callee, locks, budget) with a REAL tool result. While a call blocks, a timer ticks the monitor
// every 15 s (a nudge at 6 min, a stop for an agent silent 10 min): the work `team agent wait` does for a background call.
import type { On } from 'claude-code'
import { cli, TOOLS, type Json } from './cli'

/** A gate: if the mod itself fails, the call is REFUSED, never handed on to Claude's own engine (it would start a real sub-agent). A top-level function: the engine reads a .catch handler by name only from here. */
function failed($: any, e: any, next: any) {
  return next.called ? next(e) : { deny: 'AGENT REFUSED: the team mod failed, nothing was started. Tell the person.' }
}

/** The shape the engine checks an Agent result against (status completed + usage ...); `text` is what the lead reads. */
const answer = (e: { prompt?: string }, agentId: string, text: string) => ({
  result: {
    status: 'completed' as const, agentId, prompt: String(e.prompt ?? ''), content: [{ type: 'text' as const, text }],
    totalToolUseCount: 0, totalDurationMs: 0, totalTokens: 0,
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null, server_tool_use: null, service_tier: null, cache_creation: null },
  },
})

/** A call to a sub-agent: new (Agent), or continuing one (SendMessage: --session <agent_id>, the core finds the role). */
async function call($: any, e: any, role: string, session: string, text: string) {
  // a native call has no `writes` field: the lead names the paths a builder owns on a `WRITES:` line of the hand-over
  const hint = /^\s*WRITES:\s*(.+)$/im.exec(text)?.[1]?.split(/[,\s]+/).map((x) => x.trim()).filter((x) => x.startsWith('run_test/'))
  const bg = e.run_in_background === true, model = ['sonnet', 'haiku'].includes(String(e.model ?? '')) ? ['--model', String(e.model)] : []
  const args = ['delegate', ...(role ? ['--role', role] : []), '--session', session, '--objective', text,
    '--output', 'Your final answer: what you did, the files you wrote, what you could not do or check.', '--boundaries', 'As written in the hand-over; nothing else.',
    ...(bg ? ['--async'] : []), ...model, ...(hint?.length ? ['--writes', hint.join(',')] : [])]
  const timer = $.clock.every(15_000, () => { void $.process.run([...TOOLS, '_tick']) })   // the monitor, while this call blocks
  let j: Json; try { j = await cli($, args) } finally { timer.cancel() }
  const id = j.agent_id ?? '?'
  if (j.ok && (j.async || j.queued)) return answer(e, id, `AGENT STARTED in the background (agentId: ${id}${j.queued ? ', queued: its files are locked by another agent, it starts by itself' : ''}). Keep working. Collect the answer with the wait tool (agents: ["${id}"]). Do NOT call it again.`)
  if (j.ok === false && /stopped/.test(j.error ?? j.reason ?? '')) return answer(e, id, `AGENT STOPPED (${role || id}): it was stopped, by the harness after a long silence or by the person. Its files are kept: look at them (ls / read_file) before you start another agent for the same work.`)
  if (j.ok === false && !j.summary) return { deny: `AGENT REFUSED: ${j.reason ?? j.error ?? 'the call was refused'}` }
  return answer(e, id, `${j.summary ?? ''}${j.needs_parent ? `\nNEEDS_PARENT: ${j.needs_parent}` : ''}${j.error ? `\n[error: ${j.error}]` : ''}`)
}

export function registerDelegate(on: On) {
  on('tool.call', { tool: 'Agent' }, ($, e) => {
    const role = String(e.subagent_type ?? '')
    return role ? call($, e, role, 'new', String(e.prompt ?? '')) : { deny: 'AGENT REFUSED: subagent_type is missing. Use one of the listed agent types.' }
  }).catch(failed)
  on('tool.call', { tool: 'SendMessage' }, ($, e) => call($, e, '', String((e as any).to ?? ''), String((e as any).message ?? ''))).catch(failed)
}
