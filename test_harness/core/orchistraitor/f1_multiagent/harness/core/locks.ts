// File locks (plan section 22): declared up front, all-or-none, FIFO queue, leases. A hook denies an edit that is not covered. Never sleeps.
import type { Store } from "./base.ts";
import type { LockRow } from "./base.ts";
import { wsRel } from "./rel_writes.ts";

const lit = (g: string) => wsRel(g).split("*")[0]!;
/** Conservative overlap: the literal prefixes nest. `src/*.ts` and `src/*.js` count as overlapping (a false queue, never a missed conflict). */
/** A name starting with "@" is a RESOURCE, not a path (@git, @migrations, @tests): it conflicts only with the same name. */
export const isResource = (s: string) => s.startsWith("@");
export const overlaps = (a: string, b: string) => { if (isResource(a) || isResource(b)) return a === b; const x = lit(a), y = lit(b); return x.startsWith(y) || y.startsWith(x); };

/** Shell command families that must run one at a time. The edit hook cannot see inside Bash, but it CAN see these command names. */
const FAMILIES: [string, RegExp][] = [
  ["@git", /\bgit\s+(commit|add|merge|rebase|checkout|switch|reset|restore|stash|cherry-pick|apply|push|pull|fetch|tag|rm|mv|worktree|clean)\b/],
  ["@migrations", /\b(db:migrate|db:generate|migrate|drizzle-kit|prisma\s+migrate|knex\s+migrate|alembic|typeorm\s+migration|sequelize\s+db:migrate|flyway)\b/],
  ["@tests", /\b(vitest|jest|mocha|pytest|playwright|cypress|bun\s+run\s+test|npm\s+(run\s+)?test|pnpm\s+(run\s+)?test|yarn\s+test|go\s+test|cargo\s+test)\b/]];
