// bun core/run.ts <suite> [case_id ...] [--keep] [--list] [--raw] [--rerun]    (cases: TestCases/test_folders/<suite>/main.ts; results: test_harness/.state/<version>/, shown by the dashboard Flow + Test pages)
// The lead is a real `claude -p` (haiku). Every sub-agent call goes through the PreToolUse hook (guard) to a thin stand-in that pipes the hand-over to core/interpose.ts mock,
// which answers from TestCases/test_folders/agent_fixture/results (recorded run(req): files + reply). So the sub-agent itself costs ~nothing. (--real is accepted and means the same.)
// .state is a permanent cache: a case that already ran is NOT run again (CACHED). --rerun runs it again and first ARCHIVES the old
// result to .state/<version>/data/<ws>/cache/<id>.<n>/ (never deleted). One case = one session folder (core/state/record.ts).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { report } from "./report.ts";
import { check as checkCaps } from "./orchistraitor/harness_own_custom/capabilities.ts";
import { skip_test } from "./orchistraitor/harness_own_custom/skip_test.ts";
import { FIXTURES, WORKSPACE, suiteDir } from "./paths.ts";
import { archiveCase, openWorkspace, readLastCase, writeLastCase, writeSession } from "./state/store.ts";
import { buildSession, hasRun, openRun, parentOf, previous, taskOf, type LastFile } from "./state/record.ts";
import { warnMissingFixtures } from "./fixture_policy.ts";
import { loadAgent, runClaude } from "./claude.ts";
import type { Case, CliFlags } from "./types.ts";

const ROOT = join(import.meta.dir, "..");
const RUN_TEST = join(ROOT, "run_test");   // results go to .state/<version>/data/<WORKSPACE>, see paths.ts
// A case with `external: true` runs in a workspace OUTSIDE .idea/ (Claude Code refuses Write/Edit there as "sensitive file").
const EXT = join(homedir(), ".cache/test_agent_3/run_ws");
let WS = RUN_TEST;
const argv = process.argv.slice(2);
const raw = new Set(argv.filter((a) => a.startsWith("--")));
const F: CliFlags = { list: raw.has("--list"), keep: raw.has("--keep"), raw: raw.has("--raw"), real: raw.has("--real"), rerun: raw.has("--rerun") };
const [suite, ...want] = argv.filter((a) => !a.startsWith("--"));
if (!suite) { console.log("usage: bun core/run.ts <suite> [case_id...] [--list] [--keep] [--raw] [--real] [--rerun]"); process.exit(1); }
const cases: Case[] = (await import(join(suiteDir(suite) ?? (console.log(`no suite "${suite}"`), process.exit(1)), "main.ts"))).cases;
const leadText = (name?: string) => { for (const f of [join(ROOT, "core/orchistraitor/harness_own_custom/core/prompts", name + ".md"), join(FIXTURES, "store/legacy/prompts", name + ".md")]) if (name && existsSync(f)) return readFileSync(f, "utf8").trim(); return undefined; };
if (F.list) { for (const c of cases) console.log(`${c.id}${c.after ? "  (after " + c.after + ")" : ""}  ${hasRun(WORKSPACE, c.id) ? "[saved]" : ""}  ${c.title}`); process.exit(0); }

// the workspace this run writes into (.state/<version>/data/<WORKSPACE>): register it once (manifest + index + pointer) so anybody opening the folder knows which harness made it
openWorkspace(WORKSPACE, "core/run.ts fixture-mock runner");
const wipe = () => { rmSync(WS, { recursive: true, force: true }); mkdirSync(WS, { recursive: true }); };
const todo = want.length ? cases.filter((c) => want.includes(c.id)) : cases;
let bad = 0, total = 0;
const cachedCase = (id: string) => hasRun(WORKSPACE, id) && readLastCase<{ status: string }>(WORKSPACE, id)?.status === "ran";

