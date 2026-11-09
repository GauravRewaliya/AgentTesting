import type { AgentDef } from "../../core/types.ts";
export default { name: "package-researcher", description: "Researches a package: its syntax and whether code written with it is valid for the version in use. Use only when a package question needs checking.", role: "package-researcher" } satisfies AgentDef;
