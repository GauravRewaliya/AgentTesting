// bun testrun/run.ts <suite> [case_id ... | --all] [--again] [--list] [--fake] [--rerun] [--video] [--no-planning] [--stop-pause] [--say="next"]
//   --again        send the case's prompts AGAIN into its existing session (same task + workspace + lead conversation; nothing archived) and judge the answers. The UI's "Run" on a case that already ran.
//   --stop-pause   step mode, "next next next": the lead does ONE step (plan files -> layout wireframe -> themed UI), reports, and STOPS to wait for you. Only the first turn of the case runs; no qa_check, no full build.
//   --resume       RESUME the latest run of each named case instead of starting a new task (no --rerun): same task, same workspace, the lead conversation is resumed; the lead is told to carry on (or give your own words with --say="..."). Cases never run before start normally.
//   --resume=<id>  the same, but the lead is resumed from THIS Claude session id (the master session of an earlier run, see .state/<task>/store) instead of the one the task remembers.
//   --video-only   NO lead call at all: only the QA video / session record of the latest run of the case (needs --video for the video). Cheap way to redo a recording after fixing the QA tooling.
//   --say="next"  continues the case's EXISTING run (same task, same lead conversation, nothing is reset) with that message. Use with --stop-pause: `... <suite> <case> --real --stop-pause --say=next`.
//   --no-planning  the lead may NOT call the planner (the planner is removed from its agents and the request says so): no plan files, no planning round, the work goes straight to the builders. Use it for a quick run without the planning flow.
//   --record  write the session record (store/record/*.json) for every case; by default only a case that opts in through `qa` gets one
//   --video  after each case THAT OPTS IN (Case.qa enabled; all others: nothing), record a QA video of the web page it built (`test_harness/infra/qa/video.ts`, Docker; native Expo apps cannot be recorded: it says so). Off by default.
// Runs a TestCases/test_folders suite on the f1 multi-agent harness (real claude by default, haiku: cents per turn; --fake = scripted agents, no model calls).
// State goes to test_harness/.state/<version>/<task>/{store,workspace} (one folder per master session, see LAYOUT below). Nothing here reads or writes f1's own ui/.ui-data any more.
import { branchRun, cloneIfPending } from "./branch.ts";
import { branchWarnings, runBeforeNode } from "../../../../../TestCases/branch.ts";
import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RealRunner, ScriptRunner, loadAgents, transcriptExistsAnywhere } from "../harness/core/base.ts";
import { MStore, say } from "../harness/core/board.ts";
import { SESSION_CAP } from "../harness/core/session_run.ts";
import { costOf } from "../harness/core/agent_call.ts";
import { runLead } from "../harness/lead.ts";
import { warnMissingFixtures } from "@core/fixtures.ts";
import { FIXTURES, STATE_BASE, STATE_VERSION } from "@core/paths.ts";
import { videoAfterRun } from "../../../../infra/qa/video.ts";
import { videoOffReason } from "../harness/core/loops_ai.ts";
import { recordSession } from "../../../../infra/record_session.ts";
import { runArtifactCases } from "./artifact_run.ts";
import { agentsFor, declareGateLimit, judgeTurn, replyProblem, reconcileDead, loadSuites, readExp, statusOf, taskFor, unsupported, writeExp } from "./cases.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), E = process.env, STATE_DIR = join(STATE_BASE, STATE_VERSION);
const argv = process.argv.slice(2), flags = new Set(argv.filter((a) => a.startsWith("--"))), [suite, ...want] = argv.filter((a) => !a.startsWith("--"));   // --video-route=/x is read from argv directly
const STORE = E.UI_STORE ? resolve(E.UI_STORE) : "", REPO = E.UI_REPO ? resolve(E.UI_REPO) : "", EXP_DIR = join(STATE_DIR, "f1_exp");   // which case ran in which task (git-ignored)
const fake = flags.has("--fake"), noPlanning = flags.has("--no-planning"), stopPause = flags.has("--stop-pause") || flags.has("--stop_pause"), sayArg = argv.find((a) => a.startsWith("--say="))?.slice(6), resumeArg = argv.find((a) => a === "--resume" || a.startsWith("--resume=")), sessionArg = resumeArg?.startsWith("--resume=") ? resumeArg.slice(9) : undefined, videoOnly = flags.has("--video-only");   // --say="next" (see header)
// LAYOUT: one folder per MASTER SESSION (= the case's task id) under test_harness/.state/<version>/:
//   <task>/store/       the store (store.json + .board), session records, QA videos (qa/): NOT part of the git workspace
//   <task>/workspace/   the git workspace the agents work in (run_test/ lives here)
// UI_STORE and UI_REPO (env, both) force ONE shared store and repo instead (one-off scripts).
const perTask = !E.UI_STORE && !E.UI_REPO, homeOf = (task: string) => join(STATE_DIR, task);
const storeOf = (task: string) => (perTask ? join(homeOf(task), "store", "store.json") : STORE), repoOf = (task: string) => (perTask ? join(homeOf(task), "workspace") : REPO);
if (!suite) { console.log("usage: bun testrun/run.ts <suite> [case_id ... | --all] [--list] [--fake] [--rerun] [--video] [--record] [--no-planning] [--video-route=/screen]"); process.exit(1); }
const all = await loadSuites(), mine = all.filter((c) => c.suite === suite);
for (const w of branchWarnings(all)) console.log("WARNING " + w);   // extra `after` siblings were turned into branches automatically; fix the file when convenient
if (!mine.length) { console.log(`no suite "${suite}". Suites: ${[...new Set(all.map((c) => c.suite))].join(", ")}`); process.exit(1); }
// which case ran in which task: ONE FILE PER CASE (parallel runs of different chains must not overwrite each other's entries)
const readExpDir = (): Record<string, ReturnType<typeof readExp>[string]> => { const o: Record<string, ReturnType<typeof readExp>[string]> = {}; if (existsSync(EXP_DIR)) for (const f of readdirSync(EXP_DIR)) { try { const j = JSON.parse(readFileSync(join(EXP_DIR, f), "utf8")); o[j.case] = j; } catch { /* half-written */ } } return o; };
const saveExp = (e: { case: string }) => { mkdirSync(EXP_DIR, { recursive: true }); writeFileSync(join(EXP_DIR, e.case + ".json"), JSON.stringify(e)); };
const exp = readExpDir();
// --last / --video-only / --say all mean "continue the EXISTING run of the case" (same task, same workspace; nothing is reset); sayMsg is the message to the lead (videoOnly: a marker, no lead call)
const wantIds = want.length ? want : mine.map((c) => c.id), resumable = (!!resumeArg || videoOnly) && wantIds.every((w) => exp[w]);
// A message the HARNESS made up (the --resume "Carry on ..." prompt, the --video-only marker) is an auto run: it is NOT a message of the person, so it is not mirrored into the session chat; its notes carry the ref "auto_run" (the UI chat hides them). A --fake run has no real answer ("(fake lead) done"): its reply is never put in the chat either.
const autoRun = flags.has("--auto") || (sayArg === undefined && (videoOnly || !!resumeArg)), chatRefs = autoRun ? ["testrun", "auto_run"] : ["testrun"];
// --again: send the case's prompts AGAIN into its EXISTING session (same task, same workspace, same lead conversation: nothing is archived or reset) and judge the answers; this is what the UI's "Run" does for a case that already ran.
const againFlag = flags.has("--again");
let again = againFlag;   // per case (see the loop): a case with REAL sub-agents is never sent "again" into its old session, it runs in a fresh one
const reuse = (m: string | undefined) => !!m || again;
const sayMsg: string | undefined = sayArg ?? (videoOnly && resumable ? "(video only: no lead call)" : !!resumeArg && resumable ? "Carry on with the task from where you stopped and finish it. Then tell me what changed since your last answer." : undefined);
if (flags.has("--list")) { for (const c of mine) console.log(`${c.id}${c.after ? "  (after " + c.after + ")" : ""}  ${exp[c.id] ? "[ran]" : ""}${unsupported(c) ? "  [not supported: " + unsupported(c) + "]" : ""}  ${c.title}`); process.exit(0); }

