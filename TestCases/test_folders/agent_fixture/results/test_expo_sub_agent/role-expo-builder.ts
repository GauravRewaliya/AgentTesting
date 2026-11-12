import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "role-expo-builder",
  title: "builder: replaces the wireframe with the ORIGINAL example code",
  description: "Recorded work of the Expo team builder: copies with-drawer-navigation/App.js and with-zustand/store.js over the wireframe, merges package.json",
  match: { agent: "builder", keywords: ["wireframe", "with-drawer-navigation"] },
  expected_input: { text: "Build the Expo app: replace the wireframe with the original code of with-drawer-navigation and with-zustand in run_test", guardrails_test: "hand-over must contain ['wireframe', 'plan.md', 'with-drawer-navigation', 'with-zustand', 'run_test'], >= 200 chars, after ['planner','ux-designer']" },
  run: (req) => {
    const app = join(req.ws, "notes-app/App.js");
    if (!existsSync(app) || !readFileSync(app, "utf8").includes("WIREFRAME")) return "ERROR: no wireframe to replace";
    const before = readFileSync(app, "utf8").split("\n").length;
    req.cp("expo_examples/with-drawer-navigation/App.js", "notes-app/App.js");
    req.cp("expo_examples/with-zustand/store.js", "notes-app/store.js");
    const deps = (d: string) => JSON.parse(readFileSync(join(req.store, `expo_examples/${d}/package.json`), "utf8")).dependencies ?? {};
    const merged = { ...deps("with-drawer-navigation"), ...deps("with-zustand") };
    req.write("notes-app/package.json", JSON.stringify({ name: "notes-app", main: "node_modules/expo/AppEntry.js", dependencies: Object.fromEntries(Object.entries(merged).sort()) }, null, 2) + "\n");
    return `BUILD DONE\nreplaced run_test/notes-app/App.js (${before} -> ${readFileSync(app, "utf8").split("\n").length} lines) with with-drawer-navigation/App.js\nreplaced run_test/notes-app/store.js with with-zustand/store.js\nwrote run_test/notes-app/package.json (merged dependencies of both examples)`;
  },
} satisfies ResultModule;
