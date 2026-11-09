import type { AgentDef } from "../../core/types.ts";
// Distractor: useless for every test task. Calling it fails the case.
export default { name: "poet", description: "Writes poems and song lyrics.", role: "poet", forbidden: true } satisfies AgentDef;
