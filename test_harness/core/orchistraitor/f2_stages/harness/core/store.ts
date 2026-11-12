// The registry + ledger + event log. A JSON file stands in for Postgres (the plan's `agents`, `task_requests`,
// `findings`, `reports`, `agent_calls`, `file_locks`, `lock_waiters` tables).
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { AgentDef, AgentRow, CallRow, Ev, Finding, LockRow, Report, RequestRow, WaiterRow } from "./types.ts";

/** A broken rule. In strict mode (HARNESS_STRICT=1) it is thrown so the process crashes at once instead of finishing a run that is already wrong. */
export class InvariantViolation extends Error {
  constructor(public rule: string, public data: Record<string, unknown>) { super(`INVARIANT ${rule}: ${JSON.stringify(data).slice(0, 400)}`); this.name = "InvariantViolation"; }
}
const ERR = new Set(["invariant.violation", "agent.failed", "session.id_mismatch", "writes.violation", "patch.conflict", "agent.stalled", "memory.lost"]);
const WARN = new Set(["session.rolled", "triage.ignored", "guard.restored", "edit.denied", "agent.call.denied", "review.no_verdict", "lock.queued", "lock.expired", "agent.stopped"]);
export const levelOf = (kind: string) => (ERR.has(kind) ? "error" : WARN.has(kind) ? "warn" : "info");

const TABLES = ["agents", "reports", "findings", "requests", "events", "calls", "locks", "waiters"] as const;

