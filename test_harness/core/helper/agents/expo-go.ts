import type { AgentDef } from "../../core/types.ts";
// Same agent as test_harness/core/orchistraitor/f1_multiagent/harness/agents/expo-go (real prompt + expo skills live there); this entry is what the fixture-mock runner (core/run.ts) offers the lead.
export default { name: "expo-go", description: "Plans, then builds, Expo Go apps (no custom native code), using the official expo/skills. Use it for any Expo / React Native app task, incl. porting an example or demo.", role: "expo-go" } satisfies AgentDef;
