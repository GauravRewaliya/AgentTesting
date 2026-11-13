import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result: CLONE ONCE. A real sparse shallow clone of github.com/enzomanuelmangano/demos at the pinned sha into run_test/demos, one slim runner app per demo
// (cherry-blossom-qrcode, sculptures-in-words) and PLAN.md. No code is written or changed, nothing is run: the run + video are the next nodes (branches that share this workspace). Source: sources.json "enzo-demos-clone". Never delete.
import { cloneRepo } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_demos_01_clone",
  title: "expo-go: clone enzomanuelmangano/demos once and set up the cherry-blossom-qrcode and sculptures-in-words runners",
  description: "Sparse clone at 9a2196a into run_test/demos, slim runner apps run_test/cherry-blossom-qrcode-app and run_test/sculptures-in-words-app, PLAN.md",
  match: { agent: "expo-go", keywords: ["demos", "cherry"] },
  expected_input: { text: "Clone https://github.com/enzomanuelmangano/demos into run_test/demos and set up the cherry-blossom-qrcode and sculptures-in-words demos so each can be run. Write the steps in PLAN.md first. Do nothing else: do not run them.", guardrails_test: "hand-over must name run_test, demos, cherry, sculptures and PLAN.md" },
  run: (req) => cloneRepo(req, { name: "enzo-demos-clone", repo: "https://github.com/enzomanuelmangano/demos.git", sha: "9a2196ae7d52d800a22a5b8cbc8b1095d3638aff", dir: "demos", slims: ["cherry-blossom-qrcode", "sculptures-in-words"] }),
} satisfies ResultModule;
