import type { ResultModule } from "@core/types.ts";
// Recorded web-setup answer (test_folders/Cases/real_usecases/test_web_setup/main.ts). NOT a copied project: the fixture RUNS the real generator command in a Docker container (store/web_setup/scaffold.ts) and answers NEEDS_PARENT when the name or the options are missing. Never delete.
import { scaffold } from "../../store/web_setup/scaffold.ts";
export default {
  id: "web-react-setup",
  title: "web-setup: runs `bun create vite@latest <name> --template react-ts`",
  description: "Reads the project name and the options from the hand-over, runs the real generator in a throwaway container, reports the command and what was created; asks its parent (NEEDS_PARENT) when something is missing",
  match: { agent: "web-setup", keywords: ["react"], repeatable: true },
  expected_input: { text: "Create the React project dash-ui in run_test with TypeScript.", guardrails_test: "hand-over must name run_test, the framework, the project name and the options" },
  run: (req) => scaffold(req, "react"),
} satisfies ResultModule;
