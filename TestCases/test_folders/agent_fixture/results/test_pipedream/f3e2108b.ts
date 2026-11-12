import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "mod-block-tool",
  title: "Write a Claude Code mod hook that blocks the Bash tool when the comman",
  description: "Recorded answer: Write a Claude Code mod hook that blocks the Bash tool when the command contains rm -rf.",
  expected_input: {
    text: "Write a Claude Code mod hook that blocks the Bash tool when the command contains rm -rf.",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "In hooks/register.ts: export const register: Register = (on) => { on('tool.call', { tool: 'Bash' }, async ($, e, next) => { if (/rm\\s+-rf/.test(String(e.input.command))) return { deny: 'rm -rf is blocked by this mod' }; return next(e); }); };\nA hook that returns without next answers for itself; { deny } blocks the call; next(e) lets the rest run. Check with claude plugin validate <mod folder>. (Shape taken from the guidance's tool.call row; the exact field name e.input.command is not verified here.)",
} satisfies ResultModule;
