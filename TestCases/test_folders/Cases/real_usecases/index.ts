// Route table: REAL USE CASES = real products and projects redone, planned or checked by the team (pipedream, expo_go, planning, project checks).
// Mounted by ../index.ts.
import type { GroupRoute } from "../route.ts";

export default {
  id: "real_usecases",
  title: "Real use cases",
  about: "Real products and projects: the lead and the team on realistic asks. Most use recorded sub-agent fixtures; project checks and prompt planning use real sub-agents (allow_real_subAg).",
  suites: [
    { name: "test_pipedream", ids: ["pd_"], main: "./test_pipedream/main.ts", about: "researcher on Pipedream components (structure, app file + action relation, new action style)" },
    { name: "test_expo_go", ids: ["eg_"], main: "./test_expo_go/main.ts", about: "expo-go sub-agent redoing real Expo projects phase by phase from real commit patches (+ rework cases: bad answer, then the fix)" },
    { name: "test_expo_sub_agent", ids: ["expo_s"], main: "./test_expo_sub_agent/main.ts", about: "expo roles in order: ux-designer, then builder + qa-reviewer (honest about a QA FAIL), package-researcher when asked" },
    { name: "test_expo_proj_planning", ids: ["expo_p"], main: "./test_expo_proj_planning/main.ts", about: "a long expo task: classify, call ONLY the planner, return the plan, wait for approval" },
    { name: "test_expo_direct_build", ids: ["expo_d"], main: "./test_expo_direct_build/main.ts", about: "small expo asks the lead must answer itself, WITHOUT any sub-agent" },
    { name: "test_project_check", ids: ["pc_"], main: "./test_project_check/main.ts", about: "is this unpacked project working? install, type-check, build, honest report (real qa-reviewer)" },
    { name: "test_web_setup", ids: ["web_"], main: "./test_web_setup/main.ts", about: "'create a Vue / React app': the lead asks name and options first, then the sub-agent runs the real generator" },
    { name: "real_planning_prototype", ids: ["real_"], main: "./real_planning_prototype/main.ts", about: "plan -> prototype -> split -> parallel build -> QA on realistic product asks (Instagram-like, admin dashboard, site clone, phases)" },
    { name: "test_treejs_sakura", ids: ["tj_"], main: "./test_treejs_sakura/main.ts", about: "a three.js sakura page with a demo video: ONE builder, never told to record (a guard breach fails the case), then ONE QA; real QA on a good and a wrong (green) seeded build must PASS / flag it as low quality, bounded by time, calls, one video, two pictures" },
    { name: "test_prompt_planning", ids: ["pp_"], main: "./test_prompt_planning/main.ts", about: "can the team BUILD this from the frozen plan alone? (plan seeded before turn 1, a person judges)" },
  ],
} satisfies GroupRoute;
