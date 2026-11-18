// The PROMPT TESTING page's data: the catalog of cases (TestCases/test_folders/prompt_test), the latest result of every case (test_harness/.state/<version>/prompt_tests/<suite>-<time>/<case>.json),
// the prompt sizes, and runs started from the page (a run spends real credits, about $0.02 a case: the page says so). Results and runs reach the browser over the hub topic `prompttests`.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { STATE_ROOT, HARNESS } from "@core/paths.ts";
import { AGENTS_DIR } from "@core/config.ts";
import { HOME_DIR } from "@core/userhome.ts";
import { loadAgentsRaw } from "@core/orchestrator.ts";
import { PROMPT_LIMIT, promptSizes } from "@core/agents/prompt_sizes.ts";
import { describeExpect } from "@core/prompt_judge.ts";
import { launchSizes } from "@core/launch_sizes.ts";
import { SUITES } from "../../../TestCases/test_folders/prompt_test/index.ts";

const BASE = join(STATE_ROOT, "prompt_tests"), RUNS = join(BASE, "runs");
export interface CaseView { id: string; about: string; why?: string; after?: string; tags: string[]; agent: string; user_message: string; stuff: { title: string; text: string }[]; messages: { role: string; text: string }[]; expect: string[]; judge?: string; team?: string[] }
export interface SuiteView { name: string; agent: string; about: string; cases: CaseView[] }
export async function catalog(): Promise<{ suites: SuiteView[]; sizes: ReturnType<typeof sizes>; launch: Awaited<ReturnType<typeof launchSizes>>; limit: number }> {
  return { limit: PROMPT_LIMIT, sizes: sizes(), launch: await launchSizes(), suites: SUITES.map((s) => ({ name: s.name, agent: s.agent, about: s.about, cases: s.cases.map((c) => ({ id: c.id, about: c.about, why: c.why, after: c.after, tags: (c.tags ?? []) as string[], agent: c.agent, user_message: c.user_message, stuff: c.stuff ?? [], messages: c.messages ?? [], expect: describeExpect(c.expect), judge: c.expect.judge, team: c.team })) })) };
}
/** static prompt size per agent and what the model really gets (launch = file + the team-tool docs the harness appends) */
function sizes() {
  const defs = loadAgentsRaw([AGENTS_DIR]), rows = promptSizes().filter((r) => r.set === "main_flow");
  return rows.map((r) => ({ agent: r.agent, kind: r.kind, file: r.file, chars: r.chars, lines: r.lines, over: r.over, tokens: Math.round(r.chars / 4), has: defs.has(r.agent) }));
}

export interface RunResult { ok: boolean; looked?: string; failures: string[]; text: string; calls: { tool: string; input: Record<string, unknown>; turn: string }[]; cost: number; ms: number; run: number; skipped?: string }
export interface CaseResult { id: string; stamp: string; runs: RunResult[]; pass: number; total: number; skipped: boolean; cost: number }
let cache: { sig: string; v: Record<string, CaseResult> } | null = null;
/** the LATEST result of every case (any suite folder, newest wins); cached on the folder listing + mtimes */
export function results(): Record<string, CaseResult> {
  if (!existsSync(BASE)) return {};
  const dirs = readdirSync(BASE).filter((d) => d !== "runs" && existsSync(join(BASE, d)) && statSync(join(BASE, d)).isDirectory()).sort();
  const sig = dirs.map((d) => d + ":" + statSync(join(BASE, d)).mtimeMs).join("|");
  if (cache?.sig === sig) return cache.v;
  const v: Record<string, CaseResult> = {};
  for (const d of dirs) {
    const stamp = d.replace(/^.*?-(\d{4}-\d{2}-\d{2}T[\d-]+)$/, "$1");
    for (const f of readdirSync(join(BASE, d))) {
      if (!f.endsWith(".json")) continue;
      try {
        const j = JSON.parse(readFileSync(join(BASE, d, f), "utf8")) as { case: { id: string }; runs: RunResult[] };
        const done = j.runs.filter((r) => !r.skipped);
        v[j.case.id] = { id: j.case.id, stamp, runs: j.runs.map((r) => ({ ...r, calls: r.calls.map((c) => ({ tool: c.tool, input: c.input, turn: c.turn })) })), pass: done.filter((r) => r.ok).length, total: done.length, skipped: !done.length, cost: j.runs.reduce((n, r) => n + (r.cost ?? 0), 0) };
      } catch { /* half-written */ }
    }
  }
  cache = { sig, v }; return v;
}

