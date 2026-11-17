// One chat turn with the master (lead), exactly like the console's: bun testrun/chat.ts --task <id> --agents a,b --text-file <f> [--fake] [--case <id> --turn <n>]
// The person's message and the master's reply go into the same store the console reads. With --case, the turn is also recorded in exp.json so it can be judged.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RealRunner, ScriptRunner, loadAgents, transcriptExistsAnywhere } from "../harness/core/base.ts";
import { MStore, say } from "../harness/core/board.ts";
import { SESSION_CAP } from "../harness/core/session_run.ts";
import { runSlash, slashName } from "../harness/core/slash.ts";
import { runLead } from "../harness/lead.ts";
import { STATE2_BASE, STATE_VERSION } from "@core/paths.ts";
import { declareGateLimit, loadSuites, readExp, reconcileDead, writeExp } from "./cases.ts";
import { readdirSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), DATA = join(ROOT, "ui", ".ui-data"), E = process.env;
const arg = (k: string) => { const i = process.argv.indexOf("--" + k); return i >= 0 ? process.argv[i + 1] : undefined; };
// --agents "-" means no sub-agents at all; leaving --agents out keeps the lead's default team.
const task = arg("task"), file = arg("text-file"), agents = (arg("agents") ?? "").split(",").filter((x) => x && x !== "-"), setAgents = arg("agents") !== undefined, fake = process.argv.includes("--fake"), caseId = arg("case"), turn = Number(arg("turn") ?? 0);
if (!task || !file) { console.error("usage: bun testrun/chat.ts --task <id> --text-file <f> [--agents a,b] [--fake] [--case id --turn n]"); process.exit(2); }
// ONE RUNNER for the UI and for testrun/run.ts: every master session (a test case's or one made on the Experiment page: that is only a tag) lives in .state/<version>/<home>/{store,workspace}
// (<home> = the task, or <task>/branches/<b>), runs with writerMode "shared", the SAME agent team and gate limits the case declares, and the same [Test setup] note as run.ts.
// Only UI_STORE / UI_REPO (env, one-off scripts) force the old shared ui/.ui-data store.
const STATE_DIR = join(STATE2_BASE, STATE_VERSION), EXP_DIR = join(STATE_DIR, "f1_exp"), perTask = !E.UI_STORE && !E.UI_REPO;
type Ent = { case: string; task: string; home?: string; suite?: string; agents: string[]; at?: number; marks: number[]; started: number[]; done: number };
const entries = (t: string): Ent[] => { const o: Ent[] = []; try { for (const f of readdirSync(EXP_DIR)) if (f.endsWith(".json")) { const j = readExp(join(EXP_DIR, f)) as unknown as Ent; if (j?.task === t) o.push(j); } } catch { /* no exp files */ } return o.sort((x, y) => (y.at ?? 0) - (x.at ?? 0)); };
const hasStore = (h: string) => existsSync(join(STATE_DIR, h, "store", "store.json"));
const given = arg("home"), known = entries(task);
const home = !perTask ? undefined : given && /^[\w/-]+$/.test(given) && !given.includes("..") && hasStore(given) ? given : (known.map((e) => e.home ?? e.task).find(hasStore) ?? task);
const STORE = resolve(E.UI_STORE ?? join(STATE_DIR, home ?? task, "store", "store.json")), REPO = resolve(E.UI_REPO ?? (home ? join(STATE_DIR, home, "workspace") : join(DATA, "repo"))), EXP = join(DATA, "exp.json"), text = readFileSync(file, "utf8").trim();
console.log(home ? `session home: ${home} (its own store and workspace)` : "session home: the shared ui/.ui-data store (UI_STORE/UI_REPO)");
const WRITER = perTask || E.UI_WRITER_MODE === "shared" ? "shared" : "worktree";   // run.ts always uses "shared"
// the case this session belongs to (the latest one that has a lead; a no_lead node only records a video): its agents, gate limits and test-setup note
const allCases = await loadSuites(), caseOf = (e: Ent) => allCases.find((x) => x.id === e.case) as (typeof allCases)[number] & { no_lead?: boolean } | undefined;
const bound = known.find((e) => !caseOf(e)?.no_lead) ?? known[0], boundCase = caseId ? allCases.find((x) => x.id === caseId) : bound ? caseOf(bound) : undefined;
const useAgents = setAgents ? agents : bound?.agents;   // undefined = the lead's default team
mkdirSync(DATA, { recursive: true }); mkdirSync(join(STORE, ".."), { recursive: true });
if (!existsSync(join(REPO, ".git"))) {
  mkdirSync(REPO, { recursive: true }); writeFileSync(join(REPO, "README.md"), "# scratch project\nThe agents work here.\n");
  const g = (...a: string[]) => execFileSync("git", ["-C", REPO, "-c", "user.name=ui", "-c", "user.email=ui@local", ...a], { stdio: "ignore" });
  g("init", "-q"); g("add", "-A"); g("commit", "-qm", "init");
}
mkdirSync(join(REPO, "run_test"), { recursive: true });   // the agents build in run_test/ (preview, qa_check and the harness look there): a new session must have it, as run.ts makes it
const defs = loadAgents(join(ROOT, "harness", "agents")), store = new MStore(STORE);
const ctx = { store, defs, sessionCap: SESSION_CAP,
  runner: fake ? new ScriptRunner(async (c) => { await new Promise((r) => setTimeout(r, 1500)); return `(fake lead) I heard: ${c.prompt.split("REQUEST FROM THE PERSON:\n")[1]?.split("\n\n")[0]?.slice(0, 300) ?? "?"}`; }) : new RealRunner(600_000),
  transcriptExists: fake ? undefined : (_c: string, id: string) => transcriptExistsAnywhere(id) };

