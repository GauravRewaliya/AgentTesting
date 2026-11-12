// The one base every expo_go case spreads in (`...expoGo`): lead (router on) may call ONE mocked sub-agent `expo-go`, hand-over is guarded, max 2 calls (rework cases set 3).
// Not a generator: each case in demos/*.ts, examples/*.ts and rework.ts is a plain object with its own id, title, user, expected.
import type { Case } from "@core/types.ts";

export const expoGo = {
  needs: ["multiagent.spawn", "guard.roles", "sandbox.files"],
  guard: "expo_go_rules.json",
  agents: ["expo-go"],
  tools: ["Agent"],
  max_agent_calls: 2,
  tags: ["multi_prompt"],
  // QA video: not set up for the Expo demos yet; a demo that is ready overrides `qa` in its own cases (see demos/solarin.ts for the shape and docs/QA_ISSUES.md for why)
  qa: (() => ({ enabled: false, why: "QA video is not set up for this Expo demo yet (docs/QA_ISSUES.md)" })) as Case["qa"],
} as const satisfies Partial<Case>;
