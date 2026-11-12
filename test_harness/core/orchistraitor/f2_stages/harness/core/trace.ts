// Read-only helpers to NAVIGATE a task after (or during) a run: who ran, how long, what it cost, what happened in order.
// They only read the registry/ledger/event rows, so they work on a live store file too (`bun main.ts tree|log|summary --store <file> --task <id>`).
import type { Store } from "./store.ts";
import type { Ev } from "./types.ts";

export interface Span { agent_id: string; mode: string; ms: number; cost: number; ok: boolean; round?: number; start: number }
const fmtMs = (ms: number) => (ms >= 60_000 ? `${Math.floor(ms / 60_000)}m${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")}s` : `${(ms / 1000).toFixed(1)}s`);

/** One span per call: agent.start paired with the next agent.done / agent.failed of the same agent. */
export function spans(store: Store, task_id: string): Span[] {
  const open = new Map<string, Ev[]>(), out: Span[] = [];
  for (const e of store.events.filter((x) => x.task_id === task_id)) {
    if (e.kind === "agent.start") open.set(e.agent_id!, [...(open.get(e.agent_id!) ?? []), e]);
    if (e.kind === "agent.done" || e.kind === "agent.failed" || e.kind === "agent.stopped") {
      const s = open.get(e.agent_id!)?.shift(); if (!s) continue;
      out.push({ agent_id: e.agent_id!, mode: String(s.data?.mode ?? ""), ms: e.t - s.t, cost: Number(e.data?.cost ?? 0), ok: e.kind === "agent.done", round: s.data?.round as number | undefined, start: s.t });
    }
  }
  return out;
}

export function summary(store: Store, task_id: string) {
  const ev = store.events.filter((e) => e.task_id === task_id), sp = spans(store, task_id);
  const t0 = ev[0]?.t ?? 0, t1 = ev[ev.length - 1]?.t ?? 0;
  const waited_ms = ev.filter((e) => e.kind === "agent.done" || e.kind === "agent.failed").reduce((s, e) => s + Number(e.data?.waited_ms ?? 0), 0);
  return { waited_ms, wall_ms: t1 - t0, agent_ms: sp.reduce((s, x) => s + x.ms, 0), cost: sp.reduce((s, x) => s + x.cost, 0), calls: sp.length,
    rounds: store.evs("round.end", task_id).length, denied: store.calls.filter((c) => c.task_id === task_id && c.status === "denied").length,
    failed: sp.filter((x) => !x.ok).length, rolled: store.evs("session.rolled", task_id).length, edits_denied: store.evs("edit.denied", task_id).length };
}

/** The agent tree: roots are agents nobody called (the lead, or the pipeline roles); children hang under their caller. */
export function renderTree(store: Store, task_id: string): string {
  const rows = store.agentsOf(task_id), sp = spans(store, task_id), rep = store.reports.filter((r) => r.task_id === task_id);
  const line = (a: (typeof rows)[number]) => {
    const mine = sp.filter((s) => s.agent_id === a.agent_id), ms = mine.reduce((s, x) => s + x.ms, 0);
    const cost = rep.filter((r) => r.agent_id === a.agent_id).reduce((s, r) => s + r.cost, 0) || mine.reduce((s, x) => s + x.cost, 0);
    return `${a.agent_id} [${a.role}] L${a.level} ${a.status} session=${a.session_id?.slice(0, 6) ?? "-"} resumed=${a.resume_count}x calls=${mine.length} ${fmtMs(ms)} $${cost.toFixed(4)}${a.parent_agent_id ? ` fork-of=${a.parent_agent_id}` : ""}${a.title !== a.name ? ` "${a.title}"` : ""}${a.needs_parent ? `  << ASKS ITS PARENT: "${a.needs_parent.replace(/\s+/g, " ").slice(0, 90)}"` : ""}`;
  };
  // Roots: agents nobody called, OR whose caller is missing from the registry (a broken record must not hide an agent).
  // Every agent is drawn exactly once; records that form a loop are listed at the end instead of being hidden or recursed into.
  const out: string[] = [], seen = new Set<string>(), known = new Set(rows.map((r) => r.agent_id));
  const walk = (a: (typeof rows)[number], prefix: string, last: boolean, root: boolean) => {
    seen.add(a.agent_id);
    out.push((root ? "" : prefix + (last ? "└─ " : "├─ ")) + line(a));
    const kids = rows.filter((k) => k.caller_agent_id === a.agent_id && !seen.has(k.agent_id));
    kids.forEach((k, i) => walk(k, root ? "" : prefix + (last ? "   " : "│  "), i === kids.length - 1, false));
  };
  for (const a of rows) if ((!a.caller_agent_id || !known.has(a.caller_agent_id)) && !seen.has(a.agent_id)) walk(a, "", true, true);
  for (const a of rows) if (!seen.has(a.agent_id)) out.push(`${a.agent_id} [${a.role}] (not reachable from any root: its caller records form a loop)`);
  return out.join("\n");
}

