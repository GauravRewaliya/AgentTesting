// Free check of the web-setup fixtures (no model): bun TestCases/test_folders/test_web_setup/verify.ts   (needs docker + the image agent-testing-claude:1 with Bun)
// Runs the fixture through the REAL FixtureGate: missing name / options -> NEEDS_PARENT (a question, not served work), then the REAL generator runs in a container and the created project is inspected.
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MStore } from "../../../test_harness/core/orchistraitor/f1_multiagent/harness/core/board.ts";
import { FixtureGate } from "../../../test_harness/core/orchistraitor/f1_multiagent/harness/core/fixture_gate.ts";

let bad = 0; const ok = (n: string, c: boolean, x = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); if (!c) bad++; };
const d = mkdtempSync(join(tmpdir(), "ws-")), st = new MStore(join(d, "s.json")), gate = new FixtureGate({ run: async () => { throw new Error("no real call"); } } as never, () => st, 8);
let n = 0; const ask = (p: string, a = "web-setup#1") => gate.run({ agent: { name: "web-setup", fixtures: true }, row: { task_id: "T", agent_id: a, caller_agent_id: "lead", parent_session_id: "L", last_call_id: "c" + ++n }, cwd: d, prompt: p, session: { id: "u" + n, resume: false } } as never);
const pkg = (dir: string) => { const f = join(d, "run_test", dir, "package.json"); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; };
const deps = (p: { dependencies?: object; devDependencies?: object } | null) => Object.keys({ ...(p?.dependencies ?? {}), ...(p?.devDependencies ?? {}) });

let r = await ask("Create a Vue project in run_test. Use the official generator and report the command you ran.");
ok("Vue, NO name: the sub-agent asks (NEEDS_PARENT), nothing runs", r.ok && r.reply.startsWith("NEEDS_PARENT:") && r.reply.includes("name") && !existsSync(join(d, "run_test")));
r = await ask("Create the Vue project shop-ui in run_test/shop-ui with the official generator and report the command you ran.");
ok("Vue, name but NO options: asks for the options", r.reply.startsWith("NEEDS_PARENT:") && /Pinia|options/.test(r.reply) && !existsSync(join(d, "run_test/shop-ui")));
r = await ask("Create the Vue project neg-ui in run_test/neg-ui with TypeScript and Vue Router. Do NOT add JSX, ESLint or Prettier, and no Vitest. Run the generator and report the command.", "web-setup#3");
ok("negated options are NOT turned into flags (no JSX / ESLint / Prettier / Vitest)", r.ok && r.reply.includes("bun create vue@latest neg-ui --ts --router") && !/--(jsx|eslint|prettier|vitest)/.test(r.reply.split("\n")[0]), r.reply.split("\n")[0].slice(0, 120));
const t0 = Date.now();
r = await ask("Create the Vue project shop-ui in run_test/shop-ui with TypeScript, Vue Router and Pinia, plus Vitest. Nothing else. Run the official generator and report the command you ran.");
const p = pkg("shop-ui"), dv = deps(p);
ok("Vue with options: the REAL generator ran, the command is reported", r.ok && r.reply.includes("bun create vue@latest shop-ui --ts --router --pinia --vitest") && r.reply.includes("REPORT:"), `${((Date.now() - t0) / 1000).toFixed(0)} s`);
ok("  the project has exactly what was chosen (vue, vue-router, pinia, vitest, typescript)", ["vue", "vue-router", "pinia", "vitest", "typescript"].every((x) => dv.includes(x)) && !dv.includes("eslint"), dv.join(","));
ok("  nothing was installed in the workspace (no node_modules)", !existsSync(join(d, "run_test/shop-ui/node_modules")));
{ const h = st.fixtureSessions.flatMap((x) => x.history); ok("  the NEEDS_PARENT answers are recorded as questions, not as served work (2 served runs: neg-ui and shop-ui; 2 questions)", h.filter((x) => x.kind === "served").length === 2 && h.filter((x) => x.kind === "corrected").length === 2); }
r = await ask("Set up a React project in run_test/dash-ui.", "web-setup#2");   // NOTE the full stop after the name
ok("React, no language: asks TypeScript or JavaScript", r.reply.startsWith("NEEDS_PARENT:") && /TypeScript/.test(r.reply));
r = await ask("Set up a React project in run_test/dash-ui with TypeScript. Run the official generator and report the command.", "web-setup#2");
const pr = pkg("dash-ui"), dr = deps(pr);
ok("a name followed by the end-of-sentence full stop is not part of the folder name (run_test/dash-ui, not dash-ui.)", existsSync(join(d, "run_test/dash-ui")) && !existsSync(join(d, "run_test/dash-ui.")));
ok("React with TypeScript: `bun create vite@latest dash-ui --template react-ts` ran", r.ok && r.reply.includes("bun create vite@latest dash-ui --template react-ts"), r.reply.split("\n")[0].slice(0, 90));
ok("  the project has react, vite, typescript", ["react", "vite", "typescript"].every((x) => dr.includes(x)), dr.join(","));
console.log(bad ? `\n${bad} FAILED` : "\nweb-setup fixtures: all ok"); console.log("workspace:", join(d, "run_test")); process.exit(bad ? 1 : 0);
