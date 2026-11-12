import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_sb_01_0073f46",
  title: "expo-go: with-storybook phase 1/1 (0073f46)",
  description: "Builds the latest version \"with-storybook at the latest Expo SDK (state of 0073f46: Upgraded Expo SDK to `expo@latest` (#701))\" of expo/examples/with-storybook: with-storybook/.gitignore, with-storybook/.storybook/main.js, with-storybook/.storybook/preview.js, with-storybook/App.js, with-storybook/app.json, with-storybook/package.json, with-storybook/stories/Button.jsx, with-storybook/stories/Button.stories.js, with-storybook/stories/Configure.mdx, with-storybook/stories/Gradient.jsx, with-storybook/stories/Gradient.stories.js, with-storybook/stories/assets/accessibility.svg, with-storybook/stories/assets/discord.svg, with-storybook/stories/assets/github.svg, with-storybook/stories/assets/tutorials.svg, with-storybook/stories/assets/youtube.svg",
  match: { agent: "expo-go", keywords: ["sb-app","phase 1 of 1"] },
  expected_input: { text: "Phase 1 of 1. Create an Expo app with Storybook 7 (web): .storybook config, an App.js, a Button and a Gradient component (expo-linear-gradient) each with a stories file, a Configure.mdx, the storybook and build-storybook scripts, and a .gitignore.", guardrails_test: "hand-over must contain [\"sb-app\",\"phase 1 of 1\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"with-storybook","n":1,"dir":"sb-app","skills":["expo-project-structure"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