// ---- runs started from the page (one at a time: they share the machine's model slots)
export interface RunRow { id: string; suite: string; ids: string[]; tag?: string; skipTag?: string; runs: number; startedAt: number; endedAt?: number; status: "running" | "done" | "failed"; pid?: number }
const runs: RunRow[] = [];
export const runsState = (): RunRow[] => runs.slice(-8).reverse();
export function startRun(b: { suite: string; ids?: string[]; tag?: string; skipTag?: string; runs?: number }): RunRow | { error: string } {
  if (runs.some((r) => r.status === "running")) return { error: "a prompt-test run is already going: wait for it (each run spends real credits)" };
  const suite = SUITES.find((s) => s.name === b.suite); if (!suite) return { error: "unknown suite" };
  const ids = (b.ids ?? []).filter((i) => suite.cases.some((c) => c.id === i));
  const id = "pt_" + Date.now().toString(36); mkdirSync(RUNS, { recursive: true });
  const args = ["test_harness/scripts/prompt_test.ts", suite.name, ...ids, ...(b.tag ? [`--tag=${b.tag}`] : []), ...(b.skipTag ? [`--skip-tag=${b.skipTag}`] : []), ...(b.runs && b.runs > 1 ? [`--runs=${Math.min(5, b.runs)}`] : []), "--review"];
  const row: RunRow = { id, suite: suite.name, ids, tag: b.tag, skipTag: b.skipTag, runs: Math.min(5, b.runs ?? 1), startedAt: Date.now(), status: "running" };
  const fd = require("node:fs").openSync(join(RUNS, id + ".log"), "w");
  const p = spawn("bun", args, { cwd: join(HARNESS, ".."), stdio: ["ignore", fd, fd], detached: true }); row.pid = p.pid;
  p.on("exit", (code) => { row.status = code === 0 ? "done" : "failed"; row.endedAt = Date.now(); cache = null; });
  p.unref(); runs.push(row); return row;
}
export function runLog(id: string): string { const f = join(RUNS, id.replace(/[^\w-]/g, "") + ".log"); return existsSync(f) ? readFileSync(f, "utf8").slice(-20000) : ""; }

// ---- readiness marks of the REAL cases (kept in the user home: test_harness/.state/home/case_marks.json)
export const MARKS = ["test_ready", "to_scrap", "ready_to_start"] as const;
export type Mark = (typeof MARKS)[number];
const MARK_FILE = join(HOME_DIR, "case_marks.json");
export function marks(): Record<string, Mark> { try { return JSON.parse(readFileSync(MARK_FILE, "utf8")); } catch { return {}; } }
export function setMark(caseId: string, mark: string | null): Record<string, Mark> | { error: string } {
  if (!/^[\w.-]+$/.test(caseId)) return { error: "bad case id" }; if (mark !== null && !(MARKS as readonly string[]).includes(mark)) return { error: "unknown mark" };
  const m = marks(); if (mark) m[caseId] = mark as Mark; else delete m[caseId];
  mkdirSync(HOME_DIR, { recursive: true }); writeFileSync(MARK_FILE, JSON.stringify(m, null, 1)); return m;
}

// ---- manual status of a PROMPT case: a failing case stays FAILED until a re-run passes; the person can say "I fixed this" (re-run to confirm) or "known issue" (accepted for now)
export const PMARKS = ["fixed", "known"] as const;
const PMARK_FILE = join(HOME_DIR, "prompt_marks.json");
export interface PMark { mark: (typeof PMARKS)[number]; at: string }
export function pmarks(): Record<string, PMark> { try { return JSON.parse(readFileSync(PMARK_FILE, "utf8")); } catch { return {}; } }
export function setPMark(caseId: string, mark: string | null): Record<string, PMark> | { error: string } {
  if (!/^[\w.-]+$/.test(caseId)) return { error: "bad case id" }; if (mark !== null && !(PMARKS as readonly string[]).includes(mark)) return { error: "unknown mark" };
  const m = pmarks(); if (mark) m[caseId] = { mark: mark as PMark["mark"], at: new Date().toISOString() }; else delete m[caseId];
  mkdirSync(HOME_DIR, { recursive: true }); writeFileSync(PMARK_FILE, JSON.stringify(m, null, 1)); return m;
}

// ---- ADMIN REPORTS: what agents filed with `report_bug` (= "report an issue to the admin"): the append-only log of every run (<run>/store/admin_issues.jsonl) and any report an agent raised INSIDE a prompt test
export interface AdminRow { id: string; at: string; source: string; reporter: string; agent?: string; kind: string; severity: string; text: string }
let adminCache: { sig: string; v: AdminRow[] } | null = null;
export function adminReports(): AdminRow[] {
  const files: string[] = [];
  try { for (const d of readdirSync(STATE_ROOT)) { const f = join(STATE_ROOT, d, "store", "admin_issues.jsonl"); if (existsSync(f)) files.push(f); } } catch { /* no runs yet */ }
  const res = results(), sig = files.map((f) => f + statSync(f).mtimeMs).join("|") + "|" + Object.values(res).map((r) => r.id + r.stamp).join(",");
  if (adminCache?.sig === sig) return adminCache.v;
  const out: AdminRow[] = [];
  for (const f of files) for (const l of readFileSync(f, "utf8").split("\n").filter(Boolean)) { try { const j = JSON.parse(l); out.push({ id: j.id, at: j.at, source: `run ${String(j.task ?? "").replace(/^t_/, "")}`, reporter: j.reporter ?? "", agent: j.agent ?? undefined, kind: j.kind ?? "", severity: j.severity ?? "", text: String(j.text ?? "").slice(0, 600) }); } catch { /* half-written */ } }
  for (const r of Object.values(res)) r.runs.forEach((run, i) => run.calls.forEach((c, k) => { const t = JSON.stringify(c.input); if (/report_bug|report_issue_to_admin/.test(t)) out.push({ id: `${r.id}.${i}.${k}`, at: r.stamp.replace(/T(\d\d)-(\d\d)-(\d\d)/, "T$1:$2:$3"), source: `prompt test ${r.id}`, reporter: "the agent under test", kind: /--kind[ =]+(\w+)|"kind":"(\w+)"/.exec(t)?.slice(1).find(Boolean) ?? "", severity: "", text: t.slice(0, 600) }); }));
  out.sort((a, b) => b.at.localeCompare(a.at)); adminCache = { sig, v: out.slice(0, 80) }; return adminCache.v;
}
export const live = () => ({ results: results(), runs: runsState(), marks: marks(), pmarks: pmarks(), admin: adminReports() });
