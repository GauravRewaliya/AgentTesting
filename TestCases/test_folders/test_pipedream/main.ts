import type { Case } from "@core/types.ts";
import data from "./cases.json";   // ported from Test_agent_2/test_2.json (Pipedream components + Claude Code mods)

export const tags = ["handover","research","files"];
export const cases: Case[] = data.map((c: any) => ({
  id: `pd_${c.id}`, title: `[${c.group}] ${c.task}`, needs: ["multiagent.spawn", "lookup.similarity"], agents: ["researcher"], distractors: ["poet"],
  turns: [{ user: c.user_message, expected: c.expected }],
}));
