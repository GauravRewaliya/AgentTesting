// Comparison: which set-up is cheaper and gives better output? Same tasks, deterministic quality scores, real claude -p.
//   bun self_test/compare.ts [--reps 2] [--only C-solo-haiku,R-multi-mix]      results: self_test/compare_results.json + compare_report.md
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkRepo, rm } from "./lib.ts";
import { loadDefs as loadPipeDefs, loadPipeline } from "../harness/main.ts";
import { RealRunner, Store, projectDirFor, runTask, type AgentDef } from "../harness/core/base.ts";
import { MStore } from "../harness/core/board.ts";
import { currentApproach } from "../approaches/index.ts";
const runLead = (ctx: Parameters<ReturnType<typeof currentApproach>["runLead"]>[0], o: Parameters<ReturnType<typeof currentApproach>["runLead"]>[1]) => currentApproach("a1_team_cli").runLead(ctx, o);   // these checks are about the a1 lead (Bash `team` commands)
import { loadDefs as loadMultiDefs } from "../harness/main.ts";

const args = process.argv.slice(2), arg = (k: string, d?: string) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1]! : d; };
const REPS = Number(arg("reps", "2")), ONLY = arg("only")?.split(",");
const OUT = join(import.meta.dirname, "compare_results.json");

// ------------------------------------------------------------------ task 1: coding (deterministic hidden-ish check, rules are fully stated)
const CODING_REQUEST = `Create duration.js (CommonJS) exporting parseDuration(str) that returns whole seconds as a number. Rules: units are d (86400), h (3600), m (60), s (1), lowercase only. A duration is one or more tokens of number+unit such as 1h30m15s, in any order, and whitespace between tokens is allowed (1h 30m). Each unit may appear at most once (a duplicate unit throws TypeError). A number without a unit, an empty or blank string, a non-string argument, a decimal number, or any other character throws TypeError with the message "invalid duration". Numbers are non-negative integers. A total above 1000000000 seconds throws RangeError. Examples: "1h30m" -> 5400, "2d" -> 172800, "0s" -> 0, "90s" -> 90.`;
const CHECK_JS = `let f;try{f=require('./duration.js').parseDuration}catch(e){console.log('PASSED 0/16 (load: '+e.message+')');process.exit(1)}
const T=[["1h30m",5400],["2d",172800],["0s",0],["90s",90],["1h 30m",5400],["30m1h",5400],["1d1h1m1s",90061],["",'T'],["   ",'T'],["5",'T'],["1h1h",'T'],["1H",'T'],["abc",'T'],[null,'T'],["99999999999s",'R'],["1.5h",'T']];
let ok=0;for(const [i,o] of T){try{const g=f(i);if(o!=='T'&&o!=='R'&&g===o)ok++}catch(e){if(o==='T'&&e instanceof TypeError&&e.message==='invalid duration')ok++;else if(o==='R'&&e instanceof RangeError)ok++}}
console.log('PASSED '+ok+'/16');process.exit(ok===16?0:1)`;
const passedOf = (cwd: string) => { const r = spawnSync("node", ["check.js"], { cwd, encoding: "utf8" }); const m = (r.stdout ?? "").match(/PASSED (\d+)\/(\d+)/); return m ? Number(m[1]) / Number(m[2]) : 0; };

// ------------------------------------------------------------------ task 2: research over six documents (made-up facts, digit-free filler)
const FILLER = ["The team reviews this area on a regular schedule.", "Several earlier notes were merged into this page.", "Access is limited to staff who completed the training.", "Changes require approval from the owner of the area.", "The older process was retired after a long review.", "Questions go to the support desk, not to individuals.", "This page replaces the previous guide for the area.", "Reports are filed at the end of every cycle.", "Exceptions are listed in the appendix of the handbook.", "Suppliers are asked to confirm the details in writing."];
const FACTS = [["falcon.md", "The vault access code for Project Falcon is QX-4471."], ["lisbon.md", "The Lisbon office opened in March 2019 with 42 staff."], ["ferry.md", "The Alder-Brixton ferry runs every 35 minutes."], ["sensors.md", "The calibration tolerance for sensor type M7 is 0.012 mm."], ["billing.md", "The backup window for the billing database starts at 02:40 UTC."], ["orion.md", "The warranty on the Orion pump is 27 months."]] as const;
const QUESTIONS = ["What is the vault access code for Project Falcon?", "How many staff did the Lisbon office open with?", "How often does the Alder-Brixton ferry run (in minutes)?", "What is the calibration tolerance for sensor type M7?", "At what time (UTC) does the billing database backup window start?", "How many months is the warranty on the Orion pump?"];
const ANSWERS = [/QX-4471/, /\b42\b/, /\b35\b/, /0\.012/, /02:40/, /\b27\b/];
const docs = () => Object.fromEntries(FACTS.map(([f, fact], i) => ["docs/" + f, `# ${f.replace(".md", "")}\n\n` + Array.from({ length: 24 }, (_, k) => (k === 12 ? fact : FILLER[(i * 3 + k) % FILLER.length]!)).join("\n") + "\n"]));
const RESEARCH_Q = QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n");
const score = (text: string) => ANSWERS.filter((r) => r.test(text)).length / ANSWERS.length;

