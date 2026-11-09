import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "pd-slack-core",
  title: "How does the slack_v2 component work at its core: the app file, propDe",
  description: "Recorded answer: How does the slack_v2 component work at its core: the app file, propDefinitions, methods, and how an action like Send Message to Channel uses them?",
  expected_input: {
    text: "How does the slack_v2 component work at its core: the app file, propDefinitions, methods, and how an action like Send Message to Channel uses them?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "App file = the one place that talks to Slack. It exports { type: \"app\", app: \"slack_v2\", propDefinitions, methods }. propDefinitions are reusable prop specs (conversation, text, mrkdwn, blocks ...). methods hold the API access: sdk() builds a WebClient from the connected account token; makeRequest wraps calls with retries.\nAn action imports the app and declares props: { slack, conversation: { propDefinition: [slack, \"conversation\"] }, text: {...} }. send-message-to-channel.mjs spreads ...common (actions/common/send-message.mjs), sets key \"slack_v2-send-message-to-channel\", name, description, version \"0.3.2\", annotations (destructiveHint/openWorldHint/readOnlyHint), type \"action\", ai \"optimized\", and reuses the shared props and run().\nPattern: action (props + run) -> app file method -> Slack API. Credentials never appear in the action.\n(Source: files read from PipedreamHQ/pipedream master, components/slack_v2/{slack_v2.app.mjs,actions/send-message-to-channel}.)",
} satisfies ResultModule;
