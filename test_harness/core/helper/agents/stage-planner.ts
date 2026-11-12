import type { AgentDef } from "../../core/types.ts";
// Same agent as test_harness/core/orchistraitor/f1_multiagent/harness/agents/stage-planner (the test_folders/advance_test stages); this entry is what the fixture-mock runner offers the lead.
export default { name: "stage-planner", description: "Stage 1 (plan): turns a request into a PLAN.md (goal, files, steps, acceptance checks). Writes only PLAN.md, never code.", role: "stage-planner" } satisfies AgentDef;
