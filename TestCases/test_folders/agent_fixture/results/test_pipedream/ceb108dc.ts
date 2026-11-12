import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "pd-slack-source",
  title: "How does a Slack source like new-message-in-channels work in the Piped",
  description: "Recorded answer: How does a Slack source like new-message-in-channels work in the Pipedream components repo?",
  expected_input: {
    text: "How does a Slack source like new-message-in-channels work in the Pipedream components repo?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "A source is a component with type \"source\" that emits events. new-message-in-channels.mjs spreads ...common from sources/common/base.mjs, sets key \"slack_v2-new-message-in-channels\", type \"source\", dedupe \"unique\", and props (conversations picked via the app's \"conversation\" propDefinition).\nbase.mjs gives props { slack, db: \"$.service.db\" } and methods (a name cache kept in db, cleaned on a timer). Its run(event) calls processEvent(event) (each source overrides it) and then this.$emit(event, { id, summary, ts }).\ntest-event.mjs holds a sample event used for the UI preview.\n(Source: files read from PipedreamHQ/pipedream master, components/slack_v2/sources.)",
} satisfies ResultModule;