export interface LogQuery { agent?: string; kind?: string; since_ms?: number }
export function find(store: Store, task_id: string, q: LogQuery = {}): Ev[] {
  const t0 = store.events.find((e) => e.task_id === task_id)?.t ?? 0;
  return store.events.filter((e) => e.task_id === task_id && (!q.agent || e.agent_id === q.agent) && (!q.kind || e.kind.startsWith(q.kind)) && e.t - t0 >= (q.since_ms ?? 0));
}
/** A readable timeline: +seconds since the task started, the event, who, and the interesting data. */
export function timeline(store: Store, task_id: string, q: LogQuery = {}): string {
  const t0 = store.events.find((e) => e.task_id === task_id)?.t ?? 0;
  const sp = spans(store, task_id);
  return find(store, task_id, q).map((e) => {
    const d = e.data ?? {}, bits: string[] = [];
    for (const k of ["round", "mode", "session", "prompt_chars", "decision", "pass", "checksOk", "open", "stuck", "status", "reason", "role", "code", "callee", "level", "kind", "paths", "file", "holder", "files", "finding", "wanted", "waited_ms"]) if (d[k] !== undefined) bits.push(`${k}=${typeof d[k] === "object" ? JSON.stringify(d[k]) : String(d[k]).slice(0, 70)}`);
    const dur = e.kind === "agent.done" || e.kind === "agent.failed" ? sp.find((s) => s.agent_id === e.agent_id && Math.abs(s.start + s.ms - e.t) < 2)?.ms : undefined;
    return `+${((e.t - t0) / 1000).toFixed(1).padStart(6)}s  ${e.kind.padEnd(20)} ${(e.agent_id ?? "").padEnd(13)} ${bits.join(" ")}${dur !== undefined ? ` took=${fmtMs(dur)}` : ""}`;
  }).join("\n");
}
export function renderSummary(store: Store, task_id: string): string {
  const s = summary(store, task_id);
  return `wall ${fmtMs(s.wall_ms)} | agent time ${fmtMs(s.agent_ms)} | ${s.calls} calls | ${s.rounds} round(s) | $${s.cost.toFixed(4)} | denied calls ${s.denied} | failed ${s.failed} | rolled sessions ${s.rolled} | denied edits ${s.edits_denied}${s.waited_ms > 500 ? ` | waited for a process slot ${fmtMs(s.waited_ms)}` : ""}`;
}
/** Which agent made which call, and the outcome (agent_calls table). */
export function renderCalls(store: Store, task_id: string): string {
  return store.calls.filter((c) => c.task_id === task_id).map((c) => `${c.caller_agent_id} -> ${c.callee_agent_id ?? "(none)"} role=${c.role} L${c.level} session=${c.session_arg} ${c.status}${c.reason ? " (" + c.reason.slice(0, 90) + ")" : ""}`).join("\n");
}

/** Follow a JSONL event log live: print every line (errors loud) and exit with code 2 at the first invariant violation.
 *  Reads only the new BYTES since the last look, keeps a half-written last line until its newline arrives, and starts over if the file is replaced. */
export async function watchFile(file: string): Promise<void> {
  const { existsSync, openSync, readSync, closeSync, statSync } = await import("node:fs");
  let pos = 0, pending: Buffer = Buffer.alloc(0);
  for (;;) {
    if (existsSync(file)) {
      const size = statSync(file).size;
      if (size < pos) { pos = 0; pending = Buffer.alloc(0); }   // truncated or replaced
      if (size > pos) {
        const fd = openSync(file, "r"), chunk = Buffer.alloc(size - pos);
        readSync(fd, chunk, 0, chunk.length, pos); closeSync(fd); pos = size;
        const data = Buffer.concat([pending, chunk]), nl = data.lastIndexOf(10);
        if (nl < 0) pending = data;
        else {
          pending = data.subarray(nl + 1);
          for (const line of data.subarray(0, nl).toString("utf8").split("\n").filter(Boolean)) {
            let e: { ts: string; level: string; kind: string; agent_id?: string; data?: Record<string, unknown> };
            try { e = JSON.parse(line); } catch { console.log(`      ?     (unreadable line) ${line.slice(0, 80)}`); continue; }
            const tag = e.level === "error" ? "ERROR" : e.level === "warn" ? "warn " : "     ";
            console.log(`${e.ts.slice(11, 19)} ${tag} ${e.kind.padEnd(20)} ${(e.agent_id ?? "").padEnd(13)} ${JSON.stringify(e.data ?? {}).slice(0, 160)}`);
            if (e.kind === "invariant.violation") { console.log("STOP: a rule was broken, see above"); process.exit(2); }
          }
        }
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}
