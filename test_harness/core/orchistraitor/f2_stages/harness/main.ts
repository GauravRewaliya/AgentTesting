// Entry of the harness (plan section 20): `bun main.ts check | graph | run`. Everything the pipeline needs is in this folder.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAgents, loadAgents } from "./core/agents.ts";
import { runTask } from "./core/loop.ts";
import { RealRunner, transcriptExistsAnywhere } from "./core/runner.ts";
import { E2bRunner } from "./core/e2b_runner.ts";
import { Store } from "./core/store.ts";
import type { Pipeline } from "./core/types.ts";

export const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
export const loadPipeline = (name = "default"): Pipeline => JSON.parse(readFileSync(join(HARNESS_DIR, "pipelines", name + ".json"), "utf8"));
export const loadDefs = () => loadAgents(join(HARNESS_DIR, "agents"));

async function cli() {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (k: string) => { const i = rest.indexOf("--" + k); return i >= 0 ? rest[i + 1] : undefined; };
  const defs = loadDefs();
  if (cmd === "check") { const bad = checkAgents(defs); console.log(bad.length ? bad.join("\n") : `agents:check ok (${defs.size} agents)`); process.exit(bad.length ? 1 : 0); }
  if (cmd === "graph") { for (const d of defs.values()) console.log(`${d.name} [${d.role}] -> ${d.agents.join(", ") || "(leaf)"}`); return; }
  if (cmd === "watch") {   // live view of the event log; exits 2 at the first broken rule
    const lf = arg("log"); if (!lf) { console.error("usage: main.ts watch --log <file.jsonl>"); process.exit(2); }
    const { watchFile } = await import("./core/trace.ts"); await watchFile(lf); return;
  }
  if (cmd === "tree" || cmd === "log" || cmd === "summary" || cmd === "calls") {
    const f = arg("store"), task = arg("task");
    if (!f || !task || !existsSync(f)) { console.error(`usage: main.ts ${cmd} --store <file> --task <id> [--agent <id>] [--kind <prefix>]`); process.exit(2); }
    const st = new Store(f), T = await import("./core/trace.ts");
    console.log(cmd === "tree" ? T.renderTree(st, task) : cmd === "summary" ? T.renderSummary(st, task) : cmd === "calls" ? T.renderCalls(st, task) : T.timeline(st, task, { agent: arg("agent"), kind: arg("kind") }));
    return;
  }
  if (cmd === "run") {
    const repo = arg("repo"), text = arg("request");
    if (!repo || !text || !existsSync(repo)) { console.error("usage: main.ts run [--e2b] --repo <dir> --request <text> [--check <cmd>] [--task <id>]"); process.exit(2); }
    const task_id = arg("task") ?? "task1";
    const store = new Store(join(repo, ".harness_state.json"));
    store.addRequest(task_id, text);
    const e2b = rest.includes("--e2b"), runner = e2b ? new E2bRunner() : new RealRunner();   // --e2b: claude runs in an E2B sandbox (transcripts live there, so no local transcript check)
    try {
      const r = await runTask({ ctx: { store, runner, defs, sessionCap: 3, ...(e2b ? {} : { transcriptExists: (_cwd: string, id: string) => transcriptExistsAnywhere(id) }) },
        pipeline: loadPipeline(), task_id, cwd: repo, checkCmd: arg("check") });
      console.log(JSON.stringify(r));
    } finally { if (e2b) await (runner as E2bRunner).close(); }
    return;
  }
  console.error("usage: bun main.ts check | graph | run ...");
}
if (import.meta.main) await cli();
