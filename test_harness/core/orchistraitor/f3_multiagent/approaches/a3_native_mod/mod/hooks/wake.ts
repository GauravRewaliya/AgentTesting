// Wake-up and interrupt (OFF unless the environment says A3_WAKE=1: an extra turn costs a model call, so tests keep it off): while the session sits idle, a timer asks the core `_pending` whether the person
// wrote, or a background sub-agent finished; if so it queues a short prompt (`$.prompt.submit`) and the `prompt.submit` hook of context.ts fills it with what is new. Replaces a lead polling `wait`.
import { cli } from './cli'

/** Called by the one session.start hook (register.ts). */
export async function armWake($: any) {
  if ((await $.env.get('A3_WAKE')) !== '1') return
  let since = Date.now()
  $.clock.every(10_000, async () => {
    const p = await cli($, ['_pending', '--since', String(since)])
    if (((p.notes as number) ?? 0) > 0 || ((p.done as string[]) ?? []).length > 0) { since = Date.now(); await $.prompt.submit({ text: 'New in the team: see the context above, then continue.' }) }
  })
}
