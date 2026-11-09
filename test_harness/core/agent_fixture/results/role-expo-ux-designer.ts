import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "role-expo-ux-designer",
  title: "ux-designer: writes the wireframe (pseudo code) at the real paths",
  description: "Recorded work of the Expo team UX designer: App.js / store.js wireframes marked WIREFRAME plus wireframe.md",
  match: { agent: "ux-designer", keywords: ["wireframe"] },
  expected_input: { text: "Write the wireframe for the Expo notes app from plan.md: drawer navigation and a zustand list", guardrails_test: "hand-over must contain ['plan.md', 'wireframe', 'drawer', 'zustand', 'run_test'], >= 250 chars, after ['planner']" },
  run: (req) => {
    if (!existsSync(join(req.ws, "notes-app/plan.md"))) return "ERROR: plan.md not found, planner has not run";
    const head = readFileSync(join(req.store, "expo_examples/with-drawer-navigation/App.js"), "utf8").split("\n").slice(0, 2).join("\n");
    const app = `// WIREFRAME (pseudo code) - the builder replaces this file with the original example code
${head}
// import store (zustand)            <- from with-zustand/store.js
Screen Home:          [Button "Open navigation drawer"] [List: store.items] [Button "Add Item" -> store.addItem]
Screen Notifications: [Button "Open navigation drawer"] [Button "Go back home"]
Drawer.Navigator initialRouteName="Home"  ->  Home, Notifications
`;
    const store = `// WIREFRAME (pseudo code) - replaced by the builder
store: items[] ; addItem(text) ; reset()
`;
    req.write("notes-app/App.js", app); req.write("notes-app/store.js", store);
    req.write("notes-app/wireframe.md", "```\n+-------------------+\n| =  Home           |\n| item #0           |\n| item #1           |\n| [Add Item][reset] |\n+-------------------+\n```\nFlow: Home <-> Notifications through the drawer; the list lives in the zustand store.\n");
    return `WIREFRAME READY\npaths: run_test/notes-app/App.js, run_test/notes-app/store.js, run_test/notes-app/wireframe.md\n--- App.js (wireframe) ---\n${app}--- store.js (wireframe) ---\n${store}`;
  },
} satisfies ResultModule;
