import type { AgentDef } from "../../core/types.ts";
// Same agent as test_harness/core/orchistraitor/f1_multiagent/TestCases/test_folders/agent_fixture/agents/web-setup (test_folders/test_web_setup); the fixture runs the REAL generator command in a Docker container.
export default { name: "web-setup", description: "Creates a NEW web project (Vue, React) by running the official generator in a shell. Needs the project name and the options from its parent; asks (NEEDS_PARENT) when they are missing.", role: "web-setup" } satisfies AgentDef;
