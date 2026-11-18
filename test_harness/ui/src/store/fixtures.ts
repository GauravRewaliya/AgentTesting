// Sample data in the real shapes, so the layout can be judged before any source is connected.
import type { SubAgentMock, SuiteGroup, TestSession } from "@/types";

const T0 = Date.parse("2026-11-04T12:11:40Z");

export const suites: SuiteGroup[] = [
  {
    id: "test_basic_2",
    title: "Two writers, two tasks",
    tags: ["session", "isolation"],
    cases: [
      { caseId: "b2_1_writer_a", title: "writer #A creates a.md", sessionId: "ts_b2_1", status: "pass", at: "2026-11-04T12:11:20Z", harness: "mod", children: [{ title: "spawn writer#1 for a.md", expectedAgents: ["b2-writer-a"], match: true }] },
      { caseId: "b2_2_writer_b_new_task", title: "separate task -> new session", sessionId: "ts_b2_2", status: "pass", at: "2026-11-04T12:11:31Z", harness: "mod", after: "b2_1_writer_a", children: [{ title: "spawn writer#2 for b.md", expectedAgents: ["b2-writer-b"], match: true }] },
      { caseId: "b2_3_ask_a", title: "ask writer #A: only a.md", sessionId: "ts_b2_3", status: "pass", at: "2026-11-04T12:11:46Z", harness: "mod", after: "b2_2_writer_b_new_task", children: [{ title: "follow-up to writer#1", expectedAgents: ["session:writer#1"], match: true }, { title: "no memory of b.md", expectedAgents: [] }] },
      { caseId: "b2_4_ask_b", title: "ask writer #B: only b.md", sessionId: "ts_b2_4", status: "fail", at: "2026-11-04T12:12:02Z", harness: "mod", after: "b2_2_writer_b_new_task", children: [{ title: "follow-up to writer#2", expectedAgents: ["session:writer#2"], match: false }] },
    ],
  },
  {
    id: "test_handover",
    title: "Hand-over to one researcher",
    tags: ["handover"],
    cases: [
      { caseId: "ho_1", title: "question reaches researcher intact", sessionId: "ts_ho_1", status: "pass", at: "2026-11-04T10:02:00Z", harness: "mod", children: [{ title: "spawn researcher", expectedAgents: ["h1"], match: true }] },
      { caseId: "ho_8", title: "needs two calls", status: "never_run", children: [{ title: "researcher x2", expectedAgents: ["h2", "h3"] }] },
    ],
  },
  {
    id: "test_workflows",
    title: "Real task patterns",
    tags: ["workflow"],
    cases: [{ caseId: "wf_4", title: "implement -> fresh reviewer -> fix", sessionId: "ts_wf_4", status: "cached", at: "2026-11-04T09:30:00Z", harness: "mod", children: [{ title: "builder", expectedAgents: ["role-expo-builder"], match: true }, { title: "reviewer (new session)", expectedAgents: ["basic-reviewer-hi"], match: true }, { title: "builder again with findings", expectedAgents: ["session:builder#1"], match: true }] }],
  },
];

export const sessions: Record<string, TestSession> = {
  ts_b2_3: {
    id: "ts_b2_3", caseId: "b2_3_ask_a", suite: "test_basic_2", title: "ask writer #A: only a.md", at: "2026-11-04T12:11:46Z", harness: "mod", status: "pass",
    workspaceId: "ws_b2_3", leadSessionId: "6220154d-2ffd-4d0f-83a3-24588f10cc86", after: "b2_2_writer_b_new_task", tags: ["session", "isolation"],
    turns: [{ user: "Ask the FIRST writer (the one that made a.md): what exactly did you do?", expectedContext: "Follow-up to writer#1, not writer#2. Answer mentions a.md and nothing about b.md.", expectedAgents: ["session:writer#1"], actualAgents: ["session:writer#1"], match: true, reply: "The first writer replied only: I am done. I was asked to create a.md ..." }],
    subSessions: [
      { id: "s3783fc3105de", label: "writer#1", agent: "writer", workspaceId: "ws_b2_1", parentSessionId: "6220154d-2ffd-4d0f-83a3-24588f10cc86", calls: 2, fixture: "b2-writer-a" },
      { id: "sdc67c4903385", label: "writer#2", agent: "writer", workspaceId: "ws_b2_2", parentSessionId: "6220154d-2ffd-4d0f-83a3-24588f10cc86", calls: 1, fixture: "b2-writer-b" },
    ],
    events: [
      { t: T0, kind: "hook", sessionId: "6220154d", agent: "writer", text: "SendMessage -> s3783fc3105de" },
      { t: T0 + 2, kind: "send", sessionId: "s3783fc3105de", agent: "writer", text: "Is the task done? State exactly what you did." },
      { t: T0 + 3, kind: "reply", sessionId: "s3783fc3105de", agent: "writer", text: "I am done. I was asked to create a.md. I did: Created a.md with the word: Alpha.", fixture: "b2-writer-a" },
    ],
  },
};

export const mocks: SubAgentMock[] = [
  {
    id: "writer", description: "Writes a markdown file the lead asks for.", forbidden: false,
    beforeRun: [
      { id: "r1", kind: "must_contain", value: ".md", message: "the task must name a .md file" },
      { id: "r2", kind: "min_chars", value: 20, message: "the task is too short to be a real hand-over" },
      { id: "r3", kind: "must_not_contain", value: "search", message: "search work belongs to searchSubagent, not writer" },
    ],
    fixtures: [
      { id: "b2-writer-a", keywords: ["a.md", "Alpha"], reply: "Created a.md with the word: Alpha" },
      { id: "b2-writer-b", keywords: ["b.md", "Beta"], reply: "Created b.md with the word: Beta" },
    ],
  },
  { id: "reviewer", description: "Checks a file and reports.", forbidden: false, beforeRun: [{ id: "r1", kind: "min_chars", value: 15, message: "name the file to check" }], fixtures: [{ id: "basic-reviewer-hi", keywords: ["hi.md"], reply: "Reviewed hi.md: it contains the message." }] },
  { id: "poet", description: "Distractor: writes poems.", forbidden: true, beforeRun: [], fixtures: [] },
];
