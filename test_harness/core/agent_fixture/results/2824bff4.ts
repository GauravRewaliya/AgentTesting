import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "pd-slack-layout",
  title: "In the Pipedream components repo, how is the slack_v2 component laid o",
  description: "Recorded answer: In the Pipedream components repo, how is the slack_v2 component laid out: folders, app file, actions, sources, common?",
  expected_input: {
    text: "In the Pipedream components repo, how is the slack_v2 component laid out: folders, app file, actions, sources, common?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "components/slack_v2/ (80 files at master; the old components/slack folder no longer exists, the app is slack_v2):\n- slack_v2.app.mjs: the app file (type \"app\", app \"slack_v2\"): propDefinitions (user, conversation, text, blocks ...) + methods (sdk() -> @slack/web-api WebClient, makeRequest, retries).\n- package.json (@pipedream/slack_v2), README.md (user-facing overview and account connect steps).\n- actions/<action-name>/<action-name>.mjs, one folder per action, plus actions/common/ (send-message.mjs, build-blocks.mjs) shared by several actions.\n- sources/<source-name>/<source-name>.mjs + test-event.mjs (sample emitted event), plus sources/common/ (base.mjs, base-polling.mjs, constants.mjs).\n- common/ (constants.mjs, utils.mjs) shared by actions and sources.\n(Source: files read from PipedreamHQ/pipedream master, components/slack_v2.)",
} satisfies ResultModule;
