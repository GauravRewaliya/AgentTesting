// PROMPT TESTING runner (flag "prompt_testing"). Short single-turn calls of ONE agent: its REAL launch prompt, its REAL tools, the case's context and message. A PreToolUse hook records every tool
// call and blocks it, so nothing executes: no session, no fixtures, no workspace. A case states what the agent must do (+ve) and must not do (-ve). Cases CHAIN: `after` continues the parent with
// its REAL behaviour as history (a second child of one parent is a branch); a parent that fails stops its children.
//   bun test_harness/scripts/prompt_test.ts <suite|agent> [case ids ...] [--list] [--dry] [--review] [--runs=N] [--tag=cost] [--skip-tag=cost] [--model=haiku|sonnet]
//   suites: master_test, master_test2, master_test3, builder_test, qa_reviewer_test, planner_test, researcher_test, lookup_test, ux_designer_test; an agent name runs all its suites ("master" = lead)
//   --list     the cases (with tags and parents)          --dry     build everything, show sizes, no model call (free)
//   --review   print EXPECTED and GOT for every case (a failure always does); the same goes into REVIEW.md for a look by hand
//   --runs=N   repeat the whole flow N times and show the pass rate per case (one green run can be luck)
//   --no-look  do not hand free looks back (judge the very first turn)
//   --tag=cost run only the cases with that tag (their parents run too, as history); --skip-tag=cost leaves them out
// Cases: TestCases/test_folders/prompt_test/<suite>.ts (format: types.ts). Results: test_harness/.state/<version>/prompt_tests/<suite>-<time>/ (<case>.json + REVIEW.md).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAgents } from "../core/orchistraitor/f3_multiagent/harness/core/base/agents.ts";
import { launchDef } from "../core/orchistraitor/f3_multiagent/harness/core/launch.ts";
import { describeLead } from "../core/orchestrator.ts";
import { STATE_ROOT } from "../core/paths.ts";
import { claudeEnv } from "../core/orchistraitor/f3_multiagent/harness/core/base.ts";
import type { PromptCase, PromptSuite } from "../../TestCases/test_folders/prompt_test/types.ts";
import { auditEfficiency, callLine, describeExpect, judge, roleOf, type Audit, type Call } from "../core/prompt_judge.ts";
import { suitesFor } from "../../TestCases/test_folders/prompt_test/index.ts";

const argv = process.argv.slice(2), flags = new Set(argv.filter((a) => a.startsWith("--"))), pos = argv.filter((a) => !a.startsWith("--"));
const val = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const [key, ...want] = pos;
if (!key) { console.log("usage: bun test_harness/scripts/prompt_test.ts <suite|agent> [case ids] [--list] [--dry] [--review] [--runs=N] [--tag=cost] [--skip-tag=cost] [--model=haiku]"); process.exit(1); }
const suites = suitesFor(key);
if (!suites.length) { console.log(`no prompt suite or agent "${key}". Suites: ${suitesFor("lead").concat(suitesFor("builder"), suitesFor("qa-reviewer"), suitesFor("planner"), suitesFor("researcher"), suitesFor("lookup"), suitesFor("pm"), suitesFor("ux-designer")).map((s) => s.name).join(", ")}`); process.exit(1); }
const tag = val("tag"), skipTag = val("skip-tag");

if (flags.has("--list")) {
  for (const s of suites) { console.log(`\n${s.name}  (${s.agent}) ${s.about}`); for (const c of s.cases) console.log(`  ${c.id}${c.after ? `  (after ${c.after})` : ""}${c.tags?.length ? `  [${c.tags.filter((t) => t !== "prompt_testing").join(",")}]` : ""}  ${c.about}`); }
  process.exit(0);
}

const defs = loadAgents(), dir = join(tmpdir(), "prompt-test"); mkdirSync(dir, { recursive: true });
const HOOK = join(import.meta.dir, "prompt_test_hook.ts");
const runs = Math.max(1, Number(val("runs") ?? 1));

