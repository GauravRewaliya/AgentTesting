// Small REAL deliverables for the "build" steps of the folio-popup-book module chain (apply.ts applyModule writes them into run_test/<dir_out>/).
// Why: the lead judges a sub-agent by what it can see. A step that asks "port X to a Skia screen" and leaves only a PLAN.md looked lazy to the lead (it re-asked and filed bug reports).
// Hand-written, deliberately tiny, Expo-Go-safe (Skia / Reanimated / Gesture Handler / expo-audio / expo-haptics only). Keyed by the step number n. Step 1 (explain) and step 5 (honest failure) build nothing but a mock.
export const FOLIO_BUILD: Record<number, Record<string, string>> = {
  2: {
    "src/screens/AtlasScreen.tsx": `// Phase 2: plain Skia canvas (no WebGPU). Draws one paper pattern from src/art/patterns.json the way the original atlas does: a base fill plus brush-stroke dashes.
import React from "react";
import { Canvas, Rect, Path, Skia } from "@shopify/react-native-skia";
import patterns from "../art/patterns.json";

const W = 320, H = 240;
const first = (Object.values(patterns as Record<string, { base?: string }>)[0] ?? {}) as { base?: string };

export function AtlasScreen() {
  const strokes = React.useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = 0; i < 40; i++) { const y = 6 + i * 6; p.moveTo(4, y); p.lineTo(W - 4, y + ((i * 7) % 5)); }
    return p;
  }, []);
  return (
    <Canvas style={{ width: W, height: H }}>
      <Rect x={0} y={0} width={W} height={H} color={first.base ?? "#e8dcc2"} />
      <Path path={strokes} style="stroke" strokeWidth={1.5} color="rgba(60,40,20,0.35)" />
    </Canvas>
  );
}
`,
  },
  3: {
    "src/story/sequence.ts": `// Phase 3: the chapter/scene sequence as plain state + Reanimated (no GPU). Scene index, dive in/out thresholds from src/ui/Stage.tsx, chapter card timing from src/director/world.ts.
export const SCENES = ["attic", "woods", "lantern", "deep"] as const;
export const DIVE_IN = 1.04, DIVE_BACK = 0.96, CARD_OPEN_MS = 9000;
export function nextScene(i: number, scale: number): number {
  if (scale > DIVE_IN) return Math.min(i + 1, SCENES.length - 1);
  if (scale < DIVE_BACK && i > 0) return i - 1;   // going back only from scene 1 onward
  return i;
}
`,
    "src/screens/StoryScreen.tsx": `import React from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SCENES, nextScene } from "../story/sequence";

export function StoryScreen() {
  const [scene, setScene] = React.useState(0);
  const card = useSharedValue(0);
  const pinch = Gesture.Pinch().onEnd((e) => { const n = nextScene(scene, e.scale); if (n !== scene) { setScene(n); card.value = 0; card.value = withTiming(1, { duration: 600 }); } });
  const cardStyle = useAnimatedStyle(() => ({ opacity: card.value }));
  return (
    <GestureDetector gesture={pinch}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Scene {scene}: {SCENES[scene]} (pinch out to dive in)</Text>
        <Animated.View style={cardStyle}><Text>Chapter {scene + 1}</Text></Animated.View>
      </View>
    </GestureDetector>
  );
}
`,
  },
  4: {
    "src/config.ts": `// Phase 4: the original reads launch flags from iOS launch arguments (-showreel 1). Expo Go cannot pass those, so they come from this JS config (or a URL param on web).
export const FLAGS = { showreel: false, mute: false, nohaptics: false };
`,
    "src/ui/feedback.ts": `import * as Haptics from "expo-haptics";
import { createAudioPlayer } from "expo-audio";
import { FLAGS } from "../config";

export function tap() { if (!FLAGS.nohaptics) Haptics.selectionAsync(); }
export function play(source: number) { if (FLAGS.mute) return; const p = createAudioPlayer(source); p.play(); }
`,
  },
  5: {
    "src/hinge/mockHinge.ts": `// Phase 5: modules/folio-hinge (Swift, UIHingeInteraction) and plugins/withSceneLifecycle.js cannot run in Expo Go (local native module + config plugin).
// What CAN run in Expo Go: this mock. A slider drives the same 0..1 angle the native module would emit. The real thing needs a development build (expo-dev-client).
export type HingeListener = (angle: number) => void;
const listeners = new Set<HingeListener>();
export const onHinge = (l: HingeListener) => { listeners.add(l); return () => listeners.delete(l); };
export const setMockAngle = (a: number) => listeners.forEach((l) => l(Math.max(0, Math.min(1, a))));
`,
  },
};