/** A segment that only READS (ls, cat, grep, find, which ...) mentions names, it does not run them: `ls ~/.cache/ms-playwright` or `cat vitest.config.ts` is not a test run (a real false stop of a QA agent). */
const READ_ONLY = /^\s*(?:cd\s+\S+\s*;?\s*)?(ls|ll|cat|head|tail|find|grep|rg|stat|which|whereis|wc|du|file|type|command\s+-v|echo|printf|test|\[|sed\s+-n|awk|diff|tree|realpath|basename|dirname)\b/;
export function resourcesFor(command: string): string[] { const active = command.split(/&&|;|\|\||\||\n/).filter((seg) => !READ_ONLY.test(seg)).join(" ; "); return FAMILIES.filter(([, re]) => re.test(active)).map(([n]) => n); }
export function covers(glob0: string, path0: string): boolean {
  const glob = wsRel(glob0), path = wsRel(path0);   // two spellings of one file are one file (absolute vs workspace-relative)
  const re = new RegExp("^" + glob.replace(/^\.\//, "").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*") + "$");
  return re.test(path.replace(/^\.\//, "")) || (!glob.includes("*") && path.startsWith(glob.replace(/\/$/, "") + "/"));
}
const anyOverlap = (xs: string[], ys: string[]) => xs.some((x) => ys.some((y) => overlaps(x, y)));

export function reap(store: Store, now: number) {
  const dead = store.locks.filter((l) => l.expires <= now);
  if (!dead.length) return;
  store.locks = store.locks.filter((l) => l.expires > now);
  for (const d of dead) store.ev("lock.expired", d.task_id, d.agent_id, { path: d.path });
  store.save();
}

export type Acquire = { ok: true } | { ok: false; heldBy: string[]; position: number };
/** All paths or none. If any is held by another agent, or an overlapping request queued earlier is still waiting, the call queues. */
export function acquire(store: Store, o: { task_id: string; agent_id: string; call_id: string; paths: string[]; ttlMs: number; now: number }): Acquire {
  reap(store, o.now);
  // idempotent: a call that already holds every path (e.g. it was promoted from the queue) asking again is simply fine, never re-queued
  if (o.paths.every((p) => store.locks.some((l) => l.task_id === o.task_id && l.call_id === o.call_id && l.path === p))) { for (const l of store.locks) if (l.call_id === o.call_id) l.expires = o.now + o.ttlMs; return { ok: true }; }
  const mineIdx = store.waiters.findIndex((w) => w.call_id === o.call_id);
  const heldBy = [...new Set(store.locks.filter((l) => l.task_id === o.task_id && l.agent_id !== o.agent_id && o.paths.some((p) => overlaps(p, l.path))).map((l) => l.agent_id))];
  const ahead = store.waiters.filter((w, i) => w.task_id === o.task_id && w.agent_id !== o.agent_id && (mineIdx < 0 || i < mineIdx) && anyOverlap(w.paths, o.paths));
  if (heldBy.length || ahead.length) {
    if (mineIdx < 0) store.waiters.push({ id: store.uid("w"), task_id: o.task_id, agent_id: o.agent_id, call_id: o.call_id, paths: o.paths, t: o.now });
    const pos = store.waiters.filter((w) => w.task_id === o.task_id && anyOverlap(w.paths, o.paths)).findIndex((w) => w.call_id === o.call_id) + 1;
    store.ev("lock.queued", o.task_id, o.agent_id, { paths: o.paths, heldBy: [...heldBy, ...ahead.map((w) => w.agent_id)], position: pos }); store.save();
    return { ok: false, heldBy: [...new Set([...heldBy, ...ahead.map((w) => w.agent_id)])], position: pos };
  }
  if (mineIdx >= 0) store.waiters.splice(mineIdx, 1);
  for (const p of o.paths) store.locks.push({ path: p, task_id: o.task_id, agent_id: o.agent_id, call_id: o.call_id, expires: o.now + o.ttlMs });
  store.ev("lock.granted", o.task_id, o.agent_id, { paths: o.paths }); store.save();
  for (const mine of o.paths) for (const l of store.locks) if (l.task_id === o.task_id && l.agent_id !== o.agent_id && overlaps(mine, l.path)) store.violation("lock_overlap", o.task_id, o.agent_id, { mine, theirs: l.path, holder: l.agent_id });   // must never happen: acquire refuses overlaps
  return { ok: true };
}
/** Release a finished call's locks and hand them to waiters in arrival order. Returns the call ids that now hold their locks. */
export function release(store: Store, call_id: string, ttlMs: number, now: number): string[] {
  const gone = store.locks.filter((l) => l.call_id === call_id);
  store.locks = store.locks.filter((l) => l.call_id !== call_id);
  store.waiters = store.waiters.filter((w) => w.call_id !== call_id);
  if (gone.length) store.ev("lock.released", gone[0]!.task_id, gone[0]!.agent_id, { paths: gone.map((g: LockRow) => g.path) });
  const granted: string[] = [];
  for (const w of [...store.waiters]) {
    const r = acquire(store, { task_id: w.task_id, agent_id: w.agent_id, call_id: w.call_id, paths: w.paths, ttlMs, now });
    if (r.ok) granted.push(w.call_id);
  }
  store.save(); return granted;
}
export function renew(store: Store, agent_id: string, ttlMs: number, now: number) {
  for (const l of store.locks) if (l.agent_id === agent_id) l.expires = now + ttlMs;
  store.save();
}

export type Guard = { allow: true } | { allow: false; reason: string };
/** The PreToolUse decision for a Bash command: every resource family it touches must be held by THIS agent. */
export function guardResource(store: Store, task_id: string, agent_id: string, resource: string, now: number, ttlMs = 1_200_000): Guard {
  reap(store, now);
  if (store.locks.some((l) => l.task_id === task_id && l.agent_id === agent_id && l.path === resource)) { renew(store, agent_id, ttlMs, now); return { allow: true }; }
  const other = store.locks.find((l) => l.task_id === task_id && l.agent_id !== agent_id && l.path === resource);
  if (store.events.some((e) => e.kind === "lock.expired" && e.agent_id === agent_id && now - e.t < 600_000 && e.data?.path === resource)) return { allow: false, reason: `LEASE EXPIRED: you held ${resource} but did nothing for too long, so the lock was released${other ? ` and ${other.agent_id} holds it now` : ""}. Stop now and report it; the lead will call you again.` };
  store.ev("edit.denied", task_id, agent_id, { resource, holder: other?.agent_id ?? null });
  return other
    ? { allow: false, reason: `LOCKED: ${resource} is held by ${other.agent_id}. Only one agent may run ${resource} commands at a time. Do not retry in a loop: do other work or report that you are waiting for ${other.agent_id}.` }
    : { allow: false, reason: `NOT DECLARED: this command needs ${resource} and you did not declare it. Stop and report it; the lead must call again with ${resource} in writes.` };
}
/** The PreToolUse decision for Write/Edit/MultiEdit/NotebookEdit: allowed only inside paths this agent holds. */
export function guardEdit(store: Store, task_id: string, agent_id: string, file: string, now: number, ttlMs = 1_200_000): Guard {
  reap(store, now);
  const mine = store.locks.filter((l) => l.task_id === task_id && l.agent_id === agent_id && !isResource(l.path));
  if (mine.some((l) => covers(l.path, file))) { renew(store, agent_id, ttlMs, now); return { allow: true }; }
  const other = store.locks.find((l) => l.task_id === task_id && l.agent_id !== agent_id && !isResource(l.path) && covers(l.path, file));
  if (store.events.some((e) => e.kind === "lock.expired" && e.agent_id === agent_id && now - e.t < 600_000 && covers(String(e.data?.path ?? ""), file))) return { allow: false, reason: `LEASE EXPIRED: you held ${file} but did nothing for too long, so the lock was released${other ? ` and ${other.agent_id} holds it now` : ""}. Stop now and report it; the lead will call you again.` };
  const queued = store.waiters.find((w) => w.task_id === task_id && w.agent_id === agent_id);
  store.ev("edit.denied", task_id, agent_id, { file, holder: other?.agent_id ?? null });
  if (other) return { allow: false, reason: `LOCKED: ${file} is held by ${other.agent_id}${queued ? ` (your request is queued at position ${store.waiters.filter((w) => w.task_id === task_id).indexOf(queued) + 1})` : ""}. Do not write it and do not retry in a loop. Edit only files you hold${mine.length ? ` (${mine.map((m) => m.path).join(", ")})` : ""}, or finish and report that you are blocked by ${other.agent_id}.` };
  return { allow: false, reason: `NOT DECLARED: ${file} is outside the writes you declared${mine.length ? ` (${mine.map((m) => m.path).join(", ")})` : ""}. Stop and report it; the lead must call again with writes that include it.` };
}
