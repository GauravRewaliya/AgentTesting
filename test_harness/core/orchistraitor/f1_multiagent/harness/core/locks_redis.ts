// Lock backend on Redis (the planned core store for locks). The same rules as locks.ts, but every decision is ONE Lua script, so it is atomic
// across any number of processes and machines:
//   - all paths or none (never a partial hold), FIFO queue, a later request cannot jump an earlier overlapping waiter
//   - a name starting with "@" (a resource such as @git) conflicts only with the same name
//   - a lease (ttl) that lapses frees the lock; time is Redis's clock, so machines cannot disagree
//   - release hands the lock to the waiters in arrival order and returns who got it
// Keys per task use a hash tag, so a task's keys live on one node in a cluster:  lf:{task}:locks (hash path -> agent|call|expiry)  lf:{task}:waiters (list)
const PRELUDE = `
local function now_ms() local t = redis.call('TIME'); return tonumber(t[1])*1000 + math.floor(tonumber(t[2])/1000) end
local function lit(g) local s = string.gsub(g, '^%./', ''); local i = string.find(s, '*', 1, true); if i then return string.sub(s, 1, i-1) end; return s end
local function isres(s) return string.sub(s,1,1) == '@' end
local function ov(a, b) if isres(a) or isres(b) then return a == b end local x = lit(a); local y = lit(b); return string.sub(x,1,#y) == y or string.sub(y,1,#x) == x end
local function parse(v) local a, c, e = string.match(v, '^(.-)|(.-)|(%d+)$'); return a, c, tonumber(e) end
local function reap(lk, now) local all = redis.call('HGETALL', lk); for i = 1, #all, 2 do local a, c, e = parse(all[i+1]); if e <= now then redis.call('HDEL', lk, all[i]); local tk = lk .. ':expired'; redis.call('HSET', tk, a .. '|' .. all[i], now); redis.call('PEXPIRE', tk, 600000) end end end
local function hit(ps, qs) for _, p in ipairs(ps) do for _, q in ipairs(qs) do if ov(p, q) then return true end end end return false end
local function try(lk, wk, agent, call, ttl, paths, now)
  reap(lk, now)
  local mineAll = true
  for _, p in ipairs(paths) do local v = redis.call('HGET', lk, p); local a, c = nil, nil; if v then a, c = parse(v) end; if not (v and a == agent and c == call) then mineAll = false end end
  if mineAll then for _, p in ipairs(paths) do redis.call('HSET', lk, p, agent .. '|' .. call .. '|' .. (now + ttl)) end; return {1} end   -- idempotent: already holds it all (e.g. promoted from the queue)
  local seen, heldList = {}, {}
  local all = redis.call('HGETALL', lk)
  for i = 1, #all, 2 do local a = parse(all[i+1]); if a ~= agent and hit(paths, {all[i]}) and not seen[a] then seen[a] = true; table.insert(heldList, a) end end
  local ws = redis.call('LRANGE', wk, 0, -1); local mine = -1; local dec = {}
  for i, w in ipairs(ws) do dec[i] = cjson.decode(w); if dec[i].call == call then mine = i end end
  for i, d in ipairs(dec) do if d.agent ~= agent and (mine < 0 or i < mine) and hit(paths, d.paths) and not seen[d.agent] then seen[d.agent] = true; table.insert(heldList, d.agent) end end
  if #heldList > 0 then
    if mine < 0 then redis.call('RPUSH', wk, cjson.encode({call = call, agent = agent, paths = paths})); dec[#dec+1] = {call = call, agent = agent, paths = paths} end
    local pos = 0; for _, d in ipairs(dec) do if hit(paths, d.paths) then pos = pos + 1 end; if d.call == call then break end end
    return {0, heldList, pos}
  end
  if mine > 0 then redis.call('LREM', wk, 1, ws[mine]) end
  for _, p in ipairs(paths) do redis.call('HSET', lk, p, agent .. '|' .. call .. '|' .. (now + ttl)) end
  return {1}
end`;
const ACQUIRE = PRELUDE + `
local paths = {}; for i = 4, #ARGV do paths[#paths+1] = ARGV[i] end
local r = try(KEYS[1], KEYS[2], ARGV[1], ARGV[2], tonumber(ARGV[3]), paths, now_ms())
if r[1] == 1 then return cjson.encode({ok = true}) end
return cjson.encode({ok = false, heldBy = r[2], position = r[3]})`;
const RELEASE = PRELUDE + `
local call, ttl, now = ARGV[1], tonumber(ARGV[2]), now_ms(); reap(KEYS[1], now)
local all = redis.call('HGETALL', KEYS[1]); for i = 1, #all, 2 do local a, c = parse(all[i+1]); if c == call then redis.call('HDEL', KEYS[1], all[i]) end end
for _, w in ipairs(redis.call('LRANGE', KEYS[2], 0, -1)) do if cjson.decode(w).call == call then redis.call('LREM', KEYS[2], 1, w) end end
local promoted = {}
for _, w in ipairs(redis.call('LRANGE', KEYS[2], 0, -1)) do local d = cjson.decode(w); local r = try(KEYS[1], KEYS[2], d.agent, d.call, ttl, d.paths, now); if r[1] == 1 then table.insert(promoted, d.call) end end
return cjson.encode(promoted)`;
const RENEW = PRELUDE + `
local now, ttl = now_ms(), tonumber(ARGV[2]); reap(KEYS[1], now)
local all = redis.call('HGETALL', KEYS[1]); for i = 1, #all, 2 do local a, c = parse(all[i+1]); if a == ARGV[1] then redis.call('HSET', KEYS[1], all[i], a .. '|' .. c .. '|' .. (now + ttl)) end end
return 1`;

