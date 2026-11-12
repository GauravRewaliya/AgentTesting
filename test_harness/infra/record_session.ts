// RECORD SESSION: after a case ran, put everything needed to replay / audit it into the S3 bucket (test_harness/infra/s3.ts), like loopferry keeps a run's events (`run_events`, `(run_id, seq)`) and outputs in storage:
//   sessions/<suite>/<case>/<task>/summary.json          case, status, cost, per turn: user ask, expected, actual calls, lead reply
//   sessions/<suite>/<case>/<task>/events.json           every store event of the task, with `seq` (append-only order)
//   sessions/<suite>/<case>/<task>/fixture_sessions.json the fixture_sessions table rows (state, version, history per agent)
//   sessions/<suite>/<case>/<task>/calls.json            the lead's calls (role, session arg, status, objective)
//   sessions/<suite>/<case>/<task>/workspace/<file>      the files the sub-agents left in run_test/ (small text files only)
// The files are ALWAYS written locally into <session>/store/record/; the S3 upload is opt-in: AT_RECORD=1 (and `docker compose -f test_harness/infra/docker-compose.yml up -d s3`).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { putJson, s3, s3Up, S3_BUCKET } from "./s3.ts";

type Store = { events: { task_id: string; kind: string; t?: number; agent_id?: string; data?: unknown }[]; calls: { task_id: string; id: string; role: string; session_arg: string; status: string; reason?: string | null; req?: unknown }[]; fixtureSessions: { task_id: string }[] };
const MAX_FILE = 100_000, MAX_FILES = 150, SKIP = new Set(["node_modules", ".git"]);
const walk = (root: string, d = root, out: string[] = []): string[] => { for (const e of readdirSync(d, { withFileTypes: true })) { if (SKIP.has(e.name)) continue; const p = join(d, e.name); if (e.isDirectory()) walk(root, p, out); else out.push(p); } return out; };

/** Where a session's own files live: test_harness/.state/<version>/<task>/store/ (see the LAYOUT note in testrun/run.ts). */
export async function recordSession(o: { store: Store; suite: string; caseId: string; title: string; task: string; status: string; cost: number; turns: unknown[]; repo: string; localDir?: string }): Promise<string | null> {
  const mine = <T extends { task_id: string }>(a: T[]) => a.filter((x) => x.task_id === o.task);
  const files: Record<string, unknown> = {
    "summary.json": { case: o.caseId, title: o.title, suite: o.suite, task: o.task, status: o.status, cost_usd: o.cost, recorded_at: new Date().toISOString(), turns: o.turns },
    "events.json": mine(o.store.events).map((e, seq) => ({ seq, ...e })),
    "fixture_sessions.json": mine(o.store.fixtureSessions),
    "calls.json": mine(o.store.calls),
  };
  let where: string | null = null;
  if (o.localDir) { mkdirSync(o.localDir, { recursive: true }); for (const [n, v] of Object.entries(files)) writeFileSync(join(o.localDir, n), JSON.stringify(v, null, 1)); where = o.localDir; }   // always: plain files, no docker, no S3
  if (process.env.AT_RECORD !== "1") return where;   // S3 upload is opt-in (AT_RECORD=1 + docker compose up -d s3)
  if (!(await s3Up())) { if (!(globalThis as { __s3hint?: boolean }).__s3hint) { console.log("   (S3 upload skipped: S3 is down. docker compose -f test_harness/infra/docker-compose.yml up -d s3)"); (globalThis as { __s3hint?: boolean }).__s3hint = true; } return where; }
  const prefix = `sessions/${o.suite}/${o.caseId}/${o.task}`;
  for (const [n, v] of Object.entries(files)) await putJson(`${prefix}/${n}`, v);
  const ws = join(o.repo, "run_test");
  if (existsSync(ws)) for (const f of walk(ws).slice(0, MAX_FILES)) if (statSync(f).size <= MAX_FILE) await s3.write(`${prefix}/workspace/${relative(ws, f)}`, readFileSync(f));
  return `s3://${S3_BUCKET}/${prefix}/`;
}
