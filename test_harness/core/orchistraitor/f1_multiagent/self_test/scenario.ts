// Test 2: ONE task, three messages, run through BOTH harnesses and timed per message.
//   1. "copy index.html -> index2.html"                              (the 9-minute incident)
//   2. analyse three websites IN PARALLEL, one HTML page each        (web1.html web2.html web3.html)
//   3. go deeper on website 3 and write web3_detail.md               (continue the agent that already knows it)
//   bun self_test/scenario.ts [--only staged|multi]     writes self_test/scenario_report.md + scenario_results.json
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { mkRepo, rm } from "./lib.ts";
import { loadDefs as loadStagedDefs, loadPipeline } from "../harness/main.ts";
import { RealRunner, Store, projectDirFor, runTask, trace } from "../harness/core/base.ts";
import { MStore } from "../harness/core/board.ts";
import { runLead } from "../harness/lead.ts";
import { checkRegistry, checkSessionFiles } from "../harness/core/invariants.ts";
import { loadDefs as loadMultiDefs } from "../harness/main.ts";

const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;
const REP = process.argv.includes("--rep") ? process.argv[process.argv.indexOf("--rep") + 1]! : "1";
const INDEX_HTML = `<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Acme Home</title></head>\n<body>\n<header><h1>Acme</h1><p>Tools for small teams.</p></header>\n<section id="features"><h2>Features</h2><ul><li>Fast</li><li>Simple</li><li>Cheap</li></ul></section>\n<footer>2026 Acme</footer>\n</body>\n</html>\n`;
const SITES = [{ n: 1, url: "https://example.com", kw: /example/i }, { n: 2, url: "https://www.w3.org/", kw: /w3c|world wide web/i }, { n: 3, url: "https://www.iana.org/", kw: /iana|internet assigned/i }];   // was gnu.org, which rate-limits (HTTP 429) the repeated fetches of a multi-agent run and hid the real result
const MSG = [
  "can you copy index.html -> index2.html so i have an safty",
  `Analyse these three websites in parallel and generate one HTML page per website with its analysis: web1.html for ${SITES[0]!.url}, web2.html for ${SITES[1]!.url}, web3.html for ${SITES[2]!.url}. Each page: a title, 3 to 5 bullet findings (what the site is, its main sections, who it is for) and the address.`,
  `Now go deeper on website 3 (${SITES[2]!.url}): get more detail about it and write a markdown file web3_detail.md with the sections Purpose, Main sections, Audience and 5 notable facts.`];

const same = (a: string, b: string) => existsSync(a) && existsSync(b) && readFileSync(a, "utf8") === readFileSync(b, "utf8");
const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const checks = [
  (d: string) => ({ ok: same(join(d, "index.html"), join(d, "index2.html")) && read(join(d, "index.html")) === INDEX_HTML, why: "index2.html is an exact copy; index.html untouched" }),
  (d: string) => { const bad = SITES.filter((s) => !/<html|<!doctype/i.test(read(join(d, `web${s.n}.html`))) || !s.kw.test(read(join(d, `web${s.n}.html`)))); return { ok: bad.length === 0 && same(join(d, "index.html"), join(d, "index2.html")), why: `web1-3.html exist, are HTML and mention their site${bad.length ? " (bad: " + bad.map((b) => "web" + b.n).join(",") + ")" : ""}; index2.html still there` }; },
  (d: string) => { const m = read(join(d, "web3_detail.md")); return { ok: m.length > 400 && SITES[2]!.kw.test(m) && /purpose/i.test(m) && existsSync(join(d, "web1.html")) && existsSync(join(d, "index2.html")), why: `web3_detail.md (${m.length} chars) has the sections and mentions site 3; earlier files all still there` }; }];

interface Step { fetches: number; msg: number; secs: number; cost: number; calls: number; ok: boolean; why: string; note: string }
const PROJ = join(homedir(), ".claude", "projects");
/** Real web fetches made so far by any agent of this run: counted from the session transcripts (tool_use blocks named WebFetch). */
function webFetches(): number {
  let n = 0;
  try { for (const d of readdirSync(PROJ)) if (/^-tmp-(lf|lfwt)-/.test(d)) for (const f of readdirSync(join(PROJ, d))) if (f.endsWith(".jsonl"))
    for (const line of readFileSync(join(PROJ, d, f), "utf8").split("\n")) if (line.includes('"type":"tool_use"')) n += (line.match(/"name":"WebFetch"/g) ?? []).length; } catch { /* none */ }
  return n;
}
const cleanup = () => { try { for (const d of readdirSync(join(homedir(), ".claude", "projects"))) if (/^-tmp-(lf|lfwt)-/.test(d)) rmSync(join(homedir(), ".claude", "projects", d), { recursive: true, force: true }); } catch { /* none */ } };

