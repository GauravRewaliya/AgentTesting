// Free tests of the lead's mod (no model call): `claude plugin test <plugin folder>` (run it on the built folder: core/.build/team-lead.*; self_test/approach_a3.ts does).
import { expect, mock, test } from 'claude-code/testing'

test('the guard refuses a secret and stays out of the way of a normal file', async ($, on) => {
  mock.env(on, { HARNESS_CWD: '/work/ws' })
  on('tool.call', { tool: 'Read' }, () => ({ result: { type: 'text' as const, file: { filePath: '/work/ws/run_test/a.txt', content: 'hi', numLines: 1, startLine: 1, totalLines: 1 } } as any }))   // beneath the plugin: stands for the engine's own Read
  const denied = await $.tool.call({ tool: 'Read', file_path: '/work/ws/.env' })
  expect(denied.deny).toContain('private')
  const ok = await $.tool.call({ tool: 'Read', file_path: '/work/ws/run_test/a.txt' })
  expect(ok.deny).toBeUndefined()
})

test('a shell command cannot start an agent', async ($, on) => {
  mock.env(on, { HARNESS_CWD: '/work/ws' })
  const denied = await $.tool.call({ tool: 'Bash', command: 'team agent builder --objective x' })
  expect(denied.deny).toContain('Agent tool')
})
