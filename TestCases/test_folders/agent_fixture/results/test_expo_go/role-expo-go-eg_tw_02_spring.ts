import type { ResultModule } from "@core/types.ts";
// Hand-written recorded expo-go result (test_expo_go/examples/tailwind_reanimated.ts, step 2, no git history). Replaces src/app/index.tsx of the tailwind snapshot. Never delete.
export default {
  id: "role-expo-go-eg_tw_02_spring",
  title: "expo-go: tailwind app, spring card",
  description: "Rewrites tw-app/src/app/index.tsx with a className-styled card that scales with withSpring on press; no package changes",
  match: { agent: "expo-go", keywords: ["tw-app", "spring"] },
  expected_input: { text: "In run_test/tw-app make the index screen show a className-styled card that scales down to 0.95 while pressed and springs back on release (Reanimated). No new packages.", guardrails_test: "hand-over must contain ['tw-app','spring'] plus run_test and PLAN.md, name src/app/index.tsx and say no packages are added" },
  run: (req) => {
    req.write("tw-app/src/app/index.tsx", `import React from "react";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { Pressable, Text, View } from "@/tw";

export default function Page() {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Animated.View style={style}>
        <Pressable onPressIn={() => (scale.value = withSpring(0.95))} onPressOut={() => (scale.value = withSpring(1))}>
          <View className="rounded-2xl bg-gray-100 p-6 shadow">
            <Text className="text-xl font-bold">Card</Text>
            <Text className="text-gray-500">Press me</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
`);
    const t = "tw-app/PLAN.md"; req.write(t, "## Step 2: spring card\n- file: src/app/index.tsx only; reanimated is already a dependency (no new packages)\n- Expo Go check: ok\n");
    return "Card with a press spring added in tw-app/src/app/index.tsx. No package changes. Not run on a device.\nREPORT: " + JSON.stringify({ summary: "spring card", files: ["tw-app/src/app/index.tsx"], skills: ["expo-animation"], expo_go: "ok", blockers: [] });
  },
} satisfies ResultModule;
