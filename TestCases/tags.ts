// The ONE tag vocabulary for every test case. A suite (`export const tags` in test_folders/Cases/<suite>/main.ts) and a case (`tags` on it) may use only these.
// A case carries one tag of each of the three groups; the suite lists what is the same for all its cases, a case adds what differs.

/** Who does the work: the lead alone, or the lead handing work to sub-agents. */
export const AGENT_TAGS = ["single_ag", "multi_ag"] as const;
/** How many user prompts (turns) the case has. */
export const PROMPT_TAGS = ["single_prompt", "multi_prompt"] as const;
/** What the case is about. */
export const TOPIC_TAGS = ["artifacts", "coding", "split_task"] as const;

export const ALL_TAGS = [...AGENT_TAGS, ...PROMPT_TAGS, ...TOPIC_TAGS] as const;
export type AgentTag = (typeof AGENT_TAGS)[number];
export type PromptTag = (typeof PROMPT_TAGS)[number];
export type TopicTag = (typeof TOPIC_TAGS)[number];
export type TestTag = (typeof ALL_TAGS)[number];

export const isTag = (x: string): x is TestTag => (ALL_TAGS as readonly string[]).includes(x);
