import type { AgentDef } from "../../core/types.ts";
// Same agent as test_harness/core/orchistraitor/f1_multiagent/harness/agents/stage-reviewer (the test_folders/advance_test stages); this entry is what the fixture-mock runner offers the lead.
export default { name: "stage-reviewer", description: "Stage 3 (review): reads the built files and checks them against PLAN.md and its acceptance checks; raises numbered findings or approves. Never edits.", role: "stage-reviewer" } satisfies AgentDef;
