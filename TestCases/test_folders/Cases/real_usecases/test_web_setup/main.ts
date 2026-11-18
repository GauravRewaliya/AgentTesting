// test_web_setup: "create a Vue / React app". What is tested is the MASTER: a vague request ("create a Vue app") must be answered with QUESTIONS first (project name, and the options the generator offers),
// no sub-agent is called until the person answered; then the master hands the sub-agent the exact name and options and the fixture RUNS THE REAL GENERATOR in a Docker container
// (`bun create vue@latest <name> --ts --router ...`, `bun create vite@latest <name> --template react-ts ...`, see agent_fixture/store/web_setup/scaffold.ts). The fixture is just that command: no copied project.
// If the name or the options are missing from the hand-over the fixture answers NEEDS_PARENT, like the real agent (agents/web-setup/.claude/CLAUDE.md).
//   QA (`--video`): both cases are web apps, so `qa` is ON: the project is installed with pnpm and its dev server is started in a container, then recorded (docs/QA_ISSUES.md).
import type { Case } from "@core/types.ts";
import type { TestTag } from "../../../../tags.ts";

export const tags: TestTag[] = ["multi_ag", "coding"];
const base = { needs: ["multiagent.spawn", "guard.roles", "sandbox.files"], guard: "web_rules.json", agents: ["web-setup"], tools: ["Agent"], max_agent_calls: 4, tags: ["multi_prompt"] } as const satisfies Partial<Case>;
const viteQa: Case["qa"] = (req) => ({ enabled: true, kind: "dev-server", app: req.apps[0] ?? "app", start: "corepack pnpm exec vite --host 127.0.0.1 --port 5173", port: 5173, viewport: "1000x640",
  guide: "To test: the new project must install with pnpm (`pnpm install`) and `pnpm dev` must serve a page in the browser. Do not install packages in the workspace yourself: the QA step installs them in a container, with the shared pnpm store." });

export const cases: Case[] = [
  {
    ...base, id: "web_vue_setup", qa: viteQa,
    title: "[setup] 'create a Vue app': the master asks name and options FIRST, then the sub-agent runs `bun create vue@latest` with the answers",
    turns: [
      { user: "Create a Vue app for me.",
        expected: { context: "A vague request. The master does NOT call a sub-agent yet: it asks the person, in one short message, for the project NAME and for the options the Vue generator offers (TypeScript, Vue Router, Pinia, Vitest, ESLint/Prettier ...), with sensible defaults.", expected_agents_res: [], reply_must: ["name"] } },
      { user: "Call it shop-ui. TypeScript, Vue Router and Pinia, plus Vitest. Nothing else.", allowed: ["web-setup"],
        expected: { context: "The master hands web-setup the exact name (shop-ui, in run_test/shop-ui) and the exact options. The fixture runs `bun create vue@latest shop-ui --ts --router --pinia --vitest` in a container and reports the command. The master checks run_test/shop-ui (ls / read_file: package.json lists vue, vue-router, pinia, vitest) and tells the person what was created and that dependencies are not installed yet (pnpm install).", expected_agents_res: ["web-vue-setup"], reply_must: ["shop-ui"] } },
    ],
  },
  {
    ...base, id: "web_react_setup", qa: viteQa,
    title: "[setup] 'set up a React project': the master asks name and language FIRST, then the sub-agent runs `bun create vite@latest --template react-ts`",
    turns: [
      { user: "I need a React project.",
        expected: { context: "A vague request. The master does NOT call a sub-agent yet: it asks for the project NAME and the choices (TypeScript or JavaScript, ESLint or not).", expected_agents_res: [], reply_must: ["name"] } },
      { user: "Name it dash-ui, with TypeScript.", allowed: ["web-setup"],
        expected: { context: "The master hands web-setup the exact name (dash-ui) and the language. The fixture runs `bun create vite@latest dash-ui --template react-ts --no-interactive --no-immediate` in a container. The master checks run_test/dash-ui (package.json lists react, vite, typescript) and reports what was created and that nothing is installed yet.", expected_agents_res: ["web-react-setup"], reply_must: ["dash-ui"] } },
    ],
  },
];
