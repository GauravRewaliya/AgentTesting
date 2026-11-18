// Free (no model): audit a finished real session and say PASS / FAIL with the reasons. bun test_harness/scripts/audit_session.ts <task> [--expect page] [--budget total_s=300,qa_s=150,qa_calls=12,videos=1,pictures=2] [--json]
// Reads .state/<version>/<task>/store (store.json, logs, qa media). Exit code 1 on FAIL. Used by scripts/real_session_check.ts after a real run.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { STATE_BASE, STATE_VERSION } from "../core/paths.ts";
import { auditSession, renderAudit, sessionStoreDir, type Budget } from "../core/session_audit.ts";

const argv = process.argv.slice(2), task = argv.find((a) => !a.startsWith("--")), val = (k: string) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : undefined; };
if (!task) { console.error("usage: audit_session.ts <task> [--expect page] [--budget k=v,...] [--json]"); process.exit(2); }
const budget: Partial<Budget> = {}; for (const kv of (val("budget") ?? "").split(",").filter(Boolean)) { const [k, v] = kv.split("="); (budget as Record<string, number>)[k!] = Number(v); }
const root = join(STATE_BASE, STATE_VERSION), r = auditSession(sessionStoreDir(root, task), { expect: (val("expect") as "page" | "plain" | undefined) ?? "plain", budget });
console.log(argv.includes("--json") ? JSON.stringify(r, null, 1) : renderAudit(task, r));
const out = join(root, "audits"); mkdirSync(out, { recursive: true }); writeFileSync(join(out, `${task}.json`), JSON.stringify({ task, at: new Date().toISOString(), ...r }, null, 1));
process.exit(r.ok ? 0 : 1);
