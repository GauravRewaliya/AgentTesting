// The ONE tag vocabulary for every test case. A suite (`export const tags` in test_folders/Cases/<suite>/main.ts) and a case (`tags` on it) may use only these.
// A case carries one tag of each of the three groups; the suite lists what is the same for all its cases, a case adds what differs.

/** Who does the work: the lead alone, or the lead handing work to sub-agents. */
export const AGENT_TAGS = ["single_ag", "multi_ag"] as const;
/** How many user prompts (turns) the case has. */
export const PROMPT_TAGS = ["single_prompt", "multi_prompt"] as const;
/** What the case is about. */
export const TOPIC_TAGS = ["artifacts", "coding", "split_task", "prompt_testing", "cost", "loop"] as const;   // prompt_testing: cases of test_folders/prompt_test (single-turn calls of one agent, chained by `after`); cost: token-consuming on purpose (loops, heavy work: the master must fan out / stop); loop: a repeat the agent must run, or stop

/** Readiness of the case, DECLARED in code (a case's `tags`), never set from the UI. The dashboard only shows and filters it. */
export const READINESS_TAGS = ["test_ready", "to_scrap", "ready_to_start", "ready_to_build", "ready_to_plan", "ready_to_qa"] as const;   // ready_to_start: needs one init prompt to start; ready_to_build: the frozen plan/prompt is there, the team can build it; ready_to_plan: a realistic ask the planner can plan; ready_to_qa: build, check and QA (recording) can run on it

export const ALL_TAGS = [...AGENT_TAGS, ...PROMPT_TAGS, ...TOPIC_TAGS, ...READINESS_TAGS] as const;
export type AgentTag = (typeof AGENT_TAGS)[number];
export type PromptTag = (typeof PROMPT_TAGS)[number];
export type ReadinessTag = (typeof READINESS_TAGS)[number];
export type TopicTag = (typeof TOPIC_TAGS)[number];
export type TestTag = (typeof ALL_TAGS)[number];

export const isTag = (x: string): x is TestTag => (ALL_TAGS as readonly string[]).includes(x);
