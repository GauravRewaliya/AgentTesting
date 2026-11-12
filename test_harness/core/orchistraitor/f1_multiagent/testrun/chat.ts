// One chat turn with the master (lead), exactly like the console's: bun testrun/chat.ts --task <id> --agents a,b --text-file <f> [--fake] [--case <id> --turn <n>]
// The person's message and the master's reply go into the same store the console reads. With --case, the turn is also recorded in exp.json so it can be judged.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RealRunner, ScriptRunner, loadAgents, transcriptExistsAnywhere } from "../harness/core/base.ts";
import { MStore, say } from "../harness/core/board.ts";
import { SESSION_CAP } from "../harness/core/session_run.ts";
import { runLead } from "../harness/lead.ts";
import { declareGateLimit, loadSuites, readExp, reconcileDead, writeExp } from "./cases.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), DATA = join(ROOT, "ui", ".ui-data"), E = process.env;
const arg = (k: string) => { const i = process.argv.indexOf("--" + k); return i >= 0 ? process.argv[i + 1] : undefined; };
// --agents "-" means no sub-agents at all; leaving --agents out keeps the lead's default team.
const task = arg("task"), file = arg("text-file"), agents = (arg("agents") ?? "").split(",").filter((x) => x && x !== "-"), setAgents = arg("agents") !== undefined, fake = process.argv.includes("--fake"), caseId = arg("case"), turn = Number(arg("turn") ?? 0);
if (!task || !file) { console.error("usage: bun testrun/chat.ts --task <id> --text-file <f> [--agents a,b] [--fake] [--case id --turn n]"); process.exit(2); }
const STORE = resolve(E.UI_STORE ?? join(DATA, "store.json")), REPO = resolve(E.UI_REPO ?? join(DATA, "repo")), EXP = join(DATA, "exp.json"), text = readFileSync(file, "utf8").trim();
const WRITER = E.UI_WRITER_MODE === "shared" ? "shared" : "worktree";
mkdirSync(DATA, { recursive: true });
if (!existsSync(join(REPO, ".git"))) {
  mkdirSync(REPO, { recursive: true }); writeFileSync(join(REPO, "README.md"), "# scratch project\nThe agents work here.\n");
  const g = (...a: string[]) => execFileSync("git", ["-C", REPO, "-c", "user.name=ui", "-c", "user.email=ui@local", ...a], { stdio: "ignore" });
  g("init", "-q"); g("add", "-A"); g("commit", "-qm", "init");
}
const defs = loadAgents(join(ROOT, "harness", "agents")), store = new MStore(STORE);
const ctx = { store, defs, sessionCap: SESSION_CAP,
  runner: fake ? new ScriptRunner(async (c) => { await new Promise((r) => setTimeout(r, 1500)); return `(fake lead) I heard: ${c.prompt.split("REQUEST FROM THE PERSON:\n")[1]?.split("\n\n")[0]?.slice(0, 300) ?? "?"}`; }) : new RealRunner(600_000),
  transcriptExists: fake ? undefined : (_c: string, id: string) => transcriptExistsAnywhere(id) };

if (!fake) reconcileDead(store);
store.reload();
const sentAt = Date.now();
if (caseId) { const exp = readExp(EXP); let ent = exp[caseId]; if (!ent || ent.task !== task) ent = exp[caseId] = { case: caseId, task, suite: arg("suite") ?? "", agents, marks: [], started: [], done: 0, at: sentAt };   // a new task for a case replaces the old entry (the old session stays)
   ent.marks[turn] = store.calls.filter((x) => x.task_id === task).length; ent.started[turn] = sentAt; ent.at = sentAt; writeExp(EXP, exp); }
store.tx(() => { const n = say(store, task, "user", "lead", text, [], Infinity); n.t = sentAt; store.save(); });
if (caseId) { const c = (await loadSuites()).find((x) => x.id === caseId); if (c) declareGateLimit(store, task, c); }
const out = await runLead({ ...ctx, store } as never, { task_id: task, repo: REPO, request: text, maxDepth: 4, runner: fake ? "fake" : "real", writerMode: WRITER, ...(setAgents ? { agents } : {}) });
store.reload();
store.tx(() => { say(store, task, "lead", "user", out.ok ? out.reply : `(the lead could not answer: ${out.error})`, [], Infinity); });
if (caseId) { const exp = readExp(EXP), ent = exp[caseId]; if (ent) { ent.done = Math.max(ent.done, turn + 1); writeExp(EXP, exp); } }
console.log(out.ok ? "ok" : "failed: " + out.error);
process.exit(out.ok ? 0 : 1);
