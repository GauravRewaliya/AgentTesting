import type { ResultModule } from "@core/types.ts";
// POSITIVE recorded expo-go result of the rework case: the sub-agent now FOLLOWS the plan. It removes the shortcut file and applies the developer's real diff (commit 4072c98: hooks/usePillGestures.ts,
// hooks/useSearchGestures.ts, constants/theme.ts, TabBar/TabBarPill/SearchButton/TabIcon/App wired). Shares the work with phase 2 of the real chain (store/expo_go/apply.ts). Never delete.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_02_rework_fix",
  title: "expo-go (POSITIVE): linear-tab-bar draggable pill, plan followed",
  description: "Deletes the inline DragPill.tsx shortcut and builds the pill as planned: hooks/usePillGestures.ts + useSearchGestures.ts, constants/theme.ts, wired into TabBar, TabBarPill, SearchButton, TabIcon, App.tsx (real commit 4072c98)",
  match: { agent: "expo-go", keywords: ["linear", "draggable pill"], after: "role-expo-go-eg_lintab_02_rework" },
  expected_input: { text: "Redo the draggable pill per the plan: it is missing hooks/usePillGestures.ts, hooks/useSearchGestures.ts and the constants/theme.ts values; remove the inline DragPill.tsx; wire it into TabBar and App.tsx.", guardrails_test: "hand-over must contain ['linear','draggable pill'] plus run_test and PLAN.md, restate the whole plan and name what the first attempt got wrong" },
  run: (req) => {
    rmSync(join(req.ws, "linear/src/components/TabBar/DragPill.tsx"), { force: true });
    return "You are right, sorry: I put everything in one DragPill.tsx and skipped the structure. Fixed now: removed DragPill.tsx, gesture logic is in hooks/usePillGestures.ts + hooks/useSearchGestures.ts, values in constants/theme.ts, all wired in.\n\n" + applyPhase(req, { name: "linear-tab-bar", n: 2, dir: "linear", skills: ["expo-native-ui", "expo-animation"], expo_go: "ok", blockers: [] });
  },
} satisfies ResultModule;
