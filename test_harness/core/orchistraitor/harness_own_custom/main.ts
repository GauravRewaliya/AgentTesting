// harness_own_custom: our own tiny multi-agent runtime. No relation to the project or to Claude Code.
// Rules it must keep (the tests check them):
//   1. spawn(agent, task)  -> NEW session with a fresh id, empty history. Never reuses a session.
//   2. send(id, message)   -> continues THAT session only; unknown id is an error.
//   3. sessions are isolated: one session's history is never visible to another.
//   4. every event is appended to the event log (this is what we "interrupt" and inspect).
// Sub-agent work is mocked: replies come from TestCases/test_folders/agent_fixture/results/<id>.ts (run(req)), files are copied into the workspace.
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { FIXTURES, ROOT, RUN_TEST, resultFiles } from "@core/paths.ts";
import type { Fixture, Req, ResultModule } from "@core/types.ts";
import type { Decision, Event, IHarness, Interceptor, Msg, Session } from "./interface.ts";
export type { Decision, Event, IHarness, Interceptor, Msg, Session } from "./interface.ts";

// Recorded results (TestCases/test_folders/agent_fixture/results/<id>.ts): each is ONLY run(req). See ResultModule / Req in core/types.ts.
export type Recorded = { id: string; text: string; agent?: string; keywords?: string[]; after?: string; repeatable?: boolean; run: (o: { agent: string; task: string; ws: string; root: string }) => string };
export async function loadResults(dir: string): Promise<Recorded[]> {
  const out: Recorded[] = [];
  for (const { path } of resultFiles(dir)) {   // results/<suite>/<file>.ts
    const m = (await import(pathToFileURL(path).href)).default as ResultModule;
    out.push({
      id: m.id, text: m.expected_input?.text ?? "", agent: m.match?.agent, keywords: m.match?.keywords, after: m.match?.after, repeatable: m.match?.repeatable,
      run: ({ agent, task, ws, root }) => {
        const store = join(FIXTURES, "store");
        const req: Req = {
          agent, task, ws, store,
          cp(from, to = "") { const dst = join(ws, to); cpSync(join(store, from), dst, { recursive: true }); return walk(dst).map((p) => p.slice(ws.length + 1)); },
          write(path, text) { const abs = join(ws, path); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, text); }
        };
        return String(m.run(req));
      }
    });
  }
  return out;
}
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
// Similarity lookup (ported from Test_agent_2): hashed unigram+bigram bag of words, cosine, stoplist.
const STOP = new Set("a an the is are of to in on for and or how do does what when which i my can it that this with as be by at from open source ai coding agent agents harness tool tools cli its each use using run runs one two claude code mod mods someone else published".split(" "));
function embed(s: string) {
  const w = (s.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter((x) => !STOP.has(x)); const v = new Map<number, number>();
  for (const g of [...w, ...w.slice(1).map((b, i) => w[i] + "_" + b)]) { const k = Bun.hash.crc32(g) % 1024; v.set(k, (v.get(k) ?? 0) + 1); }
  const n = Math.sqrt([...v.values()].reduce((a, x) => a + x * x, 0)) || 1; return new Map([...v].map(([k, x]) => [k, x / n] as [number, number]));
}
const cos = (a: Map<number, number>, b: Map<number, number>) => { let s = 0; for (const [k, x] of a) s += x * (b.get(k) ?? 0); return s; };
export const HIT_MIN = 0.15;   // Test_agent_2's FIX_MIN: below this the lookup is NOTFOUND


/** Which recorded result answers this hand-over: ALL its keywords in the task (and the agent) win; otherwise the best similarity (>= HIT_MIN) among results without keywords. Exported so a tool can look up WITHOUT running. */
export function pickRecorded(results: Recorded[], agent: string, task: string, served: string[] = [], strict = false): Recorded | undefined {   // strict = the similarity fallback may only use results that declare THIS agent (f1 gate: an agent-less result of another suite must never answer)
  // a result with `after` (a rework "fix") is only eligible once that result was already served in this task (`served` = ids served so far)
  const rs = results.filter((r) => (!r.agent || r.agent === agent) && (!r.after || served.includes(r.after))); const low = task.toLowerCase();
  // a result NOT served yet beats one already served (the next step of a chain / rework); then the most specific (more keywords); then the one with `after`
  const kw = rs.filter((r) => r.keywords?.length && r.keywords.every((k) => low.includes(k.toLowerCase()))).sort((a, b) => Number(!served.includes(b.id)) - Number(!served.includes(a.id)) || b.keywords!.length - a.keywords!.length || Number(!!b.after) - Number(!!a.after))[0];
  if (kw) return kw;
  const q = embed(task.slice(0, 400)); let best: [number, Recorded?] = [0];
  for (const r of rs.filter((x) => !x.keywords?.length && (!strict || x.agent === agent))) { const sc = cos(q, embed(r.text)); if (sc > best[0]) best = [sc, r]; }
  return best[0] >= HIT_MIN ? best[1] : undefined;
}

export class Harness implements IHarness {
  sessions = new Map<string, Session>();
  lastFixture: string | null = null;
  constructor(private opts: { fixtures: Fixture[]; results?: Recorded[]; root?: string; ws: string; log?: string; onEvent?: (e: Event) => void; interceptor?: Interceptor }) {
    if (opts.log && existsSync(opts.log)) for (const l of readFileSync(opts.log, "utf8").split("\n").filter(Boolean)) this.replay(JSON.parse(l));
  }
  private replay(e: Event & { history?: Msg[] }) { if (e.kind === "spawn" && e.id) this.sessions.set(e.id, { id: e.id, agent: e.agent!, history: [] }); if (e.id && (e.kind === "spawn" || e.kind === "send" || e.kind === "reply")) this.sessions.get(e.id)?.history.push({ role: e.kind === "spawn" ? "task" : e.kind === "send" ? "followup" : "reply", text: e.text ?? "" }); }
  private emit(e: Omit<Event, "t">) {
    const ev = { t: Date.now(), ...e }; this.opts.onEvent?.(ev); this.opts.interceptor?.onEvent?.(ev);
    if (this.opts.log) { mkdirSync(dirname(this.opts.log), { recursive: true }); appendFileSync(this.opts.log, JSON.stringify(ev) + "\n"); }
  }
  private newId() { return "s" + crypto.randomUUID().replaceAll("-", "").slice(0, 12); }

  spawn(agent: string, task: string): { id: string; reply: string; fixture?: string | null } {
    const s: Session = { id: this.newId(), agent, history: [{ role: "task", text: task }] };
    this.sessions.set(s.id, s); this.emit({ kind: "spawn", id: s.id, agent, text: task });
    this.lastFixture = null; const reply = this.decide(this.opts.interceptor?.onSpawn?.({ agent, task }), s) ?? this.work(s, task); return { id: s.id, reply, fixture: this.lastFixture };
  }
  send(id: string, message: string): { id: string; reply: string } {
    const s = this.sessions.get(id);
    if (!s) { this.emit({ kind: "error", id, text: "unknown session" }); throw new Error(`unknown session ${id}`); }
    s.history.push({ role: "followup", text: message }); this.emit({ kind: "send", id, agent: s.agent, text: message });
    const d = this.decide(this.opts.interceptor?.onSend?.({ id, agent: s.agent, message, session: s }), s);
    if (d !== undefined) return { id, reply: d };
    // A follow-up is answered from THIS session's own history only.
    const did = s.history.filter((m) => m.role === "reply").map((m) => m.text).join(" | ") || "nothing yet";
    const reply = `[${s.agent}] I am done. I was asked: "${s.history[0].text.slice(0, 80)}". I did: ${did}`;
    s.history.push({ role: "reply", text: reply }); this.emit({ kind: "reply", id, agent: s.agent, text: reply });
    return { id, reply };
  }
  private lookup(agent: string, task: string): Recorded | undefined { return pickRecorded(this.opts.results ?? [], agent, task); }
  private decide(d: Decision | void, s: Session): string | undefined {
    if (!d) return undefined;
    if ("deny" in d) { this.emit({ kind: "error", id: s.id, agent: s.agent, text: d.deny }); throw new Error(d.deny); }
    const r = "respond" in d ? d.respond : d.script();
    this.lastFixture = "interceptor"; s.history.push({ role: "reply", text: r }); this.emit({ kind: "reply", id: s.id, agent: s.agent, text: r, fixture: "interceptor" });
    return r;
  }
  private work(s: Session, task: string): string {
    const low = task.toLowerCase();
    const hit = this.opts.fixtures.find((f) => f.keywords && !(this.opts.results ?? []).some((r) => r.id === f.id) && (!f.agent || f.agent === s.agent) && f.keywords.every((k) => low.includes(k.toLowerCase())));
    const rec = hit ? undefined : this.lookup(s.agent, task);
    if (rec) { this.lastFixture = rec.id; const r = rec.run({ agent: s.agent, task, ws: this.opts.ws, root: this.opts.root ?? "" }); s.history.push({ role: "reply", text: r }); this.emit({ kind: "reply", id: s.id, agent: s.agent, text: r, fixture: rec.id }); return r; }
    if (!hit) { this.emit({ kind: "miss", id: s.id, agent: s.agent, text: task, fixture: null }); const r = "NOTFOUND: no fixture for this task"; s.history.push({ role: "reply", text: r }); return r; }
    this.lastFixture = hit.id;
    for (const [p, text] of Object.entries(hit.files ?? {})) { const abs = join(this.opts.ws, p); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, text); }
    s.history.push({ role: "reply", text: hit.response }); this.emit({ kind: "reply", id: s.id, agent: s.agent, text: hit.response, fixture: hit.id });
    return hit.response;
  }
}

// CLI (used by the mod through $.process.run, one shot per call; state lives in the event log):
//   bun main.ts spawn <agent> < task     -> {"id","reply"}
//   bun main.ts send <id> < message      -> {"id","reply"}   (errors exit 2)
if (import.meta.main) {
  const ws = process.env.TEST_WS ?? RUN_TEST;
  const h = new Harness({ fixtures: [], results: await loadResults(join(FIXTURES, "results")), root: ROOT, ws, log: process.env.HARNESS_LOG ?? (() => { throw new Error("HARNESS_LOG is not set: the log lives in the case's run/ folder in .state"); })() });
  const [cmd, arg] = process.argv.slice(2); const input = await Bun.stdin.text();
  try { console.log(JSON.stringify(cmd === "spawn" ? h.spawn(arg, input) : h.send(arg, input))); }
  catch (e) { console.log(JSON.stringify({ error: String(e) })); process.exit(2); }
}
