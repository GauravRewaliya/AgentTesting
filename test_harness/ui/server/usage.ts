// Usage for the Settings page, like `/usage` but local: tokens per day and model of the last DAYS days, summed from Claude's own session transcripts
// (<profile>/projects/**/*.jsonl; every assistant line carries `usage` and `model`). No network, no login token. ~/.claude/stats-cache.json is NOT used: it is stale.
// A transcript file is parsed once per (mtime, size); an unchanged file costs a stat. The result is pushed as hub topic `usage` only when it changed.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { claudeDirs } from "@core/orchestrator.ts";

export const DAYS = 30;
export interface UsageRow { date: string; model: string; input: number; output: number; cache_read: number; cache_create: number }
export interface UsageOut { days: number; rows: UsageRow[]; sessions: number; totals: { input: number; output: number; cache_read: number; cache_create: number }; link: string; profiles: string[] }
type PerFile = { key: string; rows: Map<string, UsageRow> };
const cache = new Map<string, PerFile>();   // file -> parsed rows

function parse(file: string): Map<string, UsageRow> {
  const msgs = new Map<string, UsageRow>();   // a message repeats on several lines (one per content block): the LAST line of an id wins
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.includes('"usage"')) continue;
    let d: { type?: string; timestamp?: string; requestId?: string; message?: { id?: string; model?: string; usage?: Record<string, number> } };
    try { d = JSON.parse(line); } catch { continue; }
    const m = d.message, u = m?.usage; if (d.type !== "assistant" || !u || !d.timestamp || !m?.model || m.model.startsWith("<")) continue;
    msgs.set(m.id ?? d.requestId ?? line.slice(0, 64), { date: d.timestamp.slice(0, 10), model: m.model, input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cache_read: u.cache_read_input_tokens ?? 0, cache_create: u.cache_creation_input_tokens ?? 0 });
  }
  return msgs;
}
function* transcripts(root: string): Generator<string> {
  let dirs: string[] = []; try { dirs = readdirSync(root); } catch { return; }
  for (const d of dirs) { let fs: string[] = []; try { fs = readdirSync(join(root, d)); } catch { continue; } for (const f of fs) if (f.endsWith(".jsonl")) yield join(root, d, f); }
}
export function usage(): UsageOut {
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10), cutoff = Date.now() - (DAYS + 1) * 86_400_000;
  const sum = new Map<string, UsageRow>(), seen = new Set<string>(), profiles: string[] = [];
  let sessions = 0;
  for (const dir of claudeDirs()) {
    const root = join(dir, "projects"); if (!existsSync(root)) continue; profiles.push(dir);
    for (const f of transcripts(root)) {
      let st; try { st = statSync(f); } catch { continue; } if (st.mtimeMs < cutoff) continue;
      const key = `${st.mtimeMs}:${st.size}`; let pf = cache.get(f);
      if (!pf || pf.key !== key) { try { pf = { key, rows: parse(f) }; } catch { continue; } cache.set(f, pf); }
      let any = false;
      for (const [id, r] of pf.rows) {
        if (r.date < since || seen.has(id)) continue; seen.add(id); any = true;   // a session resumed in two profiles must not count twice
        const k = r.date + "|" + r.model, t = sum.get(k) ?? { date: r.date, model: r.model, input: 0, output: 0, cache_read: 0, cache_create: 0 };
        t.input += r.input; t.output += r.output; t.cache_read += r.cache_read; t.cache_create += r.cache_create; sum.set(k, t);
      }
      if (any) sessions++;
    }
  }
  const rows = [...sum.values()].sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));
  const totals = rows.reduce((a, r) => ({ input: a.input + r.input, output: a.output + r.output, cache_read: a.cache_read + r.cache_read, cache_create: a.cache_create + r.cache_create }), { input: 0, output: 0, cache_read: 0, cache_create: 0 });
  return { days: DAYS, rows, sessions, totals, link: "https://claude.ai/settings/usage", profiles };
}
