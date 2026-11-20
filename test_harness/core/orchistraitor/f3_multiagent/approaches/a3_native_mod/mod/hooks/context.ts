// Per-turn context: before the lead reads a message, the core (`_context`, harness/core/turn_context.ts) says what is new: unread notes and the person's messages, the sub-agents running now,
// background tasks, and on the first turn the team digest. This hook only injects the text. a1 / a2 gave the digest on the first turn only and notes only after a tool call.
import type { On } from 'claude-code'
import { cli } from './cli'

let turns = 0   // this module's own counter: the first turn of the session gets the team digest too

export function registerContext(on: On) {
  on('prompt.submit', async ($, e, next) => {
    const first = turns++ === 0
    const r = await cli($, ['_context', ...(first ? ['--first'] : [])])
    return next(r.text ? { ...e, text: `${r.text}\n\n${e.text}` } : e)
  }).catch(($: any, e: any, next: any) => next.called ? next(e) : next(e))
}
