import type { ResultModule } from "@core/types.ts";
// POSITIVE recorded expo-go result of the linear-tab-bar rework case: the sub-agent now FOLLOWS the plan. It removes the shortcut file and applies the developer's real diff (commit 4072c98: hooks/usePillGestures.ts,
// hooks/useSearchGestures.ts, constants/theme.ts, TabBar/TabBarPill/SearchButton/TabIcon/App wired). Shares the work with phase 2 of the real chain (store/expo_go/apply.ts). It ends with lines READ BACK from the files it wrote,
// so a lead that wants proof gets it in this one answer (it has no file tools of its own on a mocked agent). Never delete.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_02_rework_fix",
  title: "expo-go (POSITIVE): linear-tab-bar draggable pill, plan followed",
  description: "Deletes the inline DragPill.tsx shortcut and builds the pill as planned: hooks/usePillGestures.ts + useSearchGestures.ts, constants/theme.ts, wired into TabBar, TabBarPill, SearchButton, TabIcon, App.tsx (real commit 4072c98), then reads key lines back from disk",
  match: { agent: "expo-go", keywords: ["linear", "draggable pill"], after: "role-expo-go-eg_lintab_02_rework" },
  expected_input: { text: "Redo the draggable pill per the plan: it is missing hooks/usePillGestures.ts, hooks/useSearchGestures.ts and the constants/theme.ts values; remove the inline DragPill.tsx; wire it into TabBar and App.tsx.", guardrails_test: "hand-over must contain ['linear','draggable pill'] plus run_test and PLAN.md, restate the whole plan and name what the first attempt got wrong" },
  run: (req) => {
    rmSync(join(req.ws, "linear/src/components/TabBar/DragPill.tsx"), { force: true });
    const done = applyPhase(req, { name: "linear-tab-bar", n: 2, dir: "linear", skills: ["expo-native-ui", "expo-animation"], expo_go: "ok", blockers: [] });
    const f = (p: string) => join(req.ws, "linear", p), read = (p: string) => (existsSync(f(p)) ? readFileSync(f(p), "utf8") : "");
    const line = (p: string, re: RegExp) => (existsSync(f(p)) ? (read(p).split("\n").find((l) => re.test(l)) ?? "(no match)").trim() : "(file missing)");
    const proof = [`src/hooks/usePillGestures.ts: ${line("src/hooks/usePillGestures.ts", /export/)}`, `src/hooks/useSearchGestures.ts: ${line("src/hooks/useSearchGestures.ts", /export/)}`, `src/constants/theme.ts: ${line("src/constants/theme.ts", /export/)}`,
      `src/components/TabBar/DragPill.tsx exists: ${existsSync(f("src/components/TabBar/DragPill.tsx"))}`, `TabBarPill imports usePillGestures: ${/usePillGestures/.test(read("src/components/TabBar/TabBarPill.tsx"))}`, `hex colours left in TabBarPill.tsx: ${(read("src/components/TabBar/TabBarPill.tsx").match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length}`];
    return "You are right, sorry: I put everything in one DragPill.tsx and skipped the structure. Fixed now: removed DragPill.tsx, gesture logic is in hooks/usePillGestures.ts + hooks/useSearchGestures.ts, values in constants/theme.ts, all wired in.\n\n" + done + "\nVERIFIED ON DISK (lines read back from the files just written):\n" + proof.map((p) => "- " + p).join("\n") + "\n";
  },
} satisfies ResultModule;