export interface Held { path: string; agent_id: string; call_id: string; ms_left: number }
export type AcquireRes = { ok: true } | { ok: false; heldBy: string[]; position: number };
type Client = { send(cmd: string, args: string[]): Promise<unknown>; close(): void };

export class RedisLocks {
  constructor(public client: Client, private prefix = "lf") {}
  static connect(url: string, prefix = "lf") { const B = (globalThis as unknown as { Bun: { RedisClient: new (u: string) => Client } }).Bun; return new RedisLocks(new B.RedisClient(url), prefix); }
  private keys(task: string) { return [`${this.prefix}:{${task}}:locks`, `${this.prefix}:{${task}}:waiters`]; }
  private async eval(script: string, task: string, args: string[]) { return String(await this.client.send("EVAL", [script, "2", ...this.keys(task), ...args])); }
  async acquire(o: { task_id: string; agent_id: string; call_id: string; paths: string[]; ttlMs: number }): Promise<AcquireRes> {
    return JSON.parse(await this.eval(ACQUIRE, o.task_id, [o.agent_id, o.call_id, String(o.ttlMs), ...o.paths]));
  }
  /** Free a finished call's locks and hand them to waiting calls in arrival order; returns the call ids that now hold their locks. */
  async release(task_id: string, call_id: string, ttlMs: number): Promise<string[]> { const v = JSON.parse(await this.eval(RELEASE, task_id, [call_id, String(ttlMs)])); return Array.isArray(v) ? v : []; }
  async renew(task_id: string, agent_id: string, ttlMs: number) { await this.eval(RENEW, task_id, [agent_id, String(ttlMs)]); }
  async holders(task_id: string): Promise<Held[]> {
    const lk = this.keys(task_id)[0]!, flat = (await this.client.send("HGETALL", [lk])) as unknown, now = Date.now(), out: Held[] = [];
    const pairs: [string, string][] = Array.isArray(flat) ? (flat as string[]).reduce<[string, string][]>((a, v, i, arr) => (i % 2 ? a : [...a, [v, arr[i + 1]!]]), []) : Object.entries(flat as Record<string, string>);
    for (const [path, v] of pairs) { const m = /^(.*?)\|(.*?)\|(\d+)$/.exec(v); if (m && Number(m[3]) > now - 5) out.push({ path, agent_id: m[1]!, call_id: m[2]!, ms_left: Number(m[3]) - now }); }
    return out;
  }
  /** The PreToolUse decision, same wording as locks.ts: a path (glob) edit, or a "@resource" for a shell command family. */
  /** Did THIS agent hold `target` and lose it because the lease lapsed? (kept for 10 minutes) */
  private async lapsed(task_id: string, agent_id: string, target: string): Promise<boolean> {
    const tk = this.keys(task_id)[0]! + ":expired", flat = (await this.client.send("HGETALL", [tk])) as unknown;
    const keys = Array.isArray(flat) ? (flat as string[]).filter((_, i) => i % 2 === 0) : Object.keys(flat as Record<string, string>);
    return keys.some((k) => { const [a, ...rest] = k.split("|"), p = rest.join("|"); return a === agent_id && (p === target || (!target.startsWith("@") && !p.startsWith("@") && (p.includes("*") ? target.startsWith(p.split("*")[0]!) : target.startsWith(p)))); });
  }
  async guard(task_id: string, agent_id: string, target: string, ttlMs = 120_000): Promise<{ allow: true } | { allow: false; reason: string; holder?: string }> {
    const hs = await this.holders(task_id), isRes = target.startsWith("@");
    const covers = (g: string, p: string) => !g.startsWith("@") && (g.includes("*") ? new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*") + "$").test(p) : p === g || p.startsWith(g.replace(/\/$/, "") + "/"));
    const matches = (h: Held) => (isRes ? h.path === target : covers(h.path, target));
    if (hs.some((h) => h.agent_id === agent_id && matches(h))) { await this.renew(task_id, agent_id, ttlMs); return { allow: true }; }
    const other = hs.find((h) => h.agent_id !== agent_id && matches(h));
    if (await this.lapsed(task_id, agent_id, target)) return { allow: false, reason: `LEASE EXPIRED: you held ${target} but did nothing for too long, so the lock was released${other ? ` and ${other.agent_id} holds it now` : ""}. Stop now and report it; the lead will call you again.` };
    if (other) return { allow: false, holder: other.agent_id, reason: `LOCKED: ${target} is held by ${other.agent_id}. Do not retry in a loop; do other work or report that you are waiting for ${other.agent_id}.` };
    return { allow: false, reason: `NOT DECLARED: ${target} is outside what you declared. Stop and report it; the lead must call again with it in writes.` };
  }
  /** Calls waiting for their locks, in arrival order (for the board). */
  async waiting(task_id: string): Promise<{ agent_id: string; call_id: string; paths: string[] }[]> {
    const raw = (await this.client.send("LRANGE", [this.keys(task_id)[1]!, "0", "-1"])) as string[] | null;
    return (raw ?? []).map((w) => JSON.parse(w) as { agent: string; call: string; paths: string[] }).map((d) => ({ agent_id: d.agent, call_id: d.call, paths: d.paths }));
  }
  async flush(task_id: string) { await this.client.send("DEL", this.keys(task_id)); }
  close() { this.client.close(); }
}
