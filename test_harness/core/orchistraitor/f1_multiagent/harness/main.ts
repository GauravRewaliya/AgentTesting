// Entry of the multi-agent harness. Looking at a run: `tasks`, `board [--watch]`, `tree`, `log [--agent X] [--kind K]`, `summary`, `calls`, `watch --log`; talking to it: `chat --say`.
// The harness itself: `check | graph | declarations <agent> | native <agent>`.
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { checkAgents, loadAgents, trace, type Pipeline } from "./core/base.ts";
import { MStore } from "./core/board.ts";
import { declarations, nativeAgentsJson, nativeEnv } from "./core/launch.ts";
import { locksFromEnv } from "./core/lockapi.ts";
import { SESSION_CAP, findRun, renderRuns, resumeRun } from "./core/session_run.ts";

/** `--task` as given, or the task of `--run <session_run_id>`. */
function taskOf(file: string | undefined, task?: string, run?: string): string | undefined {
  if (task || !run || !file || !existsSync(file)) return task;
  const r = findRun(new MStore(file), { run });
  if (!r) { console.error(`no session run "${run}". Known runs: ${new MStore(file).runs.map((x) => x.id).join(", ") || "none"}`); process.exit(2); }
  return r.task_id;
}

export const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
/** Every task id that appears anywhere in the store. */
export const taskIds = (st: MStore) => [...new Set([...st.agents.map((a) => a.task_id), ...st.events.map((e) => e.task_id), ...st.plans.map((p) => p.task_id), ...st.requests.map((r) => r.task_id)].filter((x): x is string => !!x))];
/** A wrong task id must say so (an empty board looks like a healthy empty task). */
const needTask = (st: MStore, task: string) => { const ids = taskIds(st); if (!ids.includes(task)) { console.error(`no data for task "${task}". This store holds: ${ids.join(", ") || "(nothing)"}`); process.exit(2); } };
export const loadDefs = () => loadAgents();
export const loadPipeline = (name = "default"): Pipeline => JSON.parse(readFileSync(join(HARNESS_DIR, "pipelines", name + ".json"), "utf8"));
if (import.meta.main) {
  const [cmd, name] = process.argv.slice(2), defs = loadDefs();
  if (cmd === "check") { const bad = [...checkAgents(defs), ...[...defs.values()].filter((d) => d.role !== d.name).map((d) => `${d.name}: agent.json role "${d.role}" must equal the folder name (the lead types the role into delegate --role)`)]; console.log(bad.length ? bad.join("\n") : `agents:check ok (${defs.size} agents)`); process.exit(bad.length ? 1 : 0); }
  else if (cmd === "graph") for (const d of defs.values()) console.log(`${d.name} [${d.role}${d.writes ? ", writes" : ""}] -> ${d.agents.join(", ") || "(leaf)"}`);
  else if (cmd === "declarations" && name) console.log(declarations(defs.get(name)!, defs));
  else if (cmd === "native" && name) console.log(JSON.stringify({ agents: nativeAgentsJson(defs.get(name)!, defs), env: nativeEnv(4) }, null, 1));
  else if (cmd === "tasks") {   // which task ids does this store hold?
    const a2 = process.argv.slice(2), f = a2[a2.indexOf("--store") + 1];
    if (!f || !existsSync(f)) { console.error("usage: main.ts tasks --store <file>"); process.exit(2); }
    const st = new MStore(f), ids = taskIds(st);
    console.log(ids.length ? ids.map((id) => `${id}: ${st.agentsOf(id).length} agents, ${st.events.filter((e) => e.task_id === id).length} events, ${st.plans.filter((p) => p.task_id === id).length} plan(s)`).join("\n") : "(the store holds no tasks)");
  }
  else if (cmd === "runs") {   // the session runs in this store: the ids you come back to
    const a2 = process.argv.slice(2), f = a2[a2.indexOf("--store") + 1];
    if (!f || !existsSync(f)) { console.error("usage: main.ts runs --store <file>"); process.exit(2); }
    console.log(renderRuns(new MStore(f)));
  }
  else if (cmd === "resume") {   // continue a run after the laptop was closed or the processes died
    const a2 = process.argv.slice(2), arg = (k: string) => { const i = a2.indexOf("--" + k); return i >= 0 ? a2[i + 1] : undefined; };
    const f = arg("store");
    if (!f || !existsSync(f) || !(arg("run") || arg("task"))) { console.error("usage: main.ts resume --store <file> (--run <session_run_id> | --task <id>) [--force] [--no-start]"); process.exit(2); }
    const st = new MStore(f), r = resumeRun(st, { run: arg("run"), task: arg("task") }, { force: a2.includes("--force") });
    if (!r.ok) { console.error(r.error); process.exit(2); }
    const rep = r.report, locks = locksFromEnv(st);
    for (const c of r.releaseCalls) await locks.release(rep.run.task_id, c, 120_000);   // locks of cut-off calls go back at once (Redis: also expire by lease)
    console.log([`run ${rep.run.id} (task ${rep.run.task_id}) is active again, resumed ${rep.run.resumed_count}x`,
      `main agent: ${rep.main.agent_id ?? "-"}  claude session ${rep.main.session_id ?? "-"}`,
      `cut-off agents (now idle, will continue their own session): ${rep.interrupted_agents.join(", ") || "none"}`, `calls ended as interrupted: ${rep.ended_calls.length}`,
      `tasks re-queued to continue the same agent: ${rep.tasks_requeued.join(", ") || "none"}`, `plans to restart: ${rep.plans_to_restart.join(", ") || "none"}`,
      ...rep.next.map((n) => "next: " + n)].join("\n"));
    if (!a2.includes("--no-start")) for (const pid of rep.plans_to_restart) {
      const plan = st.plans.find((p) => p.task_id === rep.run.task_id && p.plan_id === pid)!, c = rep.run.config;
      spawn("bun", ["--smol", join(HARNESS_DIR, "tools.ts"), "_plan", "--plan", pid], { detached: true, stdio: "ignore", env: { ...process.env, HARNESS_STORE: f, HARNESS_TASK: rep.run.task_id, HARNESS_AGENT: plan.owner, HARNESS_CWD: rep.run.repo, HARNESS_MAX_DEPTH: String(c.maxDepth), HARNESS_RUNNER: c.runner, HARNESS_STRICT: c.strict ? "1" : "0", HARNESS_CANARY: c.canary ? "1" : "0", HARNESS_MODELS: JSON.stringify(c.models ?? {}) } }).unref();
      console.log(`scheduler restarted for ${pid}`);
    }
  }
  else if (cmd === "board") {   // the user's window onto the team
    const a2 = process.argv.slice(2), arg = (k: string) => { const i = a2.indexOf("--" + k); return i >= 0 ? a2[i + 1] : undefined; };
    const f = arg("store"), task = taskOf(f, arg("task"), arg("run"));
    if (!f || !task || !existsSync(f)) { console.error(`usage: main.ts ${cmd} --store <file> (--task <id> | --run <session_run_id>) [--watch]`); process.exit(2); }
    const { renderBoard } = await import("./core/board_view.ts");
    needTask(new MStore(f), task);
    if (cmd === "board") { do { const st = new MStore(f); if (a2.includes("--watch")) process.stdout.write("\x1b[2J\x1b[H"); console.log(renderBoard(st, task)); if (!a2.includes("--watch")) break; await new Promise((r) => setTimeout(r, 2000)); } while (true); }
  }
  else if (cmd === "watch") {
    const a2 = process.argv.slice(2), lf = a2[a2.indexOf("--log") + 1]; if (!lf) { console.error("usage: main.ts watch --log <file.jsonl>"); process.exit(2); }
    await trace.watchFile(lf);
  }
  else if (["tree", "log", "summary", "calls"].includes(cmd ?? "")) {
    const a = process.argv.slice(2), arg = (k: string) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : undefined; };
    const f = arg("store"), task = taskOf(f, arg("task"), arg("run"));
    if (!f || !task || !existsSync(f)) { console.error(`usage: main.ts ${cmd} --store <file> (--task <id> | --run <session_run_id>) [--agent <id>] [--kind <prefix>]`); process.exit(2); }
    const st = new MStore(f); needTask(st, task);
    console.log(cmd === "tree" ? trace.renderTree(st, task) : cmd === "summary" ? trace.renderSummary(st, task) : cmd === "calls" ? trace.renderCalls(st, task) : trace.timeline(st, task, { agent: arg("agent"), kind: arg("kind") }));
  }
  else console.log("usage: main.ts check | graph | declarations <agent> | native <agent> | tasks --store F | board|tree|log|summary|calls|chat --store F --task T | watch --log file.jsonl");
}