for (const c of todo) {
  const skipped = skip_test.find((s) => s.id === c.id);
  const caps = checkCaps(c.needs);
  if (skipped || caps.skip) {
    console.log(`\n## ${c.id}: SKIPPED`);
    if (skipped) console.log(`   WARNING skip_test: ${skipped.reason} (needs ${skipped.needs})`);
    for (const w of caps.warnings) console.log("   WARNING " + w);
    writeLastCase(WORKSPACE, c.id, { suite, id: c.id, title: c.title, at: new Date().toISOString(), status: "skipped", warnings: [...(skipped ? [skipped.reason] : []), ...caps.warnings], turns: [] });
    bad++; continue;
  }
  warnMissingFixtures(c);   // fixtures live in ONE place (agent_fixture); a case without one warns unless it says allow_real_subAg: true
  if (caps.warnings.length) { console.log(`\n## ${c.id}: capability warnings`); for (const w of caps.warnings) console.log("   WARNING " + w); }
  if (cachedCase(c.id) && !F.rerun) { console.log(`\n## ${c.id}: CACHED (already ran; --rerun to run again, the old result is archived in .state/…/cache)`); continue; }
  if (cachedCase(c.id)) console.log(`\n## ${c.id}: archived old result -> ${archiveCase(WORKSPACE, c.id, taskOf(c.id), parentOf(WORKSPACE, c.after)).replace(ROOT + "/", "")}`);
  WS = c.external ? EXT : RUN_TEST;
  const prev = c.after ? previous(WORKSPACE, c.after) : undefined; wipe();
  if (c.after && !prev) { console.log(`\n## ${c.id}: needs "${c.after}" in this workspace (run it first)`); bad++; continue; }
  if (prev && existsSync(prev.workspace)) cpSync(prev.workspace, WS, { recursive: true });
  const { dir: RUN, inherited } = openRun(WORKSPACE, c.id, c.after), TR = join(RUN, "trace.jsonl"); writeFileSync(TR, "");   // raw logs of THIS case: trace.jsonl, harness.jsonl, guard.json
  const defs = await Promise.all([...c.agents, ...(c.distractors ?? [])].map(loadAgent));
  const ids = { ...(prev?.ids ?? {}) }; let session = prev?.sessionId;
  console.log(`\n## ${c.id}: ${c.title}`);
  let n = 0; const turnSums: any[] = [];
  const rules = c.guard ? JSON.parse(readFileSync(join(FIXTURES, "store", c.guard), "utf8")) : undefined, lead = leadText(c.lead);
  for (const t of c.turns) {
    n++;
    const traceSeen = existsSync(TR) ? readFileSync(TR, "utf8").split("\n").filter(Boolean).length : 0;
    const run = await runClaude({ router: c.router, lead, rules, turnAllowed: t.allowed, doneBefore: Object.keys(ids).map((l) => l.split("#")[0]!), prompt: t.user, resume: session, defs, tools: c.tools ?? ["Agent", "SendMessage", "Read"], ws: WS, dir: RUN, forbidden: defs.filter((d) => d.forbidden).map((d) => d.name), mod: false });
    session = run.sessionId || session;
    // what the stand-in sub-agents did THIS turn, from the trace written by core/interpose.ts: which recorded result answered, and what it said
    for (const l of readFileSync(TR, "utf8").split("\n").filter(Boolean).slice(traceSeen)) { const e = JSON.parse(l); if (e.kind === "mock") { run.served.push(e.fixture ?? "(no recorded result)"); run.subTexts.push(`[${e.agent}] ${e.reply ?? ""}`); } }
    console.log(`-- turn ${n}  lead_session=${run.sessionId.slice(0, 8)}  cost=$${run.cost.toFixed(4)}  turns=${run.turns}`);
    const sum = report(t.expected, run, WS, ids); for (const l of sum.lines) console.log(l); turnSums.push({ ...sum, lines: undefined as never, reply: run.reply.replace(/\s+/g, " ").slice(0, 300) });
    if (F.raw) writeFileSync(join(RUN, "raw.json"), JSON.stringify(run.raw));
    total++;
  }
  // nothing is asserted: the session is always saved so chained/branched cases can continue; judge the report above.
  const last = { suite, id: c.id, title: c.title, at: new Date().toISOString(), status: "ran", warnings: caps.warnings, turns: turnSums } as LastFile;
  const { rec, events } = buildSession({ ws: WORKSPACE, c: { id: c.id, suite, title: c.title, after: c.after, turns: c.turns }, last, sessionId: session ?? "", ids, prevIds: prev?.ids ?? {}, inherited, runDir: RUN });
  writeSession(rec, events, { lastCase: last, workspaceFrom: WS });
  if (!F.keep) wipe();
}
console.log(`\n${todo.length - bad} case(s) run. Judge each against its EXPECTED lines.`);
