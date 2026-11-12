import type { AgentDef } from "../../core/types.ts";
// Same agent as test_harness/core/orchistraitor/f1_multiagent/harness/agents/stage-qa (advance_test); the fixture records a REAL video in a Docker container.
export default { name: "stage-qa", description: "Stage QA: opens the built page in a browser (isolated container), types and clicks, records a video, and reports where the video is. Never edits.", role: "stage-qa" } satisfies AgentDef;