// ------------------------------------------------------------------ configs
const SOLO_PROMPT = join(import.meta.dirname, "compare_solo.md");
writeFileSync(SOLO_PROMPT, "You are a single engineer working alone in the current directory. Do exactly what is asked. If a check script exists, run it with node and fix until it passes. Finish with a short summary. If asked questions about documents, read the files and answer each question on its own numbered line.\n");
const soloDef = (model: string, writes: boolean): AgentDef => ({ name: "solo", role: "solo", description: "solo", model, session: "none", writes, max_children: 0, agents: [], tiers: [], dir: "", prompt_file: SOLO_PROMPT,
  allow: writes ? ["Read", "Write", "Edit", "Glob", "Grep", "Bash(node *)", "Bash(ls *)", "Bash(cat *)"] : ["Read", "Glob", "Grep"], tools: writes ? ["Read", "Write", "Edit", "Glob", "Grep", "Bash"] : ["Read", "Glob", "Grep"] });
const withModels = (defs: Map<string, AgentDef>, m: Record<string, string>) => new Map([...defs].map(([k, d]) => [k, { ...d, model: m[k] ?? d.model }]));

interface Run { config: string; rep: number; cost: number; secs: number; calls: number; quality: number; note: string }
type Cfg = { id: string; task: "coding" | "research"; what: string; run: () => Promise<Omit<Run, "config" | "rep">> };
const soloRun = async (task: "coding" | "research", model: string) => {
  const cwd = task === "coding" ? mkRepo({ "check.js": CHECK_JS }) : mkRepo(docs());
  try {
    const store = new Store(), row = store.addAgent("s", soloDef(model, task === "coding"));
    const t0 = Date.now(), r = await new RealRunner(400_000).run({ agent: soloDef(model, task === "coding"), row, cwd, session: { id: randomUUID(), resume: false },
      prompt: task === "coding" ? `${CODING_REQUEST}\n\nThe check script is check.js (run: node check.js).` : `Answer from the files in docs/:\n${RESEARCH_Q}` });
    return { cost: r.cost, secs: (Date.now() - t0) / 1000, calls: 1, quality: task === "coding" ? passedOf(cwd) : score(r.reply), note: r.ok ? "" : "ERR " + r.error };
  } finally { rmSync(projectDirFor(cwd), { recursive: true, force: true }); rm(cwd); }
};
const pipeRun = async (models: Record<string, string>) => {
  const cwd = mkRepo({ "check.js": CHECK_JS }), store = new Store(), defs = withModels(loadPipeDefs(), models);
  try {
    store.addRequest("p", CODING_REQUEST);
    const t0 = Date.now(), r = await runTask({ ctx: { store, runner: new RealRunner(400_000), defs, sessionCap: 3 }, pipeline: loadPipeline(), task_id: "p", cwd, checkCmd: "node check.js", costCap: 1.0, maxRounds: 3 });
    return { cost: r.cost, secs: (Date.now() - t0) / 1000, calls: store.evs("agent.start").length, quality: passedOf(cwd), note: `${r.status}${r.status === "done" ? "" : ": " + r.reason.slice(0, 60)}, ${r.rounds} round(s)` };
  } finally { rmSync(projectDirFor(cwd), { recursive: true, force: true }); rm(cwd); }
};
const multiRun = async (models: Record<string, string>) => {
  const cwd = mkRepo(docs()), file = join(cwd, "..", "cmp-" + randomUUID().slice(0, 6) + ".json"), store = new MStore(file), defs = withModels(loadMultiDefs(), models);
  try {
    const t0 = Date.now();
    const lead = await runLead({ store, runner: new RealRunner(400_000), defs, sessionCap: 3 }, { task_id: "m", repo: cwd, maxDepth: 4, runner: "real", models,
      request: `Answer these six questions from the documents in docs/:\n${RESEARCH_Q}\n\nOpen exactly three NEW researchers, each given two of the questions, then combine their answers. Give the final answer as six numbered lines.` });
    store.reload();
    const cost = lead.cost + store.reports.reduce((s, r) => s + r.cost, 0);
    return { cost, secs: (Date.now() - t0) / 1000, calls: 1 + store.calls.filter((c) => c.status === "done").length, quality: score(lead.reply), note: `${store.calls.filter((c) => c.status === "done").length} delegations, ${store.calls.filter((c) => c.status === "denied").length} denied${lead.ok ? "" : ", lead ERR " + lead.error}` };
  } finally { rmSync(projectDirFor(cwd), { recursive: true, force: true }); rm(cwd); rmSync(file, { force: true }); rmSync(file + ".board", { force: true }); }
};
const CONFIGS: Cfg[] = [
  { id: "C-solo-haiku", task: "coding", what: "one agent, haiku, does everything", run: () => soloRun("coding", "haiku") },
  { id: "C-solo-sonnet", task: "coding", what: "one agent, sonnet, does everything", run: () => soloRun("coding", "sonnet") },
  { id: "C-pipe-haiku", task: "coding", what: "plan/build/review loop, all haiku", run: () => pipeRun({}) },
  { id: "C-pipe-mix", task: "coding", what: "plan/review haiku, BUILDER sonnet", run: () => pipeRun({ builder: "sonnet" }) },
  { id: "R-solo-haiku", task: "research", what: "one agent, haiku, reads all 6 docs", run: () => soloRun("research", "haiku") },
  { id: "R-solo-sonnet", task: "research", what: "one agent, sonnet, reads all 6 docs", run: () => soloRun("research", "sonnet") },
  { id: "R-multi-haiku", task: "research", what: "lead + 3 researchers, all haiku", run: () => multiRun({}) },
  { id: "R-multi-mix", task: "research", what: "lead haiku, 3 researchers SONNET", run: () => multiRun({ researcher: "sonnet" }) },
];

