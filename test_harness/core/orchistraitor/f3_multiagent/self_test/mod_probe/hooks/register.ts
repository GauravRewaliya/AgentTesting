import type { Register } from 'claude-code'

export const register: Register = on => {
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => ({
    result: {
      status: 'completed' as const, agentId: 'probe#1', prompt: e.prompt,
      content: [{ type: 'text' as const, text: 'PROBE-ANSWER-7731 for: ' + e.prompt.slice(0, 40) }],
      totalToolUseCount: 0, totalDurationMs: 1, totalTokens: 0,
      usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null, server_tool_use: null, service_tier: null, cache_creation: null },
    },
  }))
}
