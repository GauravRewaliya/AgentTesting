import type { AgentDef } from "../../core/types.ts";
export default { name: "lookup-page", description: "Lookup worker: reads the contact sheets of ONE group of pages of a reference store and writes their layouts and the builder brief for its screens file (terse, 1-2 minutes). Several run at once, one per screens file.", role: "lookup-page" } satisfies AgentDef;
