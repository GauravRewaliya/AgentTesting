// bun core/run.ts <suite> [case_id ...] [--keep] [--list] [--raw] [--real] [--rerun]
// .state is a permanent cache: a case that already ran is NOT run again (CACHED). --rerun runs it again and first ARCHIVES the old
// result to .state/cache/<id>.<n>/ (never deleted).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { report } from "./report.ts";
import { check as checkCaps } from "./harness_own_custom/capabilities.ts";
import { skip_test } from "./harness_own_custom/skip_test.ts";
import { loadAgent, runClaude } from "./claude.ts";
import type { Case, Checkpoint, CliFlags } from "./types.ts";

const ROOT = join(import.meta.dir, "..");
const RUN_TEST = join(ROOT, "run_test"), STATE = join(ROOT, ".state");
// A case with `external: true` runs in a workspace OUTSIDE .idea/ (Claude Code refuses Write/Edit there as "sensitive file").
const EXT = join(homedir(), ".cache/test_agent_3/run_ws");
let WS = RUN_TEST;
const argv = process.argv.slice(2);
const raw = new Set(argv.filter((a) => a.startsWith("--")));
const F: CliFlags = { list: raw.has("--list"), keep: raw.has("--keep"), raw: raw.has("--raw"), real: raw.has("--real"), rerun: raw.has("--rerun") };
const [suite, ...want] = argv.filter((a) => !a.startsWith("--"));
if (!suite) { console.log("usage: bun core/run.ts <suite> [case_id...] [--list] [--keep] [--raw] [--real] [--rerun]"); process.exit(1); }
const cases: Case[] = (await import(join(ROOT, "test_case", suite, "main.ts"))).cases;
if (F.list) { for (const c of cases) console.log(`${c.id}${c.after ? "  (after " + c.after + ")" : ""}  ${existsSync(join(STATE, c.id, "ckpt.json")) ? "[saved]" : ""}  ${c.title}`); process.exit(0); }

const wipe = () => { rmSync(WS, { recursive: true, force: true }); mkdirSync(WS, { recursive: true }); };
const todo = want.length ? cases.filter((c) => want.includes(c.id)) : cases;
let bad = 0, total = 0;
const cachedCase = (id: string) => existsSync(join(STATE, id, "ckpt.json")) && existsSync(join(STATE, "last", `${id}.json`)) && JSON.parse(readFileSync(join(STATE, "last", `${id}.json`), "utf8")).status === "ran";
/** Move the case's old result into .state/cache/<id>.<n>/ so a rerun never discards anything. */
function archive(id: string) {
  const base = join(STATE, "cache"); mkdirSync(base, { recursive: true });
  let n = 1; while (existsSync(join(base, `${id}.${n}`))) n++;
  const dst = join(base, `${id}.${n}`); mkdirSync(dst, { recursive: true });
  if (existsSync(join(STATE, id))) cpSync(join(STATE, id), dst, { recursive: true });
  if (existsSync(join(STATE, "last", `${id}.json`))) cpSync(join(STATE, "last", `${id}.json`), join(dst, "last.json"));
  return dst;
}

for (const c of todo) {
  const skipped = skip_test.find((s) => s.id === c.id);
  const caps = checkCaps(c.needs);
  if (skipped || caps.skip) {
    console.log(`\n## ${c.id}: SKIPPED`);
    if (skipped) console.log(`   WARNING skip_test: ${skipped.reason} (needs ${skipped.needs})`);
    for (const w of caps.warnings) console.log("   WARNING " + w);
    mkdirSync(join(STATE, "last"), { recursive: true });
    writeFileSync(join(STATE, "last", `${c.id}.json`), JSON.stringify({ suite, id: c.id, title: c.title, at: new Date().toISOString(), status: "skipped", warnings: [...(skipped ? [skipped.reason] : []), ...caps.warnings], turns: [] }, null, 1));
    bad++; continue;
  }
  if (caps.warnings.length) { console.log(`\n## ${c.id}: capability warnings`); for (const w of caps.warnings) console.log("   WARNING " + w); }
  if (cachedCase(c.id) && !F.rerun) { console.log(`\n## ${c.id}: CACHED (already ran; --rerun to run again, the old result is archived in .state/cache)`); continue; }
  if (cachedCase(c.id)) console.log(`\n## ${c.id}: archived old result -> ${archive(c.id).replace(ROOT + "/", "")}`);
  WS = c.external ? EXT : RUN_TEST;
  let prev: Checkpoint | undefined; wipe(); rmSync(join(STATE, "mod_events.jsonl"), { force: true });
  if (c.after) {
    const d = join(STATE, c.after);
    if (!existsSync(join(d, "ckpt.json"))) { console.log(`\n## ${c.id}: needs checkpoint "${c.after}" (run it first)`); bad++; continue; }
    prev = JSON.parse(readFileSync(join(d, "ckpt.json"), "utf8"));
    if (existsSync(join(d, "ws"))) cpSync(join(d, "ws"), WS, { recursive: true });
  }
  const defs = await Promise.all([...c.agents, ...(c.distractors ?? [])].map(loadAgent));
  const ids = { ...(prev?.ids ?? {}) }; let session = prev?.sessionId;
  console.log(`\n## ${c.id}: ${c.title}`);
  let n = 0, modSeen = 0; const turnSums: any[] = [];
  for (const t of c.turns) {
    n++;
    const run = await runClaude({ prompt: t.user, resume: session, defs, tools: c.tools ?? ["Agent", "SendMessage", "Read"], ws: WS, trace: join(STATE, "trace.jsonl"), forbidden: defs.filter((d) => d.forbidden).map((d) => d.name), mod: !F.real });
    session = run.sessionId || session;
    const me = join(STATE, "mod_events.jsonl");   // mod mode: the sub-agent's words live in the harness events; read only THIS turn's lines
    if (existsSync(me)) { const ls = readFileSync(me, "utf8").split("\n").filter(Boolean); for (const l of ls.slice(modSeen)) { const e = JSON.parse(l); if (e.reply) run.subTexts.push(`[${e.id}] ${e.reply}`); if (e.kind === "Agent" && e.fixture) run.served.push(e.fixture); } modSeen = ls.length; }
    console.log(`-- turn ${n}  lead_session=${run.sessionId.slice(0, 8)}  cost=$${run.cost.toFixed(4)}  turns=${run.turns}`);
    const sum = report(t.expected, run, WS, ids); for (const l of sum.lines) console.log(l); turnSums.push({ ...sum, lines: undefined as never, reply: run.reply.replace(/\s+/g, " ").slice(0, 300) });
    if (F.raw) writeFileSync(join(STATE, `${c.id}.raw.json`), JSON.stringify(run.raw));
    total++;
  }
  mkdirSync(join(STATE, "last"), { recursive: true });
  writeFileSync(join(STATE, "last", `${c.id}.json`), JSON.stringify({ suite, id: c.id, title: c.title, at: new Date().toISOString(), status: "ran", warnings: caps.warnings, turns: turnSums }, null, 1));
  // nothing is asserted: the checkpoint is always saved so chained/branched cases can continue; judge the report above.
  { const d = join(STATE, c.id); mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "ckpt.json"), JSON.stringify({ sessionId: session, ids } satisfies Checkpoint, null, 1));
    cpSync(WS, join(d, "ws"), { recursive: true }); }
  if (!F.keep) wipe();
}
console.log(`\n${todo.length - bad} case(s) run. Judge each against its EXPECTED lines.`);
