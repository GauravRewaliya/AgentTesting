import type { TestTag } from "../../../../tags.ts";
import type { Case } from "@core/types.ts";

// expo_direct_build: requests that must NOT use the team. A small or short ask is answered directly, with a useful distractor-free hand-off of nothing.
// Ported from Test_agent_2 t3c_small_no_call and expo-short. The guard allows NO role in these turns, so any call is stopped (GUARD).
const base = { needs: ["multiagent.spawn", "guard.roles"], guard: "expo_rules.json", lead: "lead_team", tools: ["Agent"], allow_real_subAg: true as const };
export const tags: TestTag[] = ["single_ag", "single_prompt", "coding"];
export const cases: Case[] = [
  {
    id: "expo_d1_small_question", title: "[expo_direct_build] minor question after the build: must NOT call any sub-agent (the planner and the package-researcher are available)", branch_from: "expo_s2_build",
    agents: ["planner", "package-researcher"], ...base,
    turns: [{
      user: "Quick one: which two expo example projects did we base the app on? One line, no new work please.", allowed: [],
      expected: { context: "The lead answers from the conversation in one line: with-drawer-navigation and with-zustand (drawer, zustand). NO sub-agent is called, although the planner and the package-researcher are available. No new files.", expected_agents_res: [] },
    }],
  },
  {
    id: "expo_d2_short_task", title: "[expo_direct_build] a short fresh question: 'Task size: short', answered directly, no team", agents: ["planner", "ux-designer", "builder", "qa-reviewer"], ...base,
    turns: [{
      user: "Quick question, no files please: in the zustand package, what does create() return and how do I read one value from it? Two lines.", allowed: [],
      expected: { context: "First line says 'Task size: short'. The lead answers itself in a few lines (create returns a hook; useStore(state => state.value)). NO sub-agent is called and no file is written.", expected_agents_res: [] },
    }],
  },
];