/** The args without one flag and its value (the approach's own --settings would clash with the recording hook). */
const dropFlag = (a: string[], flag: string) => a.flatMap((x, i) => (x === flag || a[i - 1] === flag ? [] : [x]));
interface Launch { promptFile: string; tools: string[]; allow: string[]; extra: string[]; chars: number }
async function launchFor(agent: string, c: PromptCase): Promise<Launch> {
  const def = defs.get(agent); if (!def) throw new Error(`unknown agent "${agent}"`);
  if (agent === "lead") {   // exactly what the CHOSEN approach launches (approaches/<name>/adapter.ts describeLaunch): its tools, prompt, hooks args
    const L = await describeLead(defs, { agents: c.team, maxDepth: 2 }), f = join(dir, `lead.${c.id}.md`); writeFileSync(f, L.text);
    return { promptFile: f, tools: L.tools, allow: L.allow, chars: L.text.length, extra: dropFlag(L.extra({ HARNESS_TASK: "prompt_test" }), "--settings") };   // the test records and blocks every tool call with its own hook (HOOK below), not the approach's hooks
  }
  const ld = launchDef(def, defs, 2, 4, dir, "team");   // a called agent at level 2: its CLAUDE.md + the team-tool docs, as the harness launches it
  return { promptFile: ld.prompt_file, tools: ld.tools, allow: ld.allow, chars: readFileSync(ld.prompt_file, "utf8").length, extra: [] };
}

interface Result { id: string; ok: boolean; audit?: Audit; looked?: string; skipped?: string; failures: string[]; text: string; calls: Call[]; cost: number; ms: number; run: number }
/** The message the agent receives: the real history of the chain, scripted turns, what it already has, then the new message (the same envelope the harness uses). */
function compose(c: PromptCase, hist: { user: string; text: string; calls: Call[]; stuff?: { title: string; text: string }[] }[]): string {
  const out = compose0(c, hist); return process.env.PT_WHY ? out + "\n\n(Test note, debugging: before your first tool call write ONE sentence saying why you chose it.)" : out;
}
function compose0(c: PromptCase, hist: { user: string; text: string; calls: Call[]; stuff?: { title: string; text: string }[] }[]): string {
  const lead = c.agent === "lead";
  const real = hist.map((h) => `PERSON: ${h.user}${h.stuff?.length ? "\nRESULTS YOU HAD THEN:\n" + h.stuff.map((x) => `=== ${x.title}\n${x.text}`).join("\n") : ""}\nYOU: ${h.text.trim() || "(no words)"}${h.calls.length ? `\nYOU CALLED: ${h.calls.map((x) => callLine(x, 220)).join(" | ")}` : ""}`);
  const scripted = (c.messages ?? []).map((m) => `${m.role === "user" ? "PERSON" : "YOU"}: ${m.text}`);
  const earlier = real.length || scripted.length ? "EARLIER IN THIS CONVERSATION:\n" + [...real, ...scripted].join("\n") + "\n\n" : "";
  const stuff = c.stuff?.length ? (lead ? "RESULTS OF THE CALLS YOU JUST MADE (you have looked already; take your next step):\n" : "ALREADY AVAILABLE TO YOU (you have looked at these; do not look again):\n") + c.stuff.map((s) => `=== ${s.title}\n${s.text}`).join("\n\n") + "\n\n" : "";
  // a sub-agent that is already working (history or scripted turns) is not given a NEW task: its calls were answered, it carries on with the task it has (like a real session: a tool result, not a fresh "TASK ... (go on)")
  const um = c.user_message.trim(), going = !lead && /^\(.*\)$/.test(um);   // "(go on)", "(lookup#2 replied)": an event, not a new task
  if (going) return `${earlier}${stuff}${/^\((go on|carry on)\)$/.test(um) ? "" : um.slice(1, -1) + ". "}Your calls were answered above. Carry on with ${hist.length || (c.messages ?? []).length ? "YOUR TASK (the first message of this conversation)" : "your task"} and take your next step.`;
  return lead ? `TASK t_prompt_test\n\n${earlier}${stuff}REQUEST FROM THE PERSON:\n${c.user_message}` : `${earlier}${stuff}TASK t_prompt_test\n${c.user_message}`;
}