// A run needs explicit case ids; the WHOLE suite only with --all (so a typo or a forgotten id never spends credits on every case).
if (!want.length && !flags.has("--all")) { console.log(`## ${suite}: name the case id(s) to run, or pass --all to run the whole suite (--list shows the ids).`); process.exit(1); }
mkdirSync(STATE_DIR, { recursive: true });
// EVERY run leaves a run record (the runs list of the UI: ui/.ui-data/web_runs/<id>.json + .log), whoever started it. A run started by the UI already has its record (env HARNESS_RUN_RECORDED), a manual one makes its own and copies its output into the log.
if (!E.HARNESS_RUN_RECORDED && !fake && !flags.has("--auto")) {
  const dir = join(ROOT, "ui", ".ui-data", "web_runs"), id = "r" + Date.now().toString(36), meta = join(dir, id + ".json"), logf = join(dir, id + ".log");
  mkdirSync(dir, { recursive: true });
  const rec = { id, suite, cases: wantIds, fake: false, rerun: flags.has("--rerun"), startedAt: Date.now(), pid: process.pid, status: "running" as string, by: "cli", endedAt: undefined as number | undefined, exitCode: undefined as number | null | undefined };
  const save = () => { try { writeFileSync(meta, JSON.stringify(rec)); } catch { /* best effort */ } };
  save();
  const log = console.log.bind(console); console.log = (...a: unknown[]) => { log(...a); try { appendFileSync(logf, a.map(String).join(" ") + "\n"); } catch { /* best effort */ } };
  process.on("exit", (code) => { rec.status = code === 0 ? "done" : "failed"; rec.exitCode = code; rec.endedAt = Date.now(); save(); });
  process.on("SIGINT", () => process.exit(130)); process.on("SIGTERM", () => process.exit(143));
}
/** A case that says "Starting point: fixture <name> ... set up in run_test/<dir> for you" must really find it there: copy store/expo_go/bases/<name> into run_test/<dir> before the lead starts
 *  (the lead can `ls` the workspace now, so a promise that only the sub-agent's run would keep makes it refuse: seen on eg_solarin_01). */
