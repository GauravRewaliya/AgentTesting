// Rebuilds the per-case exp files (.state/<v>/f1_exp/<case>.json) that the UI Experiment page and `run.ts` (the `after` check) read, from the session folders that are on disk.
// Why it exists: the exp file is the INDEX of a run; a folder without one is invisible in the UI. Never deletes; only writes a file that is missing.
//   bun testrun/rebuild_exp.ts            (all missing)     bun testrun/rebuild_exp.ts --dry
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_ROOT as STATE_DIR } from "@core/paths.ts";
import { MStore } from "../harness/core/board.ts";
import { agentsFor, loadSuites } from "./cases.ts";

const EXP_DIR = join(STATE_DIR, "f1_exp"), dry = process.argv.includes("--dry");
const all = await loadSuites(), byId = new Map(all.map((c) => [c.id, c]));
const homes: { key: string; task: string }[] = [];   // a session folder: <task>/ or <task>/branches/<branch>/
for (const d of readdirSync(STATE_DIR, { withFileTypes: true })) if (d.isDirectory() && existsSync(join(STATE_DIR, d.name, "store", "store.json"))) {
  homes.push({ key: d.name, task: d.name });
  try { for (const b of readdirSync(join(STATE_DIR, d.name, "branches"))) homes.push({ key: `${d.name}/branches/${b}`, task: d.name }); } catch { /* no branches */ }
}
let made = 0;
for (const c of all) {
  if (existsSync(join(EXP_DIR, c.id + ".json"))) continue;
  // the session folder of a case: t_<case id> (root / continued: the parent's folder holds it), or a branch whose index row has alias = case id
  let h = homes.find((x) => x.key === "t_" + c.id);
  if (!h) for (const x of homes.filter((y) => !y.key.includes("/branches/"))) { try { const rows = JSON.parse(require("node:fs").readFileSync(join(STATE_DIR, x.key, "store", "index_session.json"), "utf8")) as { branch: string; alias: string }[]; const r = rows.filter((z) => z.alias === c.id).pop(); if (r) h = { key: `${x.key}/branches/${r.branch}`, task: x.task }; } catch { /* no index */ } }
  if (!h) continue;
  const store = new MStore(join(STATE_DIR, h.key, "store", "store.json")), lead = store.agentsOf(h.task).find((a) => a.name === "lead");
  const done = Math.min(c.turns.length, Math.max(1, lead?.runs ?? 1));
  const at = lead?.finished_at ?? lead?.started_at ?? Date.now();
  const e = { case: c.id, task: h.task, home: h.key, suite: c.suite, agents: agentsFor(c), marks: c.turns.map(() => 0), started: c.turns.map(() => at), done, at };
  console.log(`${dry ? "would write" : "write"} ${c.id}  task ${h.task}${h.key !== h.task ? "  home " + h.key : ""}  done ${done}/${c.turns.length}`);
  if (!dry) { mkdirSync(EXP_DIR, { recursive: true }); writeFileSync(join(EXP_DIR, c.id + ".json"), JSON.stringify(e)); } made++;
}
console.log(`${made} exp file(s) ${dry ? "would be " : ""}rebuilt`);
