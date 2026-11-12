// bun testrun/run.ts <suite> [case_id ...] [--list] [--fake] [--rerun]
// Runs a TestCases/test_folders suite on the f1 multi-agent harness (real claude by default, haiku: cents per turn; --fake = scripted agents, no model calls).
// State goes to ui/.ui-data (the same store the console and the test_structure Experiment page read), so a case you ran here can be opened there.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RealRunner, ScriptRunner, loadAgents, transcriptExistsAnywhere } from "../harness/core/base.ts";
import { MStore } from "../harness/core/board.ts";
import { SESSION_CAP } from "../harness/core/session_run.ts";
import { costOf } from "../harness/core/agent_call.ts";
import { runLead } from "../harness/lead.ts";
import { warnMissingFixtures } from "@core/fixture_policy.ts";
import { agentsFor, declareGateLimit, judgeTurn, reconcileDead, loadSuites, readExp, statusOf, taskFor, unsupported, writeExp } from "./cases.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), DATA = join(ROOT, "ui", ".ui-data"), E = process.env;
const argv = process.argv.slice(2), flags = new Set(argv.filter((a) => a.startsWith("--"))), [suite, ...want] = argv.filter((a) => !a.startsWith("--"));
const STORE = resolve(E.UI_STORE ?? join(DATA, "store.json")), REPO = resolve(E.UI_REPO ?? join(DATA, "repo")), EXP = join(DATA, "exp.json");
const fake = flags.has("--fake");
if (!suite) { console.log("usage: bun testrun/run.ts <suite> [case_id ...] [--list] [--fake] [--rerun]"); process.exit(1); }
const all = await loadSuites(), mine = all.filter((c) => c.suite === suite);
if (!mine.length) { console.log(`no suite "${suite}". Suites: ${[...new Set(all.map((c) => c.suite))].join(", ")}`); process.exit(1); }
const exp = readExp(EXP);
if (flags.has("--list")) { for (const c of mine) console.log(`${c.id}${c.after ? "  (after " + c.after + ")" : ""}  ${exp[c.id] ? "[ran]" : ""}${unsupported(c) ? "  [not supported: " + unsupported(c) + "]" : ""}  ${c.title}`); process.exit(0); }

mkdirSync(DATA, { recursive: true });
if (!existsSync(join(REPO, ".git"))) {
  mkdirSync(REPO, { recursive: true }); writeFileSync(join(REPO, "README.md"), "# scratch project\nThe agents work here.\n");
  const g = (...a: string[]) => execFileSync("git", ["-C", REPO, "-c", "user.name=ui", "-c", "user.email=ui@local", ...a], { stdio: "ignore" });
  g("init", "-q"); g("add", "-A"); g("commit", "-qm", "init");
}
const defs = loadAgents(join(ROOT, "harness", "agents")), store = new MStore(STORE);
if (!fake) { const freed = reconcileDead(store); if (freed.length) console.log(`(freed ${freed.length} agent(s) left running by a run that is gone: ${freed.join(", ")})`); }
const ctx = { store, defs, sessionCap: SESSION_CAP,
  runner: fake ? new ScriptRunner(async () => "(fake lead) done") : new RealRunner(600_000), transcriptExists: fake ? undefined : (_c: string, id: string) => transcriptExistsAnywhere(id) };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
for (const c of mine.filter((x) => !want.length || want.includes(x.id))) {
  const why = unsupported(c);
  if (why) { console.log(`\n## ${c.id}: SKIPPED  ${why}`); continue; }
  warnMissingFixtures(c);   // fixtures live in ONE place (agent_fixture); a case without one warns unless it says allow_real_subAg: true
  if (c.after && !exp[c.after]?.done) { console.log(`\n## ${c.id}: needs "${c.after}" to run first (run the suite in order, or name both)`); failed++; continue; }
  const rerun = !!exp[c.id], planned = taskFor(c, all, exp), task = rerun && planned === exp[c.id]!.task ? planned + "_" + Date.now().toString(36) : planned;   // a rerun never overwrites: it is a new task you can compare
  if (rerun && !flags.has("--rerun")) { console.log(`\n## ${c.id}: already ran in task ${exp[c.id]!.task} (--rerun runs it again in a new task)`); continue; }
  const runTask = task, ent = (exp[c.id] = { case: c.id, task: runTask, suite, agents: agentsFor(c), marks: [] as number[], started: [] as number[], done: 0, at: Date.now() });
  console.log(`\n## ${c.id}: ${c.title}   [task ${runTask}, agents: ${ent.agents.join(", ")}]`);
  const judged = []; let cost = 0;
  for (let i = 0; i < c.turns.length; i++) {
    store.reload(); ent.marks[i] = store.calls.filter((x) => x.task_id === runTask).length; ent.started[i] = Date.now(); writeExp(EXP, exp);
    declareGateLimit(store, runTask, c);
    const out = await runLead({ ...ctx, store } as never, { task_id: runTask, repo: REPO, request: c.turns[i]!.user, maxDepth: 4, runner: fake ? "fake" : "real", writerMode: "shared", agents: ent.agents });
    store.reload();
    // let the sub-agents the lead left running (--async) finish before judging
    for (let w = 0; w < 600 && store.agentsOf(runTask).some((a) => a.status === "running" && a.name !== "lead"); w++) { await sleep(1000); store.reload(); }
    const files = existsSync(REPO) ? readdirSync(REPO).filter((f) => f !== ".git") : [];
    const j = judgeTurn(store, runTask, c, i, ent.marks[i]!, undefined, files, new Set(defs.keys()));
    if (!j.reply && out.ok) j.reply = out.reply;
    judged.push(j); ent.done = i + 1; writeExp(EXP, exp);
    const turnCost = costOf(store, runTask, out.row.agent_id); cost = turnCost;
    console.log(`-- turn ${i + 1}  ${j.match && !j.guard && !j.gate ? "MATCH" : "DIFFERS"}${j.guard ? "  GUARD: a distractor was called" : ""}${j.gate ? "  GATE FAILED: " + j.gate : ""}   lead_ok=${out.ok}   cost so far=$${cost.toFixed(4)}`);
    console.log("   EXPECTED context : " + j.expectedContext);
    console.log("   EXPECTED calls   : " + (j.expected.map((e) => `${e.kind}:${e.role}`).join(", ") || "(none: the lead must not delegate)"));
    console.log("   ACTUAL calls     : " + (j.calls.map((x) => `${x.kind}:${x.role}${x.custom ? "(custom agent: " + x.title + ")" : x.title && x.title !== x.role ? "(" + x.title + ")" : ""} -> ${x.agent}`).join(", ") || "(none)"));
    for (const x of j.calls) console.log(`      ${x.agent}: ${x.objective.replace(/\s+/g, " ").slice(0, 200)}`);
    for (const x of j.denied) console.log(`   REFUSED          : ${x.role} ${x.reason}`);
    console.log("   lead reply       : " + j.reply.replace(/\s+/g, " ").slice(0, 400));
  }
  if (statusOf(judged) !== "pass") failed++;
  console.log(`=> ${c.id}: ${statusOf(judged).toUpperCase()} (judged by who was called; read EXPECTED context above for the rest)`);
}
process.exit(failed ? 1 : 0);
