// One lock API for the whole harness, two backends: the registry file (default) or Redis (HARNESS_LOCKS_URL=redis://host:port).
// Agents never call it. The harness takes the locks BEFORE a callee starts (from the lead's declared writes), the hook checks them on every
// edit and every command family, a lease (ttl) frees whatever its holder stopped using, and the finishing call releases and hands over.
import { acquire, guardEdit, guardResource, release, renew, reap } from "./locks.ts";
import { RedisLocks, type AcquireRes, type Held } from "./locks_redis.ts";
import type { MStore } from "./board.ts";

export type GuardRes = { allow: true } | { allow: false; reason: string; holder?: string };
export interface LockApi {
  kind: "store" | "redis";
  acquire(o: { task_id: string; agent_id: string; call_id: string; paths: string[]; ttlMs: number }): Promise<AcquireRes>;
  release(task_id: string, call_id: string, ttlMs: number): Promise<string[]>;
  renew(task_id: string, agent_id: string, ttlMs: number): Promise<void>;
  guard(task_id: string, agent_id: string, target: string, ttlMs?: number): Promise<GuardRes>;   // a path or an "@resource"
  holders(task_id: string): Promise<Held[]>;
  waiting(task_id: string): Promise<{ agent_id: string; call_id: string; paths: string[] }[]>;
}
export class StoreLocks implements LockApi {
  kind = "store" as const;
  constructor(private store: MStore) {}
  async acquire(o: { task_id: string; agent_id: string; call_id: string; paths: string[]; ttlMs: number }) { return this.store.tx(() => acquire(this.store, { ...o, now: Date.now() })); }
  async release(task_id: string, call_id: string, ttlMs: number) { return this.store.tx(() => release(this.store, call_id, ttlMs, Date.now())); }
  async renew(task_id: string, agent_id: string, ttlMs: number) { this.store.tx(() => renew(this.store, agent_id, ttlMs, Date.now())); }
  async guard(task_id: string, agent_id: string, target: string, ttlMs = 1_200_000): Promise<GuardRes> {
    return this.store.tx(() => (target.startsWith("@") ? guardResource(this.store, task_id, agent_id, target, Date.now(), ttlMs) : guardEdit(this.store, task_id, agent_id, target, Date.now(), ttlMs)));
  }
  async waiting(task_id: string) { return this.store.waiters.filter((w) => w.task_id === task_id).map((w) => ({ agent_id: w.agent_id, call_id: w.call_id, paths: w.paths })); }
  async holders(task_id: string): Promise<Held[]> { return this.store.tx(() => { reap(this.store, Date.now()); return this.store.locks.filter((l) => l.task_id === task_id).map((l) => ({ path: l.path, agent_id: l.agent_id, call_id: l.call_id, ms_left: l.expires - Date.now() })); }); }
}
export function locksFromEnv(store: MStore, env: Record<string, string | undefined> = process.env): LockApi {
  const url = env.HARNESS_LOCKS_URL;
  if (!url) return new StoreLocks(store);
  const r = RedisLocks.connect(url, env.HARNESS_LOCKS_PREFIX ?? "lf");
  return { kind: "redis", acquire: (o) => r.acquire(o), release: (t, c, ttl) => r.release(t, c, ttl), renew: (t, a, ttl) => r.renew(t, a, ttl), guard: (t, a, target, ttl) => r.guard(t, a, target, ttl), holders: (t) => r.holders(t), waiting: (t) => r.waiting(t) };
}
