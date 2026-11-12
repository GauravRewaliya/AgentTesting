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
} as const satisfies Partial<Case>;
