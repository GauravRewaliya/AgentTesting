import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "role-expo-qa-reviewer",
  title: "qa-reviewer: REAL checks on the built files (PASS/FAIL per check)",
  description: "Recorded work of the Expo team QA: checks files, no WIREFRAME marker, drawer navigator, dependency, store use",
  match: { agent: "qa-reviewer", keywords: ["run_test"] },
  expected_input: { text: "QA the built Expo app in run_test/notes-app", guardrails_test: "hand-over must contain ['run_test'], >= 40 chars, after ['builder']" },
  run: (req) => {
    const f = (p: string) => join(req.ws, "notes-app", p), rd = (p: string) => (existsSync(f(p)) ? readFileSync(f(p), "utf8") : "");
    const c: string[] = []; const ok = (n: string, b: boolean) => c.push(`${b ? "PASS" : "FAIL"} ${n}`);
    for (const x of ["App.js", "store.js", "package.json", "plan.md"]) ok(`${x} exists`, existsSync(f(x)));
    const a = rd("App.js");
    ok("no WIREFRAME marker left", !a.includes("WIREFRAME")); ok("App.js has createDrawerNavigator", a.includes("createDrawerNavigator"));
    ok("package.json has @react-navigation/drawer", rd("package.json").includes("@react-navigation/drawer")); ok("App.js uses the store", a.includes("useStore"));
    return "QA RESULT\n" + c.join("\n");
  },
} satisfies ResultModule;
