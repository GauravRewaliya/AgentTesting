import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "role-expo-package-researcher",
  title: "package-researcher: zustand syntax and a check of the builder's store.js",
  description: "Recorded work of the package researcher: knows only zustand; reads notes-app/store.js and package.json, never changes them",
  match: { agent: "package-researcher", keywords: ["zustand"] },
  expected_input: { text: "Is the zustand code in run_test/notes-app/store.js valid for our version? Syntax to create a store and use shallow", guardrails_test: "hand-over must contain ['zustand', 'store.js'], >= 120 chars" },
  run: (req) => {
    const pj = join(req.ws, "notes-app/package.json"), sj = join(req.ws, "notes-app/store.js");
    const rng = existsSync(pj) ? (JSON.parse(readFileSync(pj, "utf8")).dependencies?.zustand ?? "?") : "?";
    const code = existsSync(sj) ? readFileSync(sj, "utf8") : "";
    const line = code ? code.slice(0, code.search(/^import create from "zustand";?$/m)).split("\n").length : 0;
    const chk = code ? [`store.js line ${line}: \`import create from "zustand"\` -> OK for ${rng} (v3 default export); breaks on zustand v5 (default export removed)`, "store.js: `create((set, get) => ...)` is valid for v3"] : ["store.js not found at the given path"];
    return `RESEARCH: zustand (range in run_test/notes-app/package.json: ${rng})
Syntax:
- create a store (v3): import create from "zustand"; const useStore = create((set, get) => ({ items: [], addItem(text) { set(...) } }))
- shallow (v3): import shallow from "zustand/shallow"; useStore(selector, shallow)
- v4+/v5: import { create } from "zustand"; import { shallow } from "zustand/shallow" (v5 drops the default exports)
Checked code:
${chk.map((x) => "- " + x).join("\n")}
Confidence: package knowledge written into this mock, not fetched from npm (unverified).`;
  },
} satisfies ResultModule;