async function runTurn(c: PromptCase, L: Launch, hist: { user: string; text: string; calls: Call[]; stuff?: { title: string; text: string }[] }[], run: number): Promise<Result> {
  const model = val("model") ?? defs.get(c.agent)!.model;
  const record = join(dir, `rec.${c.id}.${run}.${Date.now()}.jsonl`); writeFileSync(record, "");
  const settings = { hooks: { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: `bun --smol ${HOOK}` }] }] } };
  const args = ["-p", compose(c, hist), "--model", model, "--output-format", "stream-json", "--verbose", "--no-session-persistence", "--max-turns", "1", "--setting-sources", "", "--strict-mcp-config",
    "--append-system-prompt-file", L.promptFile, "--tools", L.tools.join(","), "--permission-mode", "dontAsk", "--settings", JSON.stringify(settings), ...L.extra, "--allowedTools", ...L.allow];
  const t0 = Date.now(), p = Bun.spawn(["claude", ...args], { cwd: dir, stdin: "ignore", stdout: "pipe", stderr: "pipe", env: { ...process.env, ...claudeEnv(), CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1", PROMPT_TEST_RECORD: record } });
  const out = await new Response(p.stdout).text(); await p.exited;
  const raw = out.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as { type: string; message?: { id?: string; content?: { type: string; text?: string; id?: string }[] }; total_cost_usd?: number }[];
  const turnOf = new Map<string, string>(), streamed: { tool: string; input: Record<string, unknown>; id: string }[] = []; let text = "", cost = 0;
  for (const ev of raw) {
    if (ev.type === "assistant" && Array.isArray(ev.message?.content)) for (const b of ev.message!.content! as { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[]) { if (b.type === "text" && b.text) text += (text ? "\n" : "") + b.text; if (b.type === "tool_use" && b.id) { turnOf.set(b.id, ev.message!.id ?? "?"); streamed.push({ tool: b.name ?? "?", input: b.input ?? {}, id: b.id }); } }
    if (ev.type === "result") cost = ev.total_cost_usd ?? 0;
  }
  // The calls are what the MODEL asked for (its own message stream). The hook record is only a fallback: Claude Code refuses an Edit / Write on a file not read in THIS session before any hook runs, so the hook alone misses exactly those calls.
  const hooked: { tool: string; input: Record<string, unknown>; id: string }[] = readFileSync(record, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const calls: Call[] = (streamed.length ? streamed : hooked).map((r) => ({ ...r, turn: turnOf.get(r.id) ?? "?" }));
  const failures = judge(c.expect, calls, text);
  return { id: c.id, ok: failures.length === 0, failures, text, calls, cost, ms: Date.now() - t0, run };
}


// FREE LOOKS and the routine step apply_patches: the master checks the state before it decides (ls, read_file, grep, a chapter, agents_list ...). A single-turn test sees only that look. Like the real harness, the runner then hands the results back
// and judges the NEXT turn, where it decides (one extra step at most). The look is recorded (`looked`) and shown, never hidden.
const LOOK = new Set(["mcp__team__apply_patches", "mcp__team__ls", "mcp__team__read_file", "mcp__team__grep", "mcp__team__agents_list", "mcp__team__board_status", "mcp__team__cost", "mcp__team__chapter", "mcp__team__ledger_get", "Read", "Glob", "Grep"]);
/** a shell command that only reads (ls, cat, sed -n, head, find, grep, pwd ...): a look, like the read tools. Anything that writes, installs, starts or commits is NOT a look. */
const readOnlyBash = (cmd0: string) => { const cmd = cmd0.replace(/'[^']*'|"[^"]*"/g, "''").replace(/\d?>&\d|\d?>\s*\/dev\/null/g, " "); return !/>|\btee\b|\brm\b|\bmv\b|\bcp\b|\bsed -i\b|\bnpm\b|\bpnpm (add|install|run|exec)\b|\bgit (commit|push|add|stash|reset|checkout|clean)\b|\bbg_start\b|\btab (open|do)\b/.test(cmd)
  && cmd.split(/&&|;|\|\||\|/).every((p) => !p.trim() || /^\s*(cd\b|pwd\b|echo\b|ls\b|cat\b|head\b|tail\b|sed -n\b|find\b|grep\b|rg\b|wc\b|stat\b|file\b|git (status|log|diff|show)\b|true\b|test\b|\[|for\b|do\b|done\b|team (chapter|agents_list|agent_peek|plan_status|plan_show|board_status|cost|ls|read_file|grep)\b|node --check\b|pnpm exec tsc\b|which\b|type\b|command -v\b)/.test(p)); };
const isLook = (x: Call) => LOOK.has(x.tool) || (x.tool === "Bash" && readOnlyBash(String(x.input.command ?? ""))) || (x.tool === "mcp__team__team_tool" && /agent_peek|plan_status|plan_show/.test(String(x.input.command ?? "")));
/** A case with `files` has a REAL little world: the read-only looks of the agent (ls / cat / find / grep / head / wc / Read) are RUN against a throwaway folder holding exactly those files, so a look returns the truth, not a canned line. Nothing else ever runs. */
function lookInWorld(files: Record<string, string>, x: Call): string | null {
  const w = mkdtempSync(join(tmpdir(), "pt-world-"));
  try {
    for (const [p, text] of Object.entries(files)) { const f = join(w, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); }
    const fix = (s: string) => s.split("/tmp/prompt-test").join(w);
    if (x.tool === "Read") { const f = fix(String(x.input.file_path ?? "")); return existsSync(f) ? readFileSync(f, "utf8").slice(0, 4000) : `(no such file: ${String(x.input.file_path)})`; }
    if (x.tool === "Bash") { const r = spawnSync("bash", ["-c", fix(String(x.input.command ?? ""))], { cwd: w, encoding: "utf8", timeout: 8000 }); return (`${r.stdout ?? ""}${r.stderr ?? ""}`.split(w).join("/tmp/prompt-test").slice(0, 4000)) || "(no output)"; }
    return null;
  } finally { rmSync(w, { recursive: true, force: true }); }
}
/** the REAL text of a chapter: the agent's own chapters first (qa-reviewer: tab, planner: plan_format), then the lead's */
function chapterText(name: string, agent = "lead"): string { const n = name.replace(/[^a-z_]/g, ""); for (const a of [agent, "lead"]) { try { return readFileSync(join(import.meta.dir, "..", "core", "agents", "main_flow_agents", a, "chapters", n + ".md"), "utf8").slice(0, 2600); } catch { /* next */ } } return "(no such chapter)"; }
async function runOnce(c: PromptCase, L: Launch, hist: { user: string; text: string; calls: Call[]; stuff?: { title: string; text: string }[] }[], run: number): Promise<Result> {
  let r = await runTurn(c, L, hist, run), cur = c, h = hist, looked: string[] = [], cost = r.cost, ms = r.ms, steps = 0;
  for (let step = 0; step < 3 && !r.ok && r.calls.length && r.calls.every(isLook) && !flags.has("--no-look"); step++) {   // at most three look steps, for the master AND for every sub-agent
    const chap = (x: Call) => (x.tool === "mcp__team__chapter" ? String(x.input.name ?? "") : /chapter/.test(String(x.input.command ?? "")) ? /--name[ =]+(\w+)/.exec(String(x.input.command))?.[1] ?? "" : "");
    const stubs = r.calls.map((x) => ({ title: `result of your ${x.tool.replace("mcp__team__", "")} ${JSON.stringify(x.input).slice(0, 120)}`, text: chap(x) ? chapterText(chap(x), c.agent) : x.tool === "mcp__team__apply_patches" ? "ok: the finished writers' patches are applied to the project" : (c.files ? lookInWorld(c.files, x) : null) ?? (c.roster && /agents_list|board_status/.test(x.tool) ? c.roster : null) ?? (c.looks ?? []).find((l) => new RegExp(l.match, "i").test(callLine(x, 400)))?.text ?? (/agents_list|board_status/.test(x.tool) ? "(the roster is not shown in this test: rely on the results above and the earlier conversation; do not conclude an agent is missing)" : "(this test world holds only what was given above: nothing more to see; decide with what you have)") }));
    looked.push(...r.calls.map((x) => callLine(x, 60)));
    // the master continues with "(carry on)"; a sub-agent keeps its hand-over (its whole task) and just gets the results
    h = [...h, { user: cur.user_message, text: r.text, calls: r.calls }]; cur = { ...cur, stuff: [...(cur.stuff ?? []), ...stubs], user_message: c.agent === "lead" ? "(carry on)" : c.user_message };
    r = await runTurn(cur, L, h, run); cost += r.cost; ms += r.ms; steps++;
  }
  // the efficiency audit: every call of every step, against what the case handed over
  const allCalls = [...h.flatMap((x, i) => (i >= hist.length ? x.calls : [])), ...r.calls], given = [...(c.stuff ?? []).map((x) => x.title + " " + x.text), ...(c.messages ?? []).map((m) => m.text)].join("\n");
  // "the FIRST call": after free looks the judged turn is a later one, so the first call is read from the whole sequence (the looks come first), the rest from the deciding turn
  if (looked.length && c.expect.first_call) { const rest = judge({ ...c.expect, first_call: undefined }, r.calls, r.text), fc = judge({ first_call: c.expect.first_call }, allCalls, r.text); r = { ...r, failures: [...rest, ...fc], ok: rest.length + fc.length === 0 }; }
  const max = c.expect.calls?.map((m) => m.max).find((m) => m !== undefined);
  const audit = auditEfficiency(allCalls, 1 + steps, given, isLook, max);
  if (c.expect.budget?.max_calls !== undefined && allCalls.length > c.expect.budget.max_calls) { r = { ...r, ok: false, failures: [...r.failures, `budget: ${allCalls.length} tool calls, the case allows ${c.expect.budget.max_calls}`] }; }
  if (c.expect.budget?.max_looks !== undefined && audit.looks > c.expect.budget.max_looks) { r = { ...r, ok: false, failures: [...r.failures, `budget: ${audit.looks} looks, the case allows ${c.expect.budget.max_looks}`] }; }
  return { ...r, cost, ms, audit, ...(looked.length ? { looked: looked.join(" | ") } : {}) };
}

const outBase = join(STATE_ROOT, "prompt_tests"), stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
let failedCases = 0, spent = 0, ran = 0;
const review: string[] = [];

async function runSuite(s: PromptSuite) {
  const byId = new Map(s.cases.map((c) => [c.id, c]));
  const ancestors = (c: PromptCase): PromptCase[] => { const a: PromptCase[] = []; for (let p = c.after ? byId.get(c.after) : undefined; p; p = p.after ? byId.get(p.after) : undefined) a.unshift(p); return a; };
  // which cases the person asked for: ids, or a tag, or all (minus a skipped tag); their ancestors run as history
  const asked = s.cases.filter((c) => (!want.length || want.includes(c.id)) && (!tag || c.tags?.includes(tag as never)) && (!skipTag || !c.tags?.includes(skipTag as never)));
  if (!asked.length) { console.log(`${s.name}: no case matches`); return; }
  const need = new Set(asked.flatMap((c) => [c.id, ...ancestors(c).map((a) => a.id)])), plan = s.cases.filter((c) => need.has(c.id)), shown = new Set(asked.map((c) => c.id));
  const model = val("model") ?? defs.get(s.agent)?.model;
  console.log(`\n${s.name} (${s.agent}, model ${model}): ${asked.length} case(s) x ${runs} run(s)${plan.length > asked.length ? `, ${plan.length - asked.length} more run as history` : ""}`);
  const tally = new Map<string, { pass: number; total: number }>(), saved = new Map<string, Result[]>(), outDir = join(outBase, `${s.name}-${stamp}`);
  review.push(`\n## ${s.name} (${s.agent}): ${s.about}\n`);
  for (let run = 1; run <= runs; run++) {
    const results = new Map<string, Result>();
    for (const c of plan) {
      const parent = c.after ? results.get(c.after) : undefined;
      let r: Result;
      const L = await launchFor(s.agent, c);
      if (flags.has("--dry")) { if (run === 1) console.log(`  ${c.id}: prompt ${L.chars} chars, tools [${L.tools.join(", ")}], ${describeExpect(c.expect).length} expectation line(s)${c.after ? `, after ${c.after}` : ""}`); continue; }
      if (c.after && (!parent || !parent.ok)) r = { id: c.id, ok: false, skipped: `its parent "${c.after}" ${parent?.skipped ? "was skipped" : "did not pass"}: a child continues the parent's state, fix the parent first`, failures: [], text: "", calls: [], cost: 0, ms: 0, run };
      else {
        const hist = ancestors(c).map((a) => { const x = results.get(a.id)!; return { user: a.user_message, text: x.text, calls: x.calls, stuff: a.stuff }; });
        r = await runOnce(c, L, hist, run); ran++; spent += r.cost;
      }
      results.set(c.id, r);
      const t = tally.get(c.id) ?? { pass: 0, total: 0 }; if (!r.skipped) { t.total++; if (r.ok) t.pass++; } tally.set(c.id, t); (saved.get(c.id) ?? saved.set(c.id, []).get(c.id)!).push(r);
    }
    if (flags.has("--dry")) break;
    // print the run in file order
    for (const c of plan) {
      if (!shown.has(c.id)) continue;
      const r = results.get(c.id)!, tg = c.tags?.filter((x) => x !== "prompt_testing").join(",");
      const head = r.skipped ? "SKIP" : r.ok ? "PASS" : "FAIL";
      console.log(`${head}  ${c.id}${runs > 1 ? `  (run ${run})` : ""}${tg ? `  [${tg}]` : ""}  ${c.about}`);
      if (r.skipped) { console.log(`        ${r.skipped}`); continue; }
      if (!r.ok || flags.has("--review")) {
        console.log(`        EXPECTED: ${describeExpect(c.expect).join("\n                  ") || "(see look-at)"}`);
        if (r.looked) console.log(`        looked first: ${r.looked}  (results handed back, then it decided)`);
        console.log(`        GOT:      ${r.calls.map((x) => callLine(x)).join("\n                  ") || "(no tool call)"}${r.text ? `\n        said:     ${r.text.slice(0, 420).replace(/\s+/g, " ")}` : ""}`);
        for (const f of r.failures) console.log(`        ✗ ${f}`);
        if (r.audit && (flags.has("--review") || r.audit.verdict !== "lean")) console.log(`        efficiency: ${r.audit.verdict} (${r.audit.calls} calls, ${r.audit.looks} looks, ${r.audit.rounds} round${r.audit.rounds === 1 ? "" : "s"}${r.audit.agents ? ", " + r.audit.agents + " agent call(s)" : ""})${r.audit.notes.length ? ": " + r.audit.notes.join("; ") : ""}`);
        if (!r.ok && c.why) console.log(`        why it matters: ${c.why}`);
        if (c.expect.judge && (flags.has("--review") || !r.ok)) console.log(`        look at:  ${c.expect.judge}`);
      }
      if (run === 1 || !r.ok) review.push(`### ${head} ${c.id}${tg ? ` [${tg}]` : ""}${c.after ? ` (after ${c.after})` : ""}\n${c.about}\n\n- **expected:** ${describeExpect(c.expect).join("; ") || "-"}\n- **looked first:** ${r.looked ?? "-"}\n- **efficiency:** ${r.audit ? `${r.audit.verdict} (${r.audit.calls} calls, ${r.audit.looks} looks, ${r.audit.rounds} round(s))${r.audit.notes.length ? ": " + r.audit.notes.join("; ") : ""}` : "-"}\n- **got:** ${r.skipped ? r.skipped : r.calls.map((x) => "`" + callLine(x, 140) + "`").join("; ") || "no tool call"}${r.text ? `\n- **said:** ${r.text.slice(0, 600).replace(/\s+/g, " ")}` : ""}${r.failures.length ? `\n- **problems:** ${r.failures.join("; ")}` : ""}${c.why ? `\n- **why it matters:** ${c.why}` : ""}${c.expect.judge ? `\n- **look at:** ${c.expect.judge}` : ""}\n`);
    }
  }
  if (flags.has("--dry")) return;
  if (runs > 1) { console.log("\npass rate per case:"); for (const c of plan) if (shown.has(c.id)) { const t = tally.get(c.id)!; console.log(`  ${t.pass === t.total ? "PASS" : "FAIL"}  ${c.id}  ${t.pass}/${t.total}`); } }
  for (const c of plan) { const t = tally.get(c.id)!, rs = saved.get(c.id) ?? []; if (shown.has(c.id) && t.pass < t.total) failedCases++; mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, c.id + ".json"), JSON.stringify({ case: c, runs: rs }, null, 1)); }
  const okN = asked.filter((c) => { const t = tally.get(c.id)!; return t.pass === t.total && t.total > 0; }).length, skipped = asked.filter((c) => (tally.get(c.id)?.total ?? 0) === 0).length;
  console.log(`\n${s.name}: ${okN}/${asked.length} passed${skipped ? `, ${skipped} skipped (parent failed)` : ""}`);
  mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, "REVIEW.md"), `# ${s.name} review (${new Date().toISOString()})\n${review.splice(0).join("\n")}\n`);
}

for (const s of suites) await runSuite(s);
if (!flags.has("--dry")) console.log(`\n${failedCases ? `${failedCases} case(s) FAILED` : "all asked cases passed"}; ${ran} model call(s), $${spent.toFixed(3)}; saved in ${outBase}/<suite>-${stamp}${existsSync(outBase) ? "" : ""}`);
process.exit(failedCases ? 1 : 0);
