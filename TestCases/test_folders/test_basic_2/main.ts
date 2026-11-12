import type { TestTag } from "../../tags.ts";
import type { Case } from "@core/types.ts";

// Two writers, two separate tasks: same agent TYPE, different TASK -> different sessions, no memory leak.
const common = { agents: ["writer", "reviewer"] };
export const tags: TestTag[] = ["multi_ag", "single_prompt", "split_task"];
export const cases: Case[] = [
  {
    id: "b2_1_writer_a", title: "writer #A: create a.md (Alpha)", needs: ["multiagent.spawn"], ...common,
    turns: [{ user: "Ask the writer agent to create a markdown file a.md that contains the word: Alpha",
      expected: { context: "The lead spawns one writer (writer#1) for a.md with the word Alpha; a.md lands in run_test.", expected_agents_res: ["b2-writer-a"] } }],
  },
  {
    id: "b2_2_writer_b_new_task", title: "a SEPARATE task for a writer -> a new session, not #A", after: "b2_1_writer_a", needs: ["session.isolation"], ...common,
    turns: [{ user: "This is a different, separate task. Ask a writer agent (a fresh one, not the one you used before) to create b.md that contains the word: Beta",
      expected: { context: "The lead spawns a NEW writer session (writer#2, id different from writer#1) for b.md with the word Beta. It does not reuse writer#1. Both a.md and b.md exist.", expected_agents_res: ["b2-writer-b"] } }],
  },
  {
    id: "b2_3_ask_a", title: "ask writer #A what it did: only a.md, knows nothing of b.md", branch_from: "b2_2_writer_b_new_task", needs: ["session.followup", "session.isolation"], ...common,
    turns: [{ user: "Ask the FIRST writer (the one that made a.md): what exactly did you do?",
      expected: { context: "The lead sends a follow-up to the FIRST writer session (writer#1), not writer#2. Its answer mentions a.md and nothing about b.md or Beta (no memory leak between sessions).", expected_agents_res: ["session:writer#1"] } }],
  },
  {
    id: "b2_4_ask_b", title: "branch from 2: ask writer #B: only b.md, knows nothing of a.md", branch_from: "b2_2_writer_b_new_task", needs: ["session.followup", "session.isolation"], ...common,
    turns: [{ user: "Ask the SECOND writer (the one that made b.md): what exactly did you do?",
      expected: { context: "The lead sends a follow-up to the SECOND writer session (writer#2). Its answer mentions b.md and nothing about a.md or Alpha.", expected_agents_res: ["session:writer#2"] } }],
  },
];
