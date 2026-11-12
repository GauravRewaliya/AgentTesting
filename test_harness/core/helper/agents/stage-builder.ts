import type { AgentDef } from "../../core/types.ts";
// Same agent as test_harness/core/orchistraitor/f1_multiagent/harness/agents/stage-builder (the test_folders/advance_test stages); this entry is what the fixture-mock runner offers the lead.
export default { name: "stage-builder", description: "Stage 2 (implement) and the FIX round: builds exactly what PLAN.md says; when a review lists findings it fixes exactly those findings.", role: "stage-builder" } satisfies AgentDef;