const done: Run[] = existsSync(OUT) && !args.includes("--fresh") ? JSON.parse(readFileSync(OUT, "utf8")) : [];
for (let rep = 1; rep <= REPS; rep++) for (const c of CONFIGS) {
  if (ONLY && !ONLY.includes(c.id)) continue;
  if (done.some((d) => d.config === c.id && d.rep === rep)) continue;
  console.log(`running ${c.id} rep ${rep} ...`);
  const r = { config: c.id, rep, ...(await c.run().catch((e) => ({ cost: 0, secs: 0, calls: 0, quality: 0, note: "CRASH " + String(e).slice(0, 80) }))) };
  done.push(r); writeFileSync(OUT, JSON.stringify(done, null, 1));
  console.log(`  cost $${r.cost.toFixed(4)}  ${r.secs.toFixed(0)}s  calls=${r.calls}  quality=${(r.quality * 100).toFixed(0)}%  ${r.note}`);
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const rows = CONFIGS.map((c) => { const rs = done.filter((d) => d.config === c.id); return { c, n: rs.length, cost: avg(rs.map((r) => r.cost)), secs: avg(rs.map((r) => r.secs)), calls: avg(rs.map((r) => r.calls)), q: avg(rs.map((r) => r.quality)), min: Math.min(...rs.map((r) => r.quality)), notes: rs.map((r) => r.note).filter(Boolean).join(" | ") }; }).filter((r) => r.n);
const md = ["# Comparison: cheaper vs better output", "", `Generated ${new Date().toISOString()}. Real \`claude -p\`, ${REPS} repetition(s) per set-up (small sample: treat differences under ~20% as noise).`, "",
  "Quality: coding = share of 16 fixed test cases passed by the delivered file; research = share of 6 made-up facts found in the final answer.", "",
  "| set-up | task | what | runs | avg cost | avg time | avg calls | avg quality | worst run |", "|---|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.c.id} | ${r.c.task} | ${r.c.what} | ${r.n} | $${r.cost.toFixed(4)} | ${r.secs.toFixed(0)} s | ${r.calls.toFixed(1)} | ${(r.q * 100).toFixed(0)}% | ${(r.min * 100).toFixed(0)}% |`), "",
  "## Notes per run", "", ...done.map((d) => `- ${d.config} #${d.rep}: $${d.cost.toFixed(4)}, ${d.secs.toFixed(0)}s, ${d.calls} call(s), ${(d.quality * 100).toFixed(0)}% ${d.note ? "(" + d.note + ")" : ""}`)].join("\n");
writeFileSync(join(import.meta.dirname, "compare_report.md"), md);
console.log("\n" + md.split("\n").filter((l) => l.startsWith("|")).join("\n"));
console.log("COMPARE DONE");