export class Store {
  agents: AgentRow[] = []; reports: Report[] = []; findings: Finding[] = []; requests: RequestRow[] = [];
  events: Ev[] = []; calls: CallRow[] = []; locks: LockRow[] = []; waiters: WaiterRow[] = [];
  private seq = 0; protected stamp = ""; private depth = 0;
  strict = process.env.HARNESS_STRICT === "1";
  logFile = process.env.HARNESS_LOG;   // one JSON line per event, written the moment it happens (tail it; it survives a crash)
  constructor(public file?: string) { this.reload(); }
  /** Changes whenever another process wrote the file (mtime + size). */
  protected fileStamp(): string { try { const s = statSync(this.file!); return `${s.mtimeMs}:${s.size}`; } catch { return ""; } }
  /**
   * One short critical section across processes: take the file lock, re-read only if someone else wrote, run `fn`, save, unlock.
   * Without it two processes doing read-modify-write lose updates (measured: 8 parallel writers -> 7 rows). In memory it just runs `fn`.
   * Never hold it across a model call; row objects obtained before a tx may be stale after it: look them up again inside.
   */
  tx<T>(fn: () => T): T {
    if (!this.file || this.depth > 0) return fn();
    const lock = this.file + ".lock", t0 = Date.now();
    for (;;) {
      try { mkdirSync(lock); break; } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        try { if (Date.now() - statSync(lock).mtimeMs > 30_000) rmSync(lock, { recursive: true, force: true }); } catch { /* released meanwhile */ }
        if (Date.now() - t0 > 20_000) throw new Error("store lock timeout");
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 8);
      }
    }
    this.depth++;
    try { if (this.fileStamp() !== this.stamp) this.reload(); const r = fn(); this.save(); return r; }
    finally { this.depth--; rmSync(lock, { recursive: true, force: true }); }
  }
  /** Re-read the file: another process (a tool the lead ran) may have written to it. */
  reload() {
    if (!this.file || !existsSync(this.file)) return;
    const j = JSON.parse(readFileSync(this.file, "utf8")) as Record<string, unknown>;
    for (const t of TABLES) if (Array.isArray(j[t])) (this as Record<string, unknown>)[t] = j[t];
    this.stamp = this.fileStamp();
  }
  save() {
    if (!this.file) return;
    const o: Record<string, unknown> = {};
    for (const t of TABLES) o[t] = (this as Record<string, unknown>)[t];
    writeFileSync(this.file + ".tmp", JSON.stringify(o, null, 1));
    renameSync(this.file + ".tmp", this.file);
    this.stamp = this.fileStamp();
  }
  uid(prefix: string) { return `${prefix}${Date.now().toString(36)}${(++this.seq).toString(36)}`; }
  ev(kind: string, task_id?: string, agent_id?: string, data?: Record<string, unknown>) {
    const e: Ev = { t: Date.now(), kind, task_id, agent_id, data };
    this.events.push(e); this.mirror(e); this.save();
  }
  private mirror(e: Ev) {
    const line = { ts: new Date(e.t).toISOString(), level: levelOf(e.kind), ...e };
    if (this.logFile) { try { appendFileSync(this.logFile, JSON.stringify(line) + "\n"); } catch { /* the log must never break a run */ } }
    if (process.env.HARNESS_LOG_STDERR === "1" && line.level !== "info") process.stderr.write(`[${line.level}] ${e.kind} ${e.agent_id ?? ""} ${JSON.stringify(e.data ?? {}).slice(0, 200)}\n`);
  }
  /** Record a broken rule; throws in strict mode. The event is saved BEFORE the throw, so a crashed run still shows why. */
  violation(rule: string, task_id?: string, agent_id?: string, data: Record<string, unknown> = {}) {
    this.ev("invariant.violation", task_id, agent_id, { rule, ...data });
    if (this.strict) throw new InvariantViolation(rule, data);
  }
  /** A watchdog (or a person) can stop every new call and every agent of this store at once. */
  aborted(): string | null { try { return this.file && existsSync(this.file + ".abort") ? readFileSync(this.file + ".abort", "utf8") : null; } catch { return null; } }
  abort(reason: string) { if (this.file) writeFileSync(this.file + ".abort", reason); }
  violations(task_id?: string) { return this.events.filter((e) => e.kind === "invariant.violation" && (!task_id || e.task_id === task_id)); }
  evs(kind: string, task_id?: string) { return this.events.filter((e) => e.kind === kind && (!task_id || e.task_id === task_id)); }

  agentsOf(task_id: string) { return this.agents.filter((a) => a.task_id === task_id); }
  /** An id is looked up only inside its own task (R-10). */
  agent(task_id: string, agent_id: string) { return this.agents.find((a) => a.task_id === task_id && a.agent_id === agent_id); }
  addAgent(task_id: string, def: AgentDef, o: { parent?: string | null; caller?: string | null; level?: number; cwd?: string | null; parentSession?: string | null; type?: "root" | "pipeline" | "call" | "fork" } = {}): AgentRow {
    const n = this.agents.filter((a) => a.task_id === task_id && a.name === def.name).length + 1;
    const row: AgentRow = {
      agent_id: `${def.name}#${n}`, task_id, name: def.name, role: def.role, instance_no: n, session_id: null,
      parent_agent_id: o.parent ?? null, caller_agent_id: o.caller ?? null, level: o.level ?? 1,
      title: def.name, description: def.description, status: "idle", activity: "", resume_count: 0,
      last_event_at: Date.now(), last_report_id: null, seen_requests: 0, seen_findings: 0, cwd: o.cwd ?? null,
      parent_type: o.type ?? (o.parent ? "fork" : o.caller ? "call" : "pipeline"), parent_session_id: o.parentSession ?? null,
      started_at: null, finished_at: null, final_response: null, last_call_id: null, runs: 0,
    };
    this.agents.push(row); this.save(); return row;
  }
  addRequest(task_id: string, text: string, status: "open" | "satisfied" = "open"): RequestRow {
    const n = this.requests.filter((r) => r.task_id === task_id).length + 1;
    const r: RequestRow = { id: `R${n}`, task_id, n, text, status }; this.requests.push(r); this.save(); return r;
  }
  requestsOf(task_id: string) { return this.requests.filter((r) => r.task_id === task_id); }
  addFinding(f: Omit<Finding, "id" | "n">): Finding {
    const n = this.findings.filter((x) => x.task_id === f.task_id).length + 1;
    const row: Finding = { ...f, id: `F${n}`, n }; this.findings.push(row); this.save(); return row;
  }
  findingsOf(task_id: string) { return this.findings.filter((f) => f.task_id === task_id); }
  openFindings(task_id: string) { return this.findingsOf(task_id).filter((f) => f.status === "open"); }
  addReport(r: Omit<Report, "id">): Report {
    const row: Report = { ...r, id: `rep_${r.task_id}_${this.reports.filter((x) => x.task_id === r.task_id).length + 1}` };
    this.reports.push(row); this.save(); return row;
  }
}
