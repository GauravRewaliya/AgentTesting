import type { TestTag } from "../../../../tags.ts";
import type { Case } from "@core/types.ts";

// ARTIFACT cases: the user asks the agent for a Claude artifact LINK. REAL, nothing mocked: run them with
//   bun test_harness/core/orchistraitor/f1_multiagent/testrun/artifact_run.ts [case ids]     (haiku lead, ~$0.02 per case, artifacts are private)
// Headless `claude -p` only gets the real Artifact tools when CLAUDE_CODE_ENTRYPOINT=cli-interactive is set (the runner does that). The f1 harness itself
// refuses these solo cases (router:false), so `run.ts test_artifact` shows "not supported": use artifact_run.ts. It FAILS (exit 1) unless a real Artifact
// publish succeeded and the reply carries that exact link (an invented link also fails).
export const tags: TestTag[] = ["single_ag", "single_prompt", "artifacts"];
const art = { external: true, router: false, lead: "solo", tools: ["Write", "Read"], agents: [], needs: ["artifact.publish"], allow_real_subAg: true as const };
export const cases: Case[] = [
  { id: "art_1_website", title: "[Artifact] a website artifact: build a one-page site and give me the artifact link", ...art,
    turns: [{ user: "Build me a one-page website for a small coffee shop (hero, menu, opening hours) as a Claude artifact and give me the link.", expected: { context: "The lead writes the page and PUBLISHES it as an artifact, then returns a claude.ai artifact link. The page has the hero, the menu and the hours.", expected_agents_res: [] } }] },
  { id: "art_2_explanation", title: "[Artifact] an explanation artifact: explain something, give me the link", ...art,
    turns: [{ user: "Explain how DNS resolution works as a Claude artifact page, with a small diagram, and give me the link.", expected: { context: "The lead publishes an explanatory page (text plus a diagram) as an artifact and returns the link.", expected_agents_res: [] } }] },
  { id: "art_3_figma", title: "[Artifact] a Figma artifact: a design for a login screen, give me the link", ...art,
    turns: [{ user: "Make a Figma design for a login screen and give me the Claude artifact link.", expected: { context: "The lead uses the Figma connector (or says plainly that it cannot) and returns an artifact link for the design. It must not invent a link.", expected_agents_res: [] } }] },
  { id: "art_4_working_website", title: "[Artifact] a WORKING website artifact: interactive todo app, give me the link", ...art,
    turns: [{ user: "Make a working todo web app (add and remove items really work) as a Claude artifact and give me the link.", expected: { context: "The lead publishes an interactive page (JavaScript that really adds and removes items) as an artifact and returns the link.", expected_agents_res: [] } }] },
  { id: "art_5_planning_flow", title: "[Artifact] a planning / flow artifact: our signup flow, give me the link", ...art,
    turns: [{ user: "Draw the planning and user flow of a signup process (steps, branches, error states) as a Claude artifact and give me the link.", expected: { context: "The lead publishes a flow/planning page with a diagram of steps, branches and error states and returns the link.", expected_agents_res: [] } }] },
];
