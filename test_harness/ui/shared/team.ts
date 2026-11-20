// What GET /api/team* returns (the server wraps core/orchistraitor/f3_multiagent/harness/core/team_view.ts); the client contract of Settings > Team.
export interface TeamMount { skills: string[]; agents: string[]; when?: string; by: "repo" | "you" }
export interface TeamAgent { name: string; role: string; description: string; model: string; writes: boolean; kind: "main" | "test"; fixtures: boolean; branches: string[]; callers: string[]; allow: string[]; promptChars: number; skills: string[]; ownSkills: string[] }
export interface TeamSkill { name: string; from: string; description: string; by: "repo" | "you"; mountedFor: string[] }
export interface TeamOverview { approach: string; agents: TeamAgent[]; skills: TeamSkill[]; mounts: TeamMount[]; home: string }
export interface TeamTools { allow: string[]; tools: string[]; typed: { name: string; description: string }[]; canCall: boolean; note: string }
export interface TeamHook { file: string; what: string; guarded: boolean; events: { event: string; matcher: string }[] }
export interface TeamMod { approach: string; isMod: boolean; dir: string; built: string | null; hooks: TeamHook[]; context: { when: string; what: string; file: string }[]; features: { name: string; status: "done" | "off" | "todo"; note: string }[] }
