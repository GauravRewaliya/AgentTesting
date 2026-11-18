// REAL session check (spends real credits: the lead, builders and QA are real model calls; needs --yes). Runs a request through the real harness exactly as the UI does
// (testrun/chat.ts), then audits the finished session (core/session_audit.ts): time per agent, tool calls, duplicate video, extra pictures, ffmpeg / sleep, builders in parallel, QA after the build.
//   bun test_harness/scripts/real_session_check.ts rs_sakura_page --yes [--times 2] [--audit-only <task>]
// A FAIL prints the reasons and exits 1. Every run gets its own task (rs_<case>_<n>), its record stays in .state/<version>/<task>, the verdict in .state/<version>/audits/<task>.json.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ORCH_DIR } from "../core/orchestrator.ts";
import { STATE_BASE, STATE_VERSION } from "../core/paths.ts";
import { auditSession, renderAudit, sessionStoreDir, type AuditOpts } from "../core/session_audit.ts";

interface RealCase { about: string; request: string; audit: AuditOpts; timeout_s: number }
/** The real cases. The budget is the case's: a bigger job gets a bigger budget, written here with its reason. */
export const CASES: Record<string, RealCase> = {
  rs_sakura_page: {
    about: "a three.js page (falling petals, rotation, day / sunset) with a demo video: split by file into parallel builders, then ONE QA run with ONE video (found in a real session that took 333 s)",
    request: "can you give me famous sakura animated rotating and falling leaf animation and minecraft look stuff using three js\nindex.html with proper codes i want preview of it to look on can use any thing as you want\nalso i want you to create a demo video of it too",
    audit: { expect: "page", budget: { total_s: 300, qa_s: 150, qa_calls: 12, videos: 1, pictures: 2 } }, timeout_s: 900,
  },
};
const argv = process.argv.slice(2), id = argv.find((a) => !a.startsWith("--")), flag = (k: string) => argv.includes("--" + k), val = (k: string) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : undefined; };
if (!id || !CASES[id]) { console.error(`usage: real_session_check.ts <case> --yes [--times N] [--audit-only <task>]\ncases: ${Object.entries(CASES).map(([k, c]) => `\n  ${k}: ${c.about}`).join("")}`); process.exit(2); }
const c = CASES[id]!, root = join(STATE_BASE, STATE_VERSION);
const only = val("audit-only");
if (!only && !flag("yes")) { console.error(`This runs REAL agents and spends credits (about $0.5 per run). Add --yes to go on, or --audit-only <task> to judge a finished session for free.`); process.exit(2); }
let failed = 0;
const tasks = only ? [only] : Array.from({ length: Math.max(1, Number(val("times") ?? 1)) }, (_, i) => `${id}_${Date.now().toString(36)}${i}`);
for (const task of tasks) {
  if (!only) {
    const f = join(mkdtempSync(join(tmpdir(), "rs-")), "request.txt"); writeFileSync(f, c.request + "\n");
    const t0 = Date.now(), r = spawnSync("bun", ["testrun/chat.ts", "--task", task, "--text-file", f], { cwd: ORCH_DIR, encoding: "utf8", timeout: c.timeout_s * 1000, env: process.env });
    console.log(`\n${task}: the real run took ${Math.round((Date.now() - t0) / 1000)} s wall, exit ${r.status}${r.status ? `\n${(r.stderr || r.stdout).slice(-300)}` : ""}`);
  }
  const res = auditSession(sessionStoreDir(root, task), c.audit); console.log(renderAudit(task, res)); if (!res.ok) failed++;
}
console.log(`\n${tasks.length - failed}/${tasks.length} real run(s) passed the audit for ${id}`); process.exit(failed ? 1 : 0);
