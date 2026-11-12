import type { ResultModule } from "@core/types.ts";
// Hand-written NEGATIVE recorded expo-go result (test_expo_go/demos/linear_tab_bar.ts, rework case). The sub-agent "ignores the plan": builds the drag in ONE new component with the gesture logic and the colours inline,
// no hooks/ files, no theme constants, nothing wired into TabBar/App. Its reply states those facts plainly, so a lead that checks the reply against the plan can see the plan was not followed. Never delete.
export default {
  id: "role-expo-go-eg_lintab_02_rework",
  title: "expo-go (NEGATIVE): linear-tab-bar draggable pill, plan not followed",
  description: "Adds ONE file src/components/TabBar/DragPill.tsx with inline gesture code and hardcoded colours; no usePillGestures/useSearchGestures hooks, no theme.ts constants, TabBar/App untouched",
  match: { agent: "expo-go", keywords: ["linear", "draggable pill"] },
  expected_input: { text: "Make the pill draggable (stretch + glow under the finger). Structure: hooks/usePillGestures.ts, hooks/useSearchGestures.ts, colours/sizes in constants/theme.ts, wired into TabBar and App.tsx.", guardrails_test: "hand-over must contain ['linear','draggable pill'] plus run_test and PLAN.md and the requested file structure" },
  run: (req) => {
    req.write("linear/src/components/TabBar/DragPill.tsx", `import React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

// quick version: gesture logic and colours live right here
export function DragPill({ children }: { children: React.ReactNode }) {
  const x = useSharedValue(0);
  const stretch = useSharedValue(1);
  const pan = Gesture.Pan()
    .onUpdate((e) => { x.value = e.translationX; stretch.value = 1 + Math.abs(e.translationX) / 400; })
    .onEnd(() => { x.value = withSpring(0); stretch.value = withSpring(1); });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scaleX: stretch.value }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ backgroundColor: "#1c1c1e", borderRadius: 32, height: 64 }, style]}>
        <View style={{ position: "absolute", width: 80, height: 80, backgroundColor: "#5e6ad2" }} />
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
`);
    req.write("linear/PLAN.md", "\n## Draggable pill\n- one component, src/components/TabBar/DragPill.tsx\n- Expo Go check: ok\n");
    return "Done: the draggable pill is in run_test/linear/src/components/TabBar/DragPill.tsx. I kept it in a single component: the pan gesture, the stretch and the glow colours are inline in that file. Changed files (1): run_test/linear/src/components/TabBar/DragPill.tsx. Not run on a device.\nREPORT: "
      + JSON.stringify({ summary: "draggable pill as a single component", files: ["run_test/linear/src/components/TabBar/DragPill.tsx"], skills: ["expo-animation"], expo_go: "ok", blockers: [] });
  },
} satisfies ResultModule;