function seedStart(user: string, repo: string): string | null {
  const m = user.match(/fixture ([\w-]+)[^]*?set up in run_test\/([\w-]+)/), base = m && join(FIXTURES, "store", "expo_go", "bases", m[1]!);
  if (!m || !base || !existsSync(base)) return null;
  cpSync(base, join(repo, "run_test", m[2]!), { recursive: true }); return `run_test/${m[2]} (from bases/${m[1]})`;
}
function ensureRepo(repo: string) {   // the agents' workspace is a small git project (patches / apply_patches need one)
  if (existsSync(join(repo, ".git"))) return;
  mkdirSync(repo, { recursive: true }); writeFileSync(join(repo, "README.md"), "# scratch project\nThe agents work here.\n");
  const g = (...a: string[]) => execFileSync("git", ["-C", repo, "-c", "user.name=ui", "-c", "user.email=ui@local", ...a], { stdio: "ignore" });
  g("init", "-q"); g("add", "-A"); g("commit", "-qm", "init");
}
if (!perTask) ensureRepo(REPO);
const defs = loadAgents(), gstore = new MStore(perTask ? undefined : STORE), store = gstore;   // per-task mode: no shared store file at all
if (!fake && !perTask) { const freed = reconcileDead(store); if (freed.length) console.log(`(freed ${freed.length} agent(s) left running by a run that is gone: ${freed.join(", ")})`); }
const ctx = { store, defs, sessionCap: SESSION_CAP,
  runner: fake ? new ScriptRunner(async () => "(fake lead) done") : new RealRunner(600_000), transcriptExists: fake ? undefined : (_c: string, id: string) => transcriptExistsAnywhere(id) };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failed = 0; const notPassed = new Set<string>();   // cases of THIS run that failed or were skipped: their children must not run (a child continues the parent's state)
