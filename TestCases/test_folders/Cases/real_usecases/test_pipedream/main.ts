import type { TestTag } from "../../../../tags.ts";
import type { Case } from "@core/types.ts";
import data from "./cases.json";   // ported from Test_agent_2/test_2.json (Pipedream components + Claude Code mods)

export const tags: TestTag[] = ["multi_ag", "single_prompt", "split_task"];
export const cases: Case[] = data.map((c: any) => ({
  id: `pd_${c.id}`, title: `[${c.group}] ${c.task}`, needs: ["multiagent.spawn", "lookup.similarity"], agents: ["researcher"],
  turns: [{ user: c.user_message, expected: c.expected }],
}));
