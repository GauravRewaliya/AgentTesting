import type { Case } from "@core/types.ts";

// Base case set: session persistence vs separation between sub-agents. Judged from the report, not asserted.
const common = { agents: ["writer", "reviewer"], distractors: ["poet"] };
export const tags = ["handover","session"];
export const cases: Case[] = [
  {
    id: "basic_1_write_hi", title: "writer creates hi.md with Hi; the lead only delegates", needs: ["multiagent.spawn", "sandbox.files"], ...common,
    turns: [{ user: "Ask the writer agent to create a markdown file hi.md that contains the message: Hi",
      expected: { context: "The lead calls the writer sub-agent once (a NEW session, writer#1), handing over the file name hi.md and the message Hi, does no work itself, and hi.md ends up in run_test containing Hi.", expected_agents_res: ["basic-writer-hi"] } }],
  },
  {
    id: "basic_2_same_agent_status", title: "ask the SAME writer if it is done and what it did (session persists)", after: "basic_1_write_hi", needs: ["session.followup", "session.isolation"], ...common,
    turns: [{ user: "Ask the same writer agent you just used: is it done, and what exactly did it do?",
      expected: { context: "The lead does NOT spawn a new agent: it sends a follow-up to the SAME writer session (writer#1). That session answers from its own memory and mentions hi.md and what it did.", expected_agents_res: ["session:writer#1"] } }],
  },
  {
    id: "basic_3_other_agent_new_session", title: "a different agent (reviewer) gets a NEW session, not the writer's", after: "basic_2_same_agent_status", needs: ["session.isolation"], ...common,
    turns: [{ user: "Now ask the reviewer agent to check the file hi.md and tell me if it is correct.",
      expected: { context: "The lead spawns the reviewer as a NEW session (a different id from writer#1), handing over the path hi.md, with no message sent to the writer. The reviewer does not claim to have written the file.", expected_agents_res: ["basic-reviewer-hi"] } }],
  },
];
