// A `claude -p` call that has ANSWERED but never exited. Seen on pp_eiffel: builder #3 wrote its final report at 13:47:41, the CLI never wrote its closing
// `cost-state` record and never exited, so the harness (which waits for the process to close, 20 min for a builder) saw "running" for 8.5 minutes; the lead
// peeked, nudged, stopped it and started another builder to redo finished work, and the run's cost for that call was lost (0).
// Detection from the session log alone (pure, tested): the LAST turn ended (`stop_reason: end_turn`), nothing follows it (no tool result, no `cost-state`
// that a clean exit writes), and the log has been silent for `graceMs`. Then the answer is collected from the log and the cost is ESTIMATED from the usage.
export interface Finished { reply: string; cost: number }
type Rec = { type?: string; timestamp?: string; message?: { id?: string; model?: string; stop_reason?: string | null; content?: { type?: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } } };
/** USD per million tokens (input, output, cache read, cache write 5 min). Estimates: the real figure is the CLI's own `total_cost_usd`, lost when the process hangs. */
const PRICE: Record<string, [number, number, number, number]> = { haiku: [1, 5, 0.1, 1.25], sonnet: [3, 15, 0.3, 3.75], opus: [15, 75, 1.5, 18.75] };
export function finishedTurn(log: string, sinceMs: number, mtimeMs: number, nowMs: number, graceMs = 45_000, model = "sonnet"): Finished | null {
  if (nowMs - mtimeMs < graceMs) return null;
  const recs: Rec[] = [];
  for (const l of log.split("\n")) { if (!l.trim()) continue; try { recs.push(JSON.parse(l) as Rec); } catch { /* a cut line */ } }
  let last = -1;
  for (let i = recs.length - 1; i >= 0; i--) if (recs[i]!.type === "assistant") { last = i; break; }
  if (last < 0) return null;
  const fin = recs[last]!;
  if (fin.message?.stop_reason !== "end_turn") return null;
  if (recs.slice(last + 1).some((r) => r.type === "user" || r.type === "assistant" || r.type === "cost-state")) return null;   // a tool result is pending, or the CLI exited cleanly
  if (Date.parse(fin.timestamp ?? "") < sinceMs) return null;   // the end_turn of an EARLIER call of a resumed session
  const id = fin.message?.id, reply = recs.filter((r) => r.type === "assistant" && r.message?.id === id).flatMap((r) => r.message?.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
  // cost: one usage per message id (its first record carries the input side, the largest output_tokens the output side), only this call's messages
  const per = new Map<string, { i: number; o: number; cr: number; cw: number }>();
  for (const r of recs) if (r.type === "assistant" && r.message?.id && Date.parse(r.timestamp ?? "") >= sinceMs - 1000) { const u = r.message.usage ?? {}, e = per.get(r.message.id) ?? { i: u.input_tokens ?? 0, o: 0, cr: u.cache_read_input_tokens ?? 0, cw: u.cache_creation_input_tokens ?? 0 }; e.o = Math.max(e.o, u.output_tokens ?? 0); per.set(r.message.id, e); }
  const p = PRICE[/haiku/i.test(model) ? "haiku" : /opus/i.test(model) ? "opus" : "sonnet"]!;
  let cost = 0; for (const e of per.values()) cost += (e.i * p[0] + e.o * p[1] + e.cr * p[2] + e.cw * p[3]) / 1e6;
  return { reply, cost: Math.round(cost * 10000) / 10000 };
}
