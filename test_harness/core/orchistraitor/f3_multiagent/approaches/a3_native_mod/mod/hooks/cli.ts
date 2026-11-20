// The one way the mod reaches our core: the shared CLI (`harness/tools.ts <command> ...`). A stream, so a long call is not cut at the ten minutes `$.process.run` allows.
import { CFG } from './config'

export type Json = { ok?: boolean; async?: boolean; queued?: boolean; summary?: string; error?: string; reason?: string; agent_id?: string; needs_parent?: string; text?: string; [k: string]: unknown }
export const TOOLS = ['bun', '--smol', CFG.tools]

/** Run one command to its end and return its stdout. */
export async function cliText($: any, args: string[]): Promise<string> {
  let out = ''
  for await (const piece of $.process.spawn({ argv: [...TOOLS, ...args] })) out += (piece as any).text ?? ''
  return out.trim()
}

/** The last JSON line a command printed (every command prints one). */
export async function cli($: any, args: string[]): Promise<Json> {
  const line = (await cliText($, args)).split('\n').filter(Boolean).pop() ?? ''
  try { return JSON.parse(line) } catch { return { ok: false, reason: 'the harness gave no answer: ' + (line || 'empty output') } }
}
