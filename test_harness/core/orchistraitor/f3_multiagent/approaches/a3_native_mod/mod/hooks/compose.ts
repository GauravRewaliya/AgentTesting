// The lead's agent list as a SYSTEM PROMPT SECTION (`prompt.compose`), not as text appended to a file: one place (the build writes config.ts from the agent declarations), cache boundary placed by the engine.
import type { On } from 'claude-code'
import { CFG } from './config'

export function registerCompose(on: On) {
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return CFG.agents ? { sections: [...r.sections, { id: 'team:agents', text: CFG.agents, scope: 'session' as const }] } : r
  })
}
