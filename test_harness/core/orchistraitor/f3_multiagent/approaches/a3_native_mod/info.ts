// WHAT THE a3 MOD ADDS, AS DATA for the dashboard (Settings > Team > Mod) and for people reading: when each piece of context reaches the lead, and which plugin features are done, off or still to do.
// Kept next to the mod so one change updates both; `self_test/approach_a3.ts` checks that every file named here exists.
export interface ModContext { when: "startup" | "every turn" | "after every tool" | "while a call blocks" | "on a tool call" | "on a timer"; what: string; file: string }
export interface ModFeature { name: string; status: "done" | "off" | "todo"; note: string }

export const MOD_CONTEXT: ModContext[] = [
  { when: "startup", what: "System prompt: the lead rules (prompts/lead.md) + the shared lead CLAUDE.md, passed with --append-system-prompt-file", file: "approaches/a3_native_mod/prompts/lead.md" },
  { when: "startup", what: "System prompt section `team:agents` (prompt.compose): the agent types the lead may call and what each can do", file: "approaches/a3_native_mod/mod/hooks/compose.ts" },
  { when: "startup", what: "The typed team tools (`mcp__team__*`, session.start): the lead has no Bash, these are its commands", file: "approaches/a3_native_mod/mod/hooks/team.ts" },
  { when: "startup", what: "First message: the task line, the conversation so far, project memory (.loopsAI) and the person's request", file: "harness/leadkit/common.ts" },
  { when: "every turn", what: "Before each message (prompt.submit): unread notes and the person's new messages, sub-agents running now (time, silence), background tasks, the team digest on the first turn", file: "approaches/a3_native_mod/mod/hooks/context.ts" },
  { when: "after every tool", what: "Live activity, lease renewal and unread notes after each tool call (the shared activity hook)", file: "harness/hooks/activity.ts" },
  { when: "while a call blocks", what: "A Agent / SendMessage call blocks until the sub-agent answers; a monitor tick every 15 s nudges an agent at 6 min and stops one silent for 10 min", file: "approaches/a3_native_mod/mod/hooks/delegate.ts" },
  { when: "on a tool call", what: "Agent / SendMessage are answered by the shared core (fixtures, locks, budget) with a real tool result; Read / Glob / Grep / Bash pass the lite guard (no secrets, stay in the workspace)", file: "approaches/a3_native_mod/mod/hooks/register.ts" },
  { when: "on a timer", what: "Wake-up (only with A3_WAKE=1): queues a prompt when the person wrote or a background sub-agent finished", file: "approaches/a3_native_mod/mod/hooks/wake.ts" },
];

export const MOD_FEATURES: ModFeature[] = [
  { name: "Agent / SendMessage through the shared core", status: "done", note: "real tool result, fixtures keep mocking the sub-agent" },
  { name: "Typed team tools, no Bash for the lead", status: "done", note: "15 core tools, the rest through team_tool" },
  { name: "Per-turn context", status: "done", note: "notes, running sub-agents, background tasks, digest" },
  { name: "Agent list as a system prompt section", status: "done", note: "prompt.compose; the rest of the prompt is still a file" },
  { name: "Lite guard for the lead and for sub-agents", status: "done", note: "secrets, workspace jail (lead); secrets only (sub-agents)" },
  { name: "Skills per agent, built on the fly", status: "done", note: "core/agents/skills.json + your own layer from this page" },
  { name: "Monitor while a call blocks", status: "done", note: "nudge 6 min, stop at 10 min of silence" },
  { name: "Mod tests without a model call", status: "done", note: "claude plugin test, self_test/approach_a3.ts" },
  { name: "Wake-up / interrupt timer", status: "off", note: "A3_WAKE=1; off because an extra lead turn costs a model call" },
  { name: "Typed tools for sub-agents", status: "todo", note: "their prompts are written for shell `team` commands" },
  { name: "Whole lead prompt as prompt.compose sections", status: "todo", note: "only changes where the text sits" },
  { name: "Slash commands and a team pane (ui)", status: "todo", note: "interactive sessions only, not claude -p" },
  { name: "Session create / continue / fork from the mod", status: "todo", note: "$.agent / $.session; today the core does it" },
];
