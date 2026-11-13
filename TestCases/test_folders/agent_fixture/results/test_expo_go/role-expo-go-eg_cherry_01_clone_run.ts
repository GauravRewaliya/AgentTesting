import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result: CLONE AND RUN only. A real shallow clone of github.com/enzomanuelmangano/demos at the pinned sha into run_test/demos, PLAN.md, a REPORT line. No code is written or changed.
// Source entry: sources.json name: "enzo-demos-clone". Never delete.
import { cloneRepo } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_cherry_01_clone_run",
  title: "expo-go: clone enzomanuelmangano/demos and run the cherry-blossom-qrcode demo",
  description: "Clones the repo (pinned sha 9a2196a) into run_test/demos, builds a SLIM runner app for just this demo (run_test/cherry-blossom-qrcode-app) and writes PLAN.md; the QA step then runs it on web and records the video",
  match: { agent: "expo-go", keywords: ["demos", "cherry"] },
  expected_input: { text: "Clone https://github.com/enzomanuelmangano/demos into run_test/demos and run the cherry-blossom-qrcode demo. Write the steps in PLAN.md first. Do nothing else.", guardrails_test: "hand-over must name run_test, demos, cherry and PLAN.md" },
  run: (req) => cloneRepo(req, { name: "enzo-demos-clone", repo: "https://github.com/enzomanuelmangano/demos.git", sha: "9a2196ae7d52d800a22a5b8cbc8b1095d3638aff", dir: "demos", run: "cd run_test/demos && corepack pnpm install && corepack pnpm exec expo start --web", slim: { slug: "cherry-blossom-qrcode" } }),
} satisfies ResultModule;
