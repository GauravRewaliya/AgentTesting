// Route table: CORE TESTING = the harness core (and the plain lead-level cases: solowork, artifact). The pitfalls listed in ProgressAndFound.md ("Test Cases"): calling agents, hand-over and context,
// sessions, staged jobs, loops. Mounted by ../index.ts. Which pitfall areas have a suite and which do not: README.md in this folder.
import type { GroupRoute } from "../route.ts";

export default {
  id: "core_testing",
  title: "Core testing",
  about: "The harness core: does the lead call agents right, hand over what AND why, keep context, stop loops? Mocked sub-agents (recorded fixtures), only the lead is a real call.",
  suites: [
    { name: "test_basic", ids: ["basic_"], main: "./test_basic/main.ts", about: "writer + reviewer: the same agent again keeps its memory, a different role gets a NEW session" },
    { name: "test_basic_2", ids: ["b2_"], main: "./test_basic_2/main.ts", about: "same-session follow-ups and status questions across two tasks" },
    { name: "test_handover", ids: ["ho_"], main: "./test_handover/main.ts", about: "quality of the hand-over: the task AND the why, the constraints, the files" },
    { name: "test_workflows", ids: ["wf_"], main: "./test_workflows/main.ts", about: "plan gate, review-fix loop, follow-up on an earlier answer, honest report when a sub-agent fails, read-only constraint" },
    { name: "test_solowork", ids: ["solo_"], main: "./test_solowork/main.ts", about: "the lead works alone (router off): confirms first, edits, writes nothing when declined; no sub-agent" },
    { name: "test_artifact", ids: ["art_"], main: "./test_artifact/main.ts", about: "Claude artifact links: website, explanation, Figma (needs the Artifact tool)" },
    { name: "advance_test", ids: ["adv_"], main: "./advance_test/main.ts", about: "staged job: plan -> build -> fresh reviewer -> fix; context loss between stages; browser QA with a recorded video" },
  ],
} satisfies GroupRoute;