if (!fake) reconcileDead(store);
store.reload();
if (slashName(text) && !caseId) {   // /status, /peek, /cost ...: answered by the harness, no model call (harness/core/slash.ts)
  const reply = runSlash({ store, task, storeFile: STORE, cwd: REPO }, text);
  store.tx(() => { say(store, task, "user", "lead", text, [], Infinity); say(store, task, "lead", "user", reply, ["slash"], Infinity); });
  console.log(reply); process.exit(0);
}
const sentAt = Date.now();
const expFile = (id: string) => join(EXP_DIR, id + ".json");
if (caseId) { let ent = known.find((e) => e.case === caseId); if (!ent) ent = { case: caseId, task, home: home ?? task, suite: arg("suite") ?? "", agents, marks: [], started: [], done: 0, at: sentAt };   // same file run.ts writes (f1_exp/<case>.json)
   ent.marks[turn] = store.calls.filter((x) => x.task_id === task).length; ent.started[turn] = sentAt; ent.at = sentAt; mkdirSync(EXP_DIR, { recursive: true }); writeFileSync(expFile(caseId), JSON.stringify(ent)); }
if (!process.argv.includes("--no-say")) store.tx(() => { const n = say(store, task, "user", "lead", text, process.argv.includes("--auto") ? ["auto_run"] : [], Infinity); n.t = sentAt; store.save(); });
if (boundCase) declareGateLimit(store, task, boundCase);   // the same call limit / allow_real_subAg as run.ts
const out = await runLead({ ...ctx, store } as never, { task_id: task, repo: REPO, request: text, maxDepth: 4, runner: fake ? "fake" : "real", writerMode: WRITER, ...(useAgents ? { agents: useAgents } : {}) });
store.reload();
store.tx(() => { say(store, task, "lead", "user", out.ok ? out.reply : `(the lead could not answer: ${out.error})`, process.argv.includes("--auto") ? ["auto_run"] : [], Infinity); });
if (caseId) { try { const ent = JSON.parse(readFileSync(expFile(caseId), "utf8")) as Ent; ent.done = Math.max(ent.done, turn + 1); writeFileSync(expFile(caseId), JSON.stringify(ent)); } catch { /* no entry */ } }
console.log(out.ok ? "ok" : "failed: " + out.error);
process.exit(out.ok ? 0 : 1);
