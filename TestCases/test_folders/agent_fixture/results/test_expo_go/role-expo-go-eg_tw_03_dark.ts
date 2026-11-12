import type { ResultModule } from "@core/types.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Hand-written recorded expo-go result (test_expo_go/examples/tailwind_reanimated.ts, step 3). Never delete.
// UNVERIFIED stand-in: the colour-scheme API below is NativeWind 4's `useColorScheme` from "nativewind"; the NativeWind 5 preview in this example may differ. The reply says so.
export default {
  id: "role-expo-go-eg_tw_03_dark",
  title: "expo-go: tailwind app, dark-mode toggle",
  description: "Edits only tw-app/src/app/index.tsx: toggle button + dark: classes",
  match: { agent: "expo-go", keywords: ["tw-app", "dark"] },
  expected_input: { text: "In run_test/tw-app add a dark-mode toggle button below the card on the index screen. Change nothing else.", guardrails_test: "hand-over must contain ['tw-app','dark'] plus run_test and PLAN.md, name the file and say keep the rest" },
  run: (req) => {
    const f = join(req.ws, "tw-app/src/app/index.tsx");
    let s = readFileSync(f, "utf8");
    s = s.replace('import { Pressable, Text, View } from "@/tw";', 'import { useColorScheme } from "nativewind";\n\nimport { Pressable, Text, View } from "@/tw";')
      .replace("  const scale = useSharedValue(1);", "  const { colorScheme, toggleColorScheme } = useColorScheme();\n  const scale = useSharedValue(1);")
      .replace('bg-white">', 'bg-white dark:bg-black">')
      .replace('bg-gray-100 p-6', 'bg-gray-100 dark:bg-gray-800 p-6')
      .replace('<Text className="text-xl font-bold">Card</Text>', '<Text className="text-xl font-bold dark:text-white">Card</Text>')
      .replace("    </View>\n  );\n}", '      <Pressable onPress={toggleColorScheme} className="mt-6 rounded-full bg-gray-200 dark:bg-gray-700 px-4 py-2">\n        <Text className="dark:text-white">{colorScheme === "dark" ? "Light mode" : "Dark mode"}</Text>\n      </Pressable>\n    </View>\n  );\n}');
    req.write("tw-app/src/app/index.tsx", s);
    return "Added a dark-mode toggle in tw-app/src/app/index.tsx only (useColorScheme + dark: classes). UNVERIFIED: I used the NativeWind 4 API; check it against the NativeWind 5 preview docs before relying on it. Not run on a device.\nREPORT: " + JSON.stringify({ summary: "dark toggle", files: ["tw-app/src/app/index.tsx"], skills: ["expo-design-system"], expo_go: "ok", blockers: [] });
  },
} satisfies ResultModule;
