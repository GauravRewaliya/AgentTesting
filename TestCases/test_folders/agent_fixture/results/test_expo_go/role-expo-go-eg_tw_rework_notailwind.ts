import type { ResultModule } from "@core/types.ts";
// Hand-written NEGATIVE recorded expo-go result (test_expo_go/examples/tailwind_reanimated.ts, rework case). The sub-agent does PART of the job: a working Expo Router app, but styled with StyleSheet,
// no NativeWind/Tailwind at all (no nativewind/tailwind packages, no global.css, no metro/postcss config, no tw wrappers). The reply says plainly how it styled things, so a lead that checks it against the request sees Tailwind is missing. Never delete.
export default {
  id: "role-expo-go-eg_tw_rework_notailwind",
  title: "expo-go (NEGATIVE): router app built WITHOUT Tailwind/NativeWind",
  description: "Writes app.json, package.json (no nativewind/tailwind), src/app/_layout.tsx and src/app/index.tsx styled with StyleSheet; no global.css, metro.config.js, postcss.config.mjs or tw wrappers",
  match: { agent: "expo-go", keywords: ["tw-rework", "nativewind"] },
  expected_input: { text: "Create an Expo Router app styled with Tailwind through NativeWind: root layout, index screen styled only with className, tw wrappers, global.css, Metro/PostCSS setup.", guardrails_test: "hand-over must contain ['tw-rework','nativewind'] plus run_test and PLAN.md and list the Tailwind/NativeWind pieces wanted" },
  run: (req) => {
    req.write("tw-rework/package.json", JSON.stringify({ name: "tw-rework", main: "expo-router/entry", version: "1.0.0", dependencies: { expo: "^57.0.0", "expo-router": "~57.0.0", react: "19.1.0", "react-native": "0.81.0", "react-native-reanimated": "~4.1.0" } }, null, 2) + "\n");
    req.write("tw-rework/app.json", JSON.stringify({ expo: { name: "tw-rework", slug: "tw-rework", scheme: "tw-rework", plugins: ["expo-router"] } }, null, 2) + "\n");
    req.write("tw-rework/src/app/_layout.tsx", `import { Slot } from "expo-router";\n\nexport default function Layout() {\n  return <Slot />;\n}\n`);
    req.write("tw-rework/src/app/index.tsx", `import { StyleSheet, Text, View } from "react-native";\n\nexport default function Page() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.title}>Hello</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },\n  title: { fontSize: 24, fontWeight: "bold" },\n});\n`);
    req.write("tw-rework/PLAN.md", "\n## Tailwind app\n- Expo Router app, root layout + index screen\n- Expo Go check: ok\n");
    return "Done: the Expo Router app is in run_test/tw-rework. Root layout uses a Slot and the index screen is styled with StyleSheet.create. Changed files (4): run_test/tw-rework/package.json, app.json, src/app/_layout.tsx, src/app/index.tsx. Not run on a device.\nREPORT: "
      + JSON.stringify({ summary: "router app with StyleSheet styles", files: ["run_test/tw-rework/package.json", "run_test/tw-rework/app.json", "run_test/tw-rework/src/app/_layout.tsx", "run_test/tw-rework/src/app/index.tsx"], skills: ["expo-router"], expo_go: "ok", blockers: [] });
  },
} satisfies ResultModule;