async function staged(): Promise<{ steps: Step[]; extra: string }> {
  cleanup(); const cwd = mkRepo({ "index.html": INDEX_HTML }), store = new Store(), runner = new RealRunner(600_000), steps: Step[] = [];
  const ctx = { store, runner, defs: loadStagedDefs(), sessionCap: 3 };
  try {
    for (let i = 0; i < 3; i++) {
      const before = store.evs("agent.start", "S").length, f0 = webFetches();
      store.addRequest("S", MSG[i]!);
      const t0 = Date.now(), r = await runTask({ ctx, pipeline: loadPipeline(), task_id: "S", cwd, tier: [1, 3, 2][i]!, costCap: 1.5, maxRounds: 3 });
      const fetches = webFetches() - f0, c0 = checks[i]!(cwd), c = i === 1 ? { ok: c0.ok && fetches >= 3, why: c0.why + `; live web fetches: ${fetches} (need >= 3)` } : c0, sp = trace.spans(store, "S").slice(before);
      steps.push({ fetches, msg: i + 1, secs: (Date.now() - t0) / 1000, cost: r.cost, calls: sp.length, ok: c.ok, why: c.why, note: `${r.status}${r.status === "done" ? "" : ": " + r.reason.slice(0, 80)}; ${r.rounds} round(s); stages: ${sp.map((x) => x.agent_id.split("#")[0] + " " + (x.ms / 1000).toFixed(1) + "s").join(", ")}` });
    }
    return { steps, extra: "```\n" + trace.renderTree(store, "S") + "\n```" };
  } finally { rmSync(projectDirFor(cwd), { recursive: true, force: true }); rm(cwd); }
}

async function multi(): Promise<{ steps: Step[]; extra: string }> {
  cleanup(); const cwd = mkRepo({ "index.html": INDEX_HTML }), file = join(tmpdir(), "scn-" + Math.random().toString(36).slice(2, 8) + ".json"), store = new MStore(file), steps: Step[] = [];
  const ctx = { store, runner: new RealRunner(600_000), defs: loadMultiDefs(), sessionCap: 3 };
  try {
    for (let i = 0; i < 3; i++) {
      try {   // a broken rule in strict mode throws: the run still writes its report and says which rule, instead of dying silently
      store.reload();
      const f0 = webFetches(), callsBefore = store.calls.length, reportsBefore = store.reports.length, spansBefore = trace.spans(store, "W").length;
      const t0 = Date.now(), lead = await runLead(ctx, { task_id: "W", repo: cwd, request: MSG[i]!, maxDepth: 4, runner: "real", writerMode: "worktree" });
      store.reload();
      const secs = (Date.now() - t0) / 1000, fetches = webFetches() - f0, c0 = checks[i]!(cwd), c = i === 1 ? { ok: c0.ok && fetches >= 3, why: c0.why + `; live web fetches: ${fetches} (need >= 3)` } : c0;
      const newCalls = store.calls.slice(callsBefore), cost = lead.cost + store.reports.slice(reportsBefore).reduce((s, r) => s + r.cost, 0);
      const sp = trace.spans(store, "W").slice(spansBefore).filter((x) => !x.agent_id.startsWith("lead"));
      const starts = sp.map((x) => x.start), spread = starts.length ? Math.max(...starts) - Math.min(...starts) : 0, sum = sp.reduce((s, x) => s + x.ms, 0);
      const byRole = (r: string) => newCalls.filter((x) => x.role === r && x.status !== "denied").length;
      const viol = store.violations("W"), gone = checkSessionFiles(store, "W"), reg = checkRegistry(store, "W", { expectIdle: true });   // session continuity is part of "passed"
      steps.push({ fetches, msg: i + 1, secs, cost, calls: 1 + newCalls.filter((x) => x.status !== "denied").length, ok: c.ok && lead.ok && viol.length === 0 && gone.length === 0,
        why: c.why + `; rule violations: ${viol.length}${viol.length ? " (" + viol.map((v) => v.data?.rule).join(",") + ")" : ""}; session files on disk: ${gone.length ? "MISSING " + gone.map((g) => g.detail).join("; ") : "all present"}; registry: ${reg.map((r) => r.rule).join(",") || "clean"}`,
        note: `lead + ${byRole("researcher")} researcher call(s) + ${byRole("builder")} builder call(s); ${newCalls.filter((x) => x.status === "denied").length} denied; nested calls (level>=3): ${newCalls.filter((x) => x.level >= 3).length}; sub-agent time ${(sum / 1000).toFixed(0)}s vs wall ${secs.toFixed(0)}s, starts spread ${(spread / 1000).toFixed(1)}s${lead.ok ? "" : "; LEAD ERR " + lead.error}; lead said: ${lead.reply.slice(0, 260).replace(/\n/g, " ")}` });
      } catch (e) {
        steps.push({ fetches: 0, msg: i + 1, secs: 0, cost: 0, calls: 0, ok: false, why: "CRASH: " + String(e).slice(0, 300), note: "the run stopped at the first broken rule (strict mode); events so far are in the timeline below" });
        break;
      }
    }
    const tl = trace.timeline(store, "W", { kind: "agent." }).split("\n").slice(0, 80).join("\n");
    return { steps, extra: "Agent tree (task W):\n```\n" + trace.renderTree(store, "W") + "\n```\n\nWho called whom:\n```\n" + trace.renderCalls(store, "W") + "\n```\n\nTimeline (agent.* events):\n```\n" + tl + "\n```" };
  } finally { rmSync(projectDirFor(cwd), { recursive: true, force: true }); rm(cwd); rmSync(file, { force: true }); rmSync(file + ".board", { force: true }); cleanup(); }
}

