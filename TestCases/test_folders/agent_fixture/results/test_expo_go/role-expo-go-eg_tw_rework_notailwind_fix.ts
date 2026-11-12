import type { ResultModule } from "@core/types.ts";
// POSITIVE recorded expo-go result of the tailwind rework case: the sub-agent now adds what it forgot. It drops the StyleSheet-only app and applies the real with-tailwindcss snapshot
// (NativeWind 5 preview: global.css, metro.config.js, postcss.config.mjs, src/tw wrappers, className-only index, packages). Shares the work with phase 1 of the real chain. Never delete.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_tw_rework_notailwind_fix",
  title: "expo-go (POSITIVE): tailwind app with NativeWind added",
  description: "Removes the StyleSheet-only app and builds the planned Tailwind setup: nativewind + @tailwindcss/postcss packages, global.css, metro.config.js, postcss.config.mjs, src/tw wrappers, className-only screens (real with-tailwindcss snapshot)",
  match: { agent: "expo-go", keywords: ["tw-rework", "nativewind"], after: "role-expo-go-eg_tw_rework_notailwind" },
  expected_input: { text: "The tailwind app is missing Tailwind: it still uses StyleSheet. Add NativeWind (packages, global.css, metro + postcss config, tw wrappers) and restyle with className only.", guardrails_test: "hand-over must contain ['tw-rework','nativewind'] plus run_test and PLAN.md, restate the whole request and say StyleSheet/no NativeWind was the problem" },
  run: (req) => {
    rmSync(join(req.ws, "tw-rework"), { recursive: true, force: true });
    const done = applyPhase(req, { name: "with-tailwindcss", n: 1, dir: "tw-rework", skills: ["expo-router", "expo-native-ui"], expo_go: "ok", blockers: [] });
    // evidence read from the files that were REALLY written, so a lead that wants proof gets it in this one answer (it has no file tools)
    const dir = join(req.ws, "tw-rework"), line = (f: string, re: RegExp) => { const p = join(dir, f); return existsSync(p) ? (readFileSync(p, "utf8").split("\n").find((l) => re.test(l)) ?? "(no match)").trim() : "(file missing)"; };
    const proof = [`package.json: ${line("package.json", /nativewind/)}`, `package.json: ${line("package.json", /"@tailwindcss\/postcss"/)}`, `package.json: ${line("package.json", /"tailwindcss":/)}`, `src/global.css: ${line("src/global.css", /tailwind|@import/)}`,
      `metro.config.js: ${line("metro.config.js", /nativewind|withNativewind|css/i)}`, `postcss.config.mjs: ${line("postcss.config.mjs", /tailwind/)}`, `src/app/index.tsx uses className: ${/className=/.test(existsSync(join(dir, "src/app/index.tsx")) ? readFileSync(join(dir, "src/app/index.tsx"), "utf8") : "")}, StyleSheet: ${/StyleSheet/.test(existsSync(join(dir, "src/app/index.tsx")) ? readFileSync(join(dir, "src/app/index.tsx"), "utf8") : "")}`];
    return "You are right, sorry: I styled it with StyleSheet and skipped Tailwind/NativeWind. Fixed now: removed the StyleSheet app and added the NativeWind packages, global.css, Metro + PostCSS config and the tw wrappers, with className-only screens.\n\n" + done + "\nVERIFIED ON DISK (lines read back from the files just written):\n" + proof.map((p) => "- " + p).join("\n") + "\n";
  },
} satisfies ResultModule;
