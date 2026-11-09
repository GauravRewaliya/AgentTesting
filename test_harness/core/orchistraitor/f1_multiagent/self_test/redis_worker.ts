// One contender for the stress test: wait in the queue for the file, hold it for a moment, and record whether anyone else was inside at the same time.
import { RedisLocks } from "../harness/core/locks_redis.ts";
const [url, task, id, hold] = process.argv.slice(2) as [string, string, string, string];
const L = RedisLocks.connect(url), c = L.client;
const q = { task_id: task, agent_id: "agent-" + id, call_id: "call-" + id, paths: ["stress/file.ts"], ttlMs: 20_000 };
await c.send("RPUSH", ["stress:arrival", id]);   // first request time defines arrival order... recorded right before the first try
for (;;) { const r = await L.acquire(q); if (r.ok) break; await new Promise((r2) => setTimeout(r2, 15)); }
const inside = Number(await c.send("INCR", ["stress:active"]));
if (inside > 1) await c.send("INCR", ["stress:violations"]);
await c.send("RPUSH", ["stress:granted", id]);
await new Promise((r) => setTimeout(r, Number(hold)));
await c.send("DECR", ["stress:active"]);
await L.release(task, q.call_id, 20_000);
L.close();
