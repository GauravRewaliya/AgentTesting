import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "mod-create",
  title: "How do I create a Claude Code mod, for example a status line entry or ",
  description: "Recorded answer: How do I create a Claude Code mod, for example a status line entry or a pane beside the chat?",
  expected_input: {
    text: "How do I create a Claude Code mod, for example a status line entry or a pane beside the chat?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "A mod is a folder with three files: .claude-plugin/plugin.json ({name, version, description}), hooks/hooks.json ({\"modules\": [\"./register.tsx\"]}) and hooks/register.tsx exporting register: Register = (on, options) => {...} (type from 'claude-code').\nWhat the person asks for -> shape: pane/panel = $.ui.open({id,title}) drawn by a ui.render hook on {component:'Pane'}; band above prompt = ui.render on AbovePrompt; status line = $.ui.status(text); toast = $.ui.toast(text); slash command = $.command.register in session.start + a command.run hook.\nLoad it with claude --plugin-dir <mod folder> (or when the session enables mods). (Source: the plugin-authoring guidance of this Claude Code build; web write-ups call mods 'plugins'.)",
} satisfies ResultModule;
