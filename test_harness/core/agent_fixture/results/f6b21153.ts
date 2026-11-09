import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "pd-create-component",
  title: "How do I create a new Pipedream component (an action) in the component",
  description: "Recorded answer: How do I create a new Pipedream component (an action) in the components repo? What files and fields does it need?",
  expected_input: {
    text: "How do I create a new Pipedream component (an action) in the components repo? What files and fields does it need?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "1. Folder components/<app>/ with package.json (name @pipedream/<app>, version, main <app>.app.mjs, dependencies incl. @pipedream/platform) and <app>.app.mjs (the app file with propDefinitions + methods that call the API).\n2. actions/<action-name>/<action-name>.mjs exporting default { key: \"<app>-<action-name>\", name, description (end with [See the documentation](url)), version \"0.0.1\", type: \"action\", props: { <app>, ...propDefinition refs }, async run({ $ }) { ...; $.export(\"$summary\", \"Successfully ...\"); return response; } }.\n3. API calls go through an app-file method, not inline in run().\n4. Bump the component version and the package version on every change.\nExample to copy: components/github/actions/create-issue/create-issue.mjs.\n(Derived from reading the repo files; the official docs were not fetched.)",
} satisfies ResultModule;