const results: Record<string, { steps: Step[]; extra: string }> = {};
if (!ONLY || ONLY === "staged") { console.log("running staged ..."); results["staged#" + REP] = await staged(); console.log(JSON.stringify(results["staged#" + REP]!.steps.map((s) => ({ ...s, note: undefined })))); }
if (!ONLY || ONLY === "multi") { console.log("running multi ..."); results["multi#" + REP] = await multi(); console.log(JSON.stringify(results["multi#" + REP]!.steps.map((s) => ({ ...s, note: undefined })))); }
const prev = existsSync(join(import.meta.dirname, "scenario_results.json")) ? JSON.parse(readFileSync(join(import.meta.dirname, "scenario_results.json"), "utf8")) : {};
const all = { ...prev, ...results }; writeFileSync(join(import.meta.dirname, "scenario_results.json"), JSON.stringify(all, null, 1));
const names: Record<string, string> = { staged: "Staged harness (plan/build/review, one persistent session per role)", multi: "Multi-agent harness (lead + parallel researchers + parallel builders in worktrees + patches)" };
const md = ["# Test 2: one task, three messages, both harnesses", "", `Generated ${new Date().toISOString()}. Real \`claude -p\` (haiku), real web fetches, no sandbox. One run each (treat small differences as noise).`, "",
  "Old reference (TASK_RUN_REPORT.md, the copy request only): 3 runs, 558 s (9 min 18 s), $1.81, and the requested file was deleted.", "",
  ...Object.entries(all).flatMap(([k, v]) => { const x = v as { steps: Step[]; extra: string }; return [`## ${names[k.split("#")[0]!] ?? k} (run ${k.split("#")[1] ?? 1})`, "", "| message | time | cost | agent calls | result | what was checked |", "|---|---|---|---|---|---|",
    ...x.steps.map((s) => `| ${s.msg} | ${s.secs.toFixed(0)} s | $${s.cost.toFixed(4)} | ${s.calls} | ${s.ok ? "PASS" : "**FAIL**"} | ${s.why} |`),
    `| total | ${x.steps.reduce((a, s) => a + s.secs, 0).toFixed(0)} s | $${x.steps.reduce((a, s) => a + s.cost, 0).toFixed(4)} | ${x.steps.reduce((a, s) => a + s.calls, 0)} | ${x.steps.every((s) => s.ok) ? "ALL PASS" : "**FAILURES**"} | |`, "", ...x.steps.map((s) => `- message ${s.msg}: ${s.note}`), "", x.extra, ""]; })].join("\n");
writeFileSync(join(import.meta.dirname, "scenario_report.md"), md);
console.log(md.split("\n").filter((l) => l.startsWith("|") || l.startsWith("- message")).join("\n"));
console.log("SCENARIO DONE");
