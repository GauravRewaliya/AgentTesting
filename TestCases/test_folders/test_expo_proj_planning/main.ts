import type { Case } from "@core/types.ts";

// expo_proj_planning: a LONG Expo project. The lead classifies it, calls ONLY the planner, returns the plan and waits for approval.
// Ported from Test_agent_2 t1_plan. The role guard (agent_fixture/store/expo_rules.json) stops a wrong call. Judged from the report.
export const tags = ["expo","planning","approval-gate","guard"];
export const cases: Case[] = [
  {
    id: "expo_p1_plan", title: "[expo_proj_planning] long task: classify, call ONLY the planner, return the plan, wait for approval",
    needs: ["multiagent.spawn", "guard.roles", "sandbox.files"], guard: "expo_rules.json", lead: "lead_team", tools: ["Agent"],
    agents: ["planner", "ux-designer", "builder", "qa-reviewer"], distractors: ["poet"],
    turns: [{
      user: "I am new to Expo Go. Using https://github.com/expo/examples as the base, recreate for me a small app in our workspace folder run_test: a drawer navigation (like their drawer-navigation example) whose screens share one list through a zustand store (like their zustand example).",
      allowed: ["planner"],
      expected: { context: "First line says 'Task size: long'. The lead calls ONLY the planner (the role guard would stop any other role), with a hand-over that names expo/examples, drawer, zustand and run_test. It returns a 4-line summary and the plan path (notes-app/plan.md), asks 'Approve the plan?' and ENDS the turn. plan.md exists; App.js does not yet.", expected_agents_res: ["role-expo-planner"] },
    }],
  },
];
