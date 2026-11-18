import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { ResultModule } from "@core/types.ts";
import { GOOD } from "../../../Cases/real_usecases/test_treejs_sakura/lib/seed.ts";
// Recorded sub-agent result. ONLY run(req): do the work (copy the recorded build into the workspace), return the reply. Never delete.
export default {
  id: "role-sakura-builder",
  title: "builder: the sakura page, the recorded GOOD build B (from the real session rs_sakura_page_mwm8na741)",
  description: "Copies Cases/real_usecases/test_treejs_sakura/qa/build_b_cdn into run_test/sakura and reports like a builder: files, VERIFIED node --check, NOT VERIFIED the browser run (QA's)",
  match: { agent: "builder", keywords: ["sakura"] },
  expected_input: { text: "Build run_test/sakura: a three.js sakura scene, voxel look, rotating camera, falling petals, buttons for rotate / day-sunset / petals on-off, files index.html css/style.css js/*.js (one builder, no video, no screenshots, no server)", guardrails_test: "hand-over names sakura and run_test, is at least 150 chars, and does not tell the builder to record, screenshot or run a browser" },
  run: (req) => {
    const dest = join(req.ws, "sakura"); rmSync(dest, { recursive: true, force: true }); cpSync(GOOD, dest, { recursive: true });
    return `BUILD DONE\nfiles: run_test/sakura/index.html, css/style.css, js/main.js, js/world.js, js/petals.js (three r160 from a CDN importmap: serve the folder over http)\nWHAT: a voxel cherry grove with pink blossom trees, stone lanterns, a pond and falling pink petals; auto-rotate; buttons #btn-rotate, #btn-time (day / sunset), #btn-petals (petals on / off)\nVERIFIED:\n- node --check on every js file: ok\nNOT VERIFIED:\n- the page in a browser and the demo video: left to QA\nREPORT: {"summary":"sakura voxel grove built in 5 files","files":["index.html","css/style.css","js/main.js","js/world.js","js/petals.js"]}`;
  },
} satisfies ResultModule;
