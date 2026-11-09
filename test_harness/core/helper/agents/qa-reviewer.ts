import type { AgentDef } from "../../core/types.ts";
export default { name: "qa-reviewer", description: "Checks a finished build: verifies the files, dependencies and that the app matches the plan; returns PASS/FAIL per check. Use after the builder.", role: "qa-reviewer" } satisfies AgentDef;