for (const c of mine.filter((x) => !want.length || want.includes(x.id))) {
  const why = unsupported(c);
  if (why) {   // a case we cannot run is a FAILURE, never a quiet skip (that is how the artifact suite went unnoticed)
    if ((c as any).needs?.includes?.("artifact.publish") && !fake) { const n = await runArtifactCases([c]); if (n) { failed++; notPassed.add(c.id); } continue; }
    console.log(`\n## ${c.id}: FAIL  cannot be run here: ${why}`); failed++; notPassed.add(c.id); continue;
  }
  warnMissingFixtures(c);   // fixtures live in ONE place (agent_fixture); a case without one warns unless it says allow_real_subAg: true
  if (c.after && (notPassed.has(c.after) || (exp[c.after] as { status?: string } | undefined)?.status === "fail")) { console.log(`\n## ${c.id}: SKIPPED  its parent "${c.after}" did not pass (a child continues the parent's state; fix the parent first)`); notPassed.add(c.id); failed++; continue; }
  if (c.after && !exp[c.after]?.done) { console.log(`\n## ${c.id}: needs "${c.after}" to run first (run the suite in order, or name both)`); failed++; continue; }
  // --again into the OLD session is only a valid re-test when sub-agents are fixtures (nothing changes on disk). A case with real sub-agents (allow_real_subAg) leaves its work in the workspace and in the lead's memory:
  // the lead then answers "already done", calls no builder, and the record of the first (valid) run is overwritten with "(none)". So that case gets a FRESH session instead (old one archived), as with --rerun.
  again = againFlag && !(c.allow_real_subAg && !sayMsg);
  if (againFlag && !again) console.log(`   (--again on a case with real sub-agents: running it in a fresh session; the old one is archived)`);
  const rerun = !!exp[c.id], planned = taskFor(c, all, exp), task = planned;   // a rerun never overwrites: it is a new task you can compare
  if (rerun && !flags.has("--rerun") && !sayMsg && !againFlag) { console.log(`\n## ${c.id}: already ran in task ${exp[c.id]!.task} (--rerun runs it again in a new task)`); continue; }
  // HOME of this run: a root case has its own; a case that CONTINUES its parent uses the parent's; a BRANCH (a second child of the same parent) starts from a COPY of the parent's session folder (same task id, so the parent's agents and sessions are still there)
  const parentEnt = c.after ? (exp[c.after] as { task: string; home?: string } | undefined) : undefined, isBranch = !!parentEnt && planned !== parentEnt.task, sfx = task.slice(planned.length);
  // a FRESH run (a root case or a branch) must never reuse a session folder that already exists: it holds the agents, sessions and served results of an earlier run (the planner would answer "already done")
  // a FRESH run (a root case or a branch) never reuses a session folder (it holds the agents, sessions and served results of an earlier run): the previous run is MOVED to old_data_bkp/v1_runs/ and the clean name (t_<case>) is used again
  const archive = (k: string) => { if (perTask && existsSync(homeOf(k))) { const to = join(STATE_DIR, "..", "..", "..", "old_data_bkp", "v1_runs", `${k}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`); mkdirSync(dirname(to), { recursive: true }); renameSync(homeOf(k), to); } return k; };
  const fresh = archive;
  const runTask = isBranch ? parentEnt!.task : parentEnt ? task : reuse(sayMsg) && exp[c.id] ? exp[c.id]!.task : fresh(task); let homeKey: string =  isBranch ? (perTask ? "" : fresh(planned + sfx)) : parentEnt ? (parentEnt.home ?? parentEnt.task) : reuse(sayMsg) && exp[c.id] ? (exp[c.id]!.home ?? runTask) : runTask;
  // BRANCH (testrun/branch.ts): <parent home>/branches/branch_<hex>/ = workspace + store copy (no record/); its row in the MAIN session's index_session.json starts `pending`
  let branchInfo: { branch: string; parentDir: string } | undefined;
  const shared = isBranch && !!(c as { branch_share?: boolean }).branch_share;   // branch_share: a separate test IN the parent's workspace and store: no copy, no fork
  if (again && exp[c.id]?.home) homeKey = exp[c.id]!.home!;   // the same session as before (a branch keeps its own folder)
  else if (perTask && shared) homeKey = parentEnt!.home ?? parentEnt!.task;
  else if (perTask && isBranch) { const pk = parentEnt!.home ?? parentEnt!.task, b = branchRun({ parentDir: homeOf(pk), alias: c.id }); homeKey = pk + "/branches/" + b.branch; branchInfo = { branch: b.branch, parentDir: homeOf(pk) }; }
  const ent = (exp[c.id] = reuse(sayMsg) && exp[c.id] ? (exp[c.id] as never) : { case: c.id, task: runTask, home: homeKey, suite, agents: agentsFor(c), marks: [] as number[], started: [] as number[], done: 0, at: Date.now() } as { case: string; task: string; suite: string; agents: string[]; marks: number[]; started: number[]; done: number; at: number });
  console.log(`\n## ${c.id}: ${c.title}   [task ${runTask}${homeKey !== runTask ? ", home " + homeKey : ""}, agents: ${ent.agents.join(", ")}]`);
  const store = perTask ? new MStore(storeOf(homeKey)) : gstore, REPO = repoOf(homeKey);   // this master session's own store and workspace (see LAYOUT)
  if (perTask) { mkdirSync(join(homeOf(homeKey), "store"), { recursive: true }); ensureRepo(REPO); }
  if (!c.after && !reuse(sayMsg)) { rmSync(join(REPO, "run_test"), { recursive: true, force: true }); mkdirSync(join(REPO, "run_test"), { recursive: true }); }   // an EXISTING empty run_test: the first patch of a writer must find its folder (it was lost when the folder was missing)   // ISOLATION: a case that does not continue another starts with an empty workspace (the lead can now `ls` it: leftovers of the case before would mislead it)
  { const seeded = c.after || reuse(sayMsg) ? null : seedStart(c.turns[0]!.user, REPO); if (seeded) console.log(`   starting state   : ${seeded}`); }
  if (!c.after && !reuse(sayMsg) && c.seed) { for (const [p, t] of Object.entries(c.seed)) { const f = join(REPO, "run_test", p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, t); } console.log(`   starting state   : seed files ${Object.keys(c.seed).join(", ")}`); }
  // before_node_run: the case's own function (default = prints the node) puts any starting state into THIS node's workspace (e.g. "the bug was fixed meanwhile" in a branch), right before the lead starts
  await runBeforeNode(c, { node: branchInfo ? "branch" : c.after ? "main" : "root", parent: c.after, branch: branchInfo?.branch, workspace: REPO });
  // QA is OPT-IN per case (Case.qa): only a case whose qa function says enabled takes a video / writes a session record; every other case does neither. Its `guide` (testing guidance and commands) is added to the first message when --video is on.
  const qaReq = (apps: string[]) => ({ workspace: REPO, run_test: join(REPO, "run_test"), session: runTask, apps });
  const qaGuide = flags.has("--video") && c.qa ? (() => { const q = c.qa!(qaReq([])); return q.enabled ? q.guide : undefined; })() : undefined;
  const noLead = videoOnly || !!(c as { no_lead?: boolean }).no_lead, turns = noLead ? [] : sayMsg ? [{ user: sayMsg, expected: sayArg ? { context: "(step: the person said \"" + sayMsg + "\")", expected_agents_res: [] as string[] } : c.turns[0]!.expected }]   /* --say: a free step (no calls expected); --resume: the case's own expectation */ : stopPause ? c.turns.slice(0, 1) : c.turns;
  if (again && !sayMsg) { ent.marks = []; ent.started = []; (ent as { ends?: number[] }).ends = []; ent.done = 0; ent.at = Date.now(); saveExp(ent); console.log("   again            : the prompts are sent again into the existing session (nothing is archived or reset)"); }
  const judged = []; let cost = 0, leadCost = 0;
  for (let i = 0; i < turns.length; i++) {
    store.reload(); ent.marks[i] = store.calls.filter((x) => x.task_id === runTask).length; ent.started[i] = Date.now(); saveExp(ent);
    const costBase = (() => { const l = store.agentsOf(runTask).find((x) => x.name === "lead"); return l ? costOf(store, runTask, l.agent_id) : 0; })();   // a chain (`after`) SHARES the task: the cost cap below judges only what THIS turn spent
    declareGateLimit(store, runTask, c);
    store.tx(() => { const n = say(store, runTask, "user", "lead", turns[i]!.user, chatRefs, Infinity); n.read_by.push("lead"); });   // (auto run: tagged auto_run, hidden in the chat)   // the chat of the UI (Experiment page) shows these notes: a test run has a conversation too
    // a branch's lead is a clone of the parent's lead session, made NOW (status pending -> cloned), not when the branch folder was made
    const forceSel = sessionArg && i === 0 ? { id: sessionArg, resume: true } : branchInfo && i === 0 ? cloneIfPending({ parentDir: branchInfo.parentDir, branch: branchInfo.branch, parentClaudeId: store.agentsOf(runTask).find((a) => a.name === "lead")?.session_id }) : undefined;
    if (forceSel) console.log(sessionArg && i === 0 ? `   resume           : the lead continues Claude session ${sessionArg.slice(0, 8)} (--resume=<id>)` : `   branch ${branchInfo!.branch}: lead session cloned from ${forceSel.fork_from!.slice(0, 8)} (index_session.json: pending -> cloned)`);
    const out = await runLead({ ...ctx, store } as never, { forceSel, task_id: runTask, repo: REPO, request: turns[i]!.user + (stopPause ? "\n\n[Test setup] STEP MODE: work ONE step at a time, then STOP and wait for the person to say 'next'. Steps: (1) the plan files, (2) the LAYOUT wireframe (clickable, no styling), (3) the exact UX/UI of the FE with one theme and the fake-data module. Do ONLY the next step that is not done yet (what the person says continues from where you stopped), tell them what you made and where (paths), and end your answer with: Say 'next' to continue. Do not do the whole thing, and do not run qa_check or tests." : "") + (noPlanning ? "\n\n[Test setup] Planning is switched off (--no-planning): do not call the planner and do not write plan files; hand the work straight to the builders." : "") + (i === 0 && qaGuide ? `\n\n[Testing guidance for this task]\n${qaGuide}` : ""), maxDepth: 4, runner: fake ? "fake" : "real", writerMode: "shared", agents: noPlanning ? ent.agents.filter((a: string) => a !== "planner") : ent.agents });
    store.reload();
    // let the sub-agents the lead left running (--async) finish before judging
    for (let w = 0; w < 600 && store.agentsOf(runTask).some((a) => a.status === "running" && a.name !== "lead"); w++) { await sleep(1000); store.reload(); }
    const files = existsSync(REPO) ? readdirSync(REPO).filter((f) => f !== ".git") : [];
    const j = judgeTurn(store, runTask, { ...c, turns } as never, i, ent.marks[i]!, undefined, files, new Set(defs.keys()));
    if (!j.reply && out.ok) j.reply = out.reply;
    j.reply_problem = replyProblem(turns[i]!.expected as { reply_must?: string[]; reply_forbid?: string[] }, j.reply);   // judge the FINAL reply (the fallback above fills it when the lead sent no note)
    judged.push(j); ent.done = i + 1; ((ent as { ends?: number[] }).ends ??= [])[i] = store.calls.filter((x) => x.task_id === runTask).length; saveExp(ent);
    if (j.reply && !fake) store.tx(() => { const n = say(store, runTask, "lead", "user", j.reply, chatRefs, Infinity); n.read_by.push("user"); });   // the lead's final answer of this turn (the chat shows it)
    leadCost += (out as { cost?: number }).cost ?? 0; cost = costOf(store, runTask, out.row.agent_id);   // lead + real sub-agents, from the agent.done events (fixtures cost 0); same number the UI shows
    { const cap = (c as { max_cost_usd?: number }).max_cost_usd ?? Number(process.env.HARNESS_CASE_CAP_USD ?? 1); if (!fake && cap > 0 && cost - costBase > cap) j.gate = (j.gate ? j.gate + "; " : "") + `COST CAP: $${(cost - costBase).toFixed(4)} this turn is over the case cap $${cap} (case.max_cost_usd or env HARNESS_CASE_CAP_USD)`; }   // a runaway real lead fails the case instead of silently spending
    console.log(`-- turn ${i + 1}  ${j.match && !j.guard && !j.gate && !j.reply_problem ? "MATCH" : "DIFFERS"}${j.guard ? "  GUARD: a distractor was called" : ""}${j.gate ? "  GATE FAILED: " + j.gate : ""}   lead_ok=${out.ok}   cost so far=$${cost.toFixed(4)} (lead $${leadCost.toFixed(4)})${j.reply_problem ? "   REPLY: " + j.reply_problem : ""}`);
    console.log("   EXPECTED context : " + j.expectedContext);
    console.log("   EXPECTED calls   : " + (j.expected.map((e) => `${e.kind}:${e.role}`).join(", ") || "(none: the lead must not delegate)"));
    console.log("   ACTUAL calls     : " + (j.calls.map((x) => `${x.kind}:${x.role}${x.custom ? "(custom agent: " + x.title + ")" : x.title && x.title !== x.role ? "(" + x.title + ")" : ""} -> ${x.agent}`).join(", ") || "(none)"));
    for (const x of j.calls) console.log(`      ${x.agent}: ${x.objective.replace(/\s+/g, " ").slice(0, 200)}`);
    for (const x of j.denied) console.log(`   REFUSED          : ${x.role} ${x.reason}`);
    console.log("   lead reply       : " + j.reply.replace(/\s+/g, " ").slice(0, 400));
  }
  // QA video: a case that opts in (Case.qa enabled) records it when --video is on; a no_lead node ALWAYS does (the video is its whole test and its verdict)
  const runTestDir = join(REPO, "run_test"), qaEnd = c.qa ? c.qa(qaReq(existsSync(runTestDir) ? readdirSync(runTestDir) : [])) : null, takes = !!qaEnd?.enabled;   // the case's own function decides
  let videoFailed = false, videoDone = false;
  const doVideo = async () => {
    if (videoDone || !((flags.has("--video") || noLead) && takes)) return; videoDone = true;
    try { const route = argv.find((a) => a.startsWith("--video-route="))?.split("=")[1], v = await videoAfterRun({ workspace: REPO, storeDir: dirname(storeOf(homeKey)), route, qa: qaEnd, offReason: videoOffReason });
      if (!v.videos.length) videoFailed = true;
      console.log(v.videos.length ? `   video            : ${v.videos.join(", ")}` : `   video            : none (${v.skipped ?? v.notes.join("; ")})`); } catch (e) { videoFailed = true; console.log(`   video            : failed (${String(e).slice(0, 100)})`); }
  };
  if (noLead && !takes) {   // NO VIDEO by design (the case's qa spec says enabled:false + why): nothing is started, nothing is judged; it is not a failure
    const why = qaEnd && !qaEnd.enabled ? qaEnd.why : "the case has no qa spec";
    console.log(`   video            : none, by design (${why})`);
    (ent as { status?: string; done: number }).status = "skipped"; (ent as { done: number }).done = 1; saveExp(ent);
    console.log(`=> ${c.id}: SKIPPED (no video: ${why})${shared ? " [shared workspace of " + c.after + "]" : ""}`); continue;
  }
  if (noLead) await doVideo();   // the verdict of a no_lead node IS the video: it must exist (expect_video "ok") or be refused by the QA step (expect_video "fail": a known-negative)
  const wantFail = (c as { expect_video?: string }).expect_video === "fail";
  const finalStatus = noLead ? (takes && videoFailed === wantFail ? "pass" : "fail") : statusOf(judged);
  if (!videoOnly) { (ent as { status?: string }).status = finalStatus; saveExp(ent); }
  if (finalStatus !== "pass") { failed++; notPassed.add(c.id); }
  else await runBeforeNode(c, { phase: "after", node: shared ? "branch" : branchInfo ? "branch" : c.after ? "main" : "root", parent: c.after, branch: branchInfo?.branch, workspace: REPO });   // after_node_run: ONLY on a pass (default = prints)
  if (!noLead) await doVideo();
  if (takes || flags.has("--record")) {   // the session record (store/record/*.json) is opt-in too: --record for any case, or a case that takes QA
    try { const where = await recordSession({ store, suite, caseId: c.id, title: c.title, task: runTask, status: finalStatus, cost, repo: REPO, localDir: perTask ? join(homeOf(homeKey), "store", "record") : undefined,
      turns: judged.map((j) => ({ turn: j.turn, user: j.user, expected: j.expected, actual: j.calls.map((x) => `${x.kind}:${x.role}`), match: j.match, guard: j.guard, gate: j.gate, reply: j.reply })) }); if (where) console.log(`   session record   : ${where}`); } catch (e) { console.log(`   (session not recorded: ${String(e).slice(0, 100)})`); }
  }
  console.log(`=> ${c.id}: ${finalStatus.toUpperCase()}${noLead ? ` (no lead call; ${!takes ? "qa is not enabled for this case" : wantFail ? (videoFailed ? "the QA step refused it, as expected" : "EXPECTED the QA step to refuse it, but a video was made") : videoFailed ? "no video was made" : "video made"})` : ""}${shared ? " [shared workspace of " + c.after + "]" : ""} (judged by who was called; read EXPECTED context above for the rest)`);
}
process.exit(failed ? 1 : 0);
