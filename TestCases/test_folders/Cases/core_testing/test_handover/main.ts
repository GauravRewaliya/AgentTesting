import type { TestTag } from "../../../../tags.ts";
import type { Case } from "@core/types.ts";
import data from "./cases.json";   // ported from Test_agent_2/test_1.json: {id, task, user_message, expected:{context, expected_agents_res}}

// The router hands each question to a researcher with the question intact. Nothing is asserted by code: read the report.
export const tags: TestTag[] = ["multi_ag", "single_prompt", "split_task"];
export const cases: Case[] = data.map((c: any) => ({
  id: `ho_${c.id}`, title: c.task, needs: ["multiagent.spawn", "lookup.similarity", "guard.roles"], guard: "handover_rules.json", agents: ["researcher"],   // guard: the mocked researcher needs a role rule (min length only: the quality of the hand-over is judged by reading, nothing is asserted)
  turns: [{ user: c.user_message, expected: c.expected }],
}));
