import type { AgentDef } from "../../core/types.ts";
export default { name: "planner", description: "Plans a change: reads the situation and writes a plan (steps, files, risks) without writing any code. Use first for any bigger change.", role: "planner" } satisfies AgentDef;
