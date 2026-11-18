// The JUDGE of the prompt tests: pure functions (no model, no files). Used by the runner (scripts/prompt_test.ts) and by the dashboard server (ui/server/prompttests.ts) so both describe and judge a case the same way.
import type { CallMatch, PromptExpect } from "../../TestCases/test_folders/prompt_test/types.ts";

export interface Call { tool: string; input: Record<string, unknown>; id: string; turn: string }

export const inputStr = (c: Call) => JSON.stringify(c.input);
export const roleOf = (c: Call): string => String(c.input.subagent_type ?? c.input.role ?? /--role[ =]+([\w-]+)/.exec(String(c.input.command ?? ""))?.[1] ?? (c.tool === "mcp__team__team_tool" ? c.input.command : "") ?? "");
export const weight = (c: Call) => (c.tool === "mcp__team__fork_all" && Array.isArray(c.input.tasks) ? c.input.tasks.length : 1);
export const hit = (c: Call, m: CallMatch): boolean => m.any ? m.any.some((a) => hit(c, a)) : (!m.tool || c.tool === m.tool) && (!m.role || roleOf(c) === m.role) && (!m.match || new RegExp(m.match, "i").test(inputStr(c))) && (m.each ?? []).every((r) => new RegExp(r, "is").test(inputStr(c)));
/** how many calls of the transcript match: a fork_all counts one per entry of its `tasks` */
export function count(calls: Call[], m: CallMatch): number { return m.any ? m.any.reduce((n, a) => n + count(calls, a), 0) : calls.filter((c) => hit(c, m)).reduce((n, c) => n + weight(c), 0); }
export const desc = (m: CallMatch): string => m.any ? m.any.map(desc).join(" OR ") : [m.tool, m.role && `role=${m.role}`, m.match && `/${m.match}/`, m.each?.length && `each carries ${m.each.map((r) => `/${r}/`).join(" + ")}`, m.min && m.min > 1 ? `x${m.min}+` : "", m.max !== undefined ? `x${m.max} at most` : ""].filter(Boolean).join(" ") || "any call";
/** the file sets a started builder owns: a `WRITES:` line in an Agent prompt, or each fork_all task's `writes` */
export function owners(calls: Call[], m: CallMatch): string[][] {
  const out: string[][] = [];
  for (const c of calls.filter((x) => hit(x, m))) {
    if (c.tool === "mcp__team__fork_all" && Array.isArray(c.input.tasks)) for (const t of c.input.tasks as { writes?: string[] | string }[]) out.push((Array.isArray(t.writes) ? t.writes : String(t.writes ?? "").split(",")).map((x) => x.trim()).filter(Boolean));
    else { const l = /^\s*WRITES:\s*(.+)$/im.exec(String(c.input.prompt ?? c.input.message ?? "")); out.push(l ? l[1]!.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean) : []); }
  }
  return out;
}
export const overlaps = (a: string, b: string) => { const x = a.replace(/\/+$/, ""), y = b.replace(/\/+$/, ""); return x === y || x.startsWith(y + "/") || y.startsWith(x + "/"); };

/** the +ve / -ve expectations of a case as plain lines (printed as EXPECTED) */
export function describeExpect(e: PromptExpect): string[] {
  const l: string[] = [];
  if (e.no_calls) l.push("no tool call at all (it answers in words)");
  if (e.first_call) l.push(`first call: ${desc(e.first_call)}`);
  for (const m of e.calls ?? []) l.push(`+ve ${desc(m)}`);
  if (e.same_turn) l.push(`+ve started TOGETHER (same turn): ${desc(e.same_turn)} x${e.same_turn.min ?? 2}+`);
  if (e.disjoint_writes) l.push(`+ve different files for each: ${desc(e.disjoint_writes)} (WRITES / writes do not overlap)`);
  for (const m of e.not_calls ?? []) l.push(`-ve must NOT: ${desc(m)}`);
  for (const r of e.text_has ?? []) l.push(`+ve the text has /${r}/`);
  if (e.any_of?.length) l.push(`+ve ONE OF: ${e.any_of.map((a, i) => `(${i + 1}) ${describeExpect(a).join(" and ")}`).join("  |  ")}`);
  for (const r of e.text_not ?? []) l.push(`-ve the text must not have /${r}/`);
  return l;
}
export function judge(e: PromptExpect, calls: Call[], text: string): string[] {
  const bad: string[] = [];
  if (e.no_calls && calls.length) bad.push(`made ${calls.length} tool call(s), expected none: ${calls.map((c) => c.tool).join(", ")}`);
  if (e.first_call && !(calls[0] && hit(calls[0], e.first_call))) bad.push(`the FIRST call should be [${desc(e.first_call)}], it was ${calls[0] ? `${calls[0].tool}${roleOf(calls[0]) ? `(${roleOf(calls[0])})` : ""}` : "nothing"}`);
  for (const m of e.calls ?? []) { const n = count(calls, m), lo = m.min ?? 1; if (n < lo || (m.max !== undefined && n > m.max)) bad.push(`expected ${m.max !== undefined ? `${lo}..${m.max}` : `>=${lo}`} of [${desc(m)}], got ${n}`); }
  for (const m of e.not_calls ?? []) { const n = count(calls, m); if (n > 0) bad.push(`must NOT call [${desc(m)}], did ${n}x`); }
  if (e.same_turn) {   // the matching calls must share one assistant turn (started together)
    const m = e.same_turn, need = m.min ?? 2, byTurn = new Map<string, number>();
    for (const t of new Set(calls.map((c) => c.turn))) byTurn.set(t, count(calls.filter((c) => c.turn === t), m));
    if (![...byTurn.values()].some((n) => n >= need)) bad.push(`expected >=${need} of [${desc(m)}] in the SAME turn (started together), best turn had ${Math.max(0, ...byTurn.values())} (it started them one after another, or did only one)`);
  }
  if (e.disjoint_writes) {
    const o = owners(calls, e.disjoint_writes);
    o.forEach((w, i) => { if (!w.length) bad.push(`builder #${i + 1} has no WRITES / writes: nothing says which files it owns`); });
    for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) { const hitp = o[i]!.find((a) => o[j]!.some((b) => overlaps(a, b))); if (hitp) bad.push(`builders #${i + 1} and #${j + 1} both own ${hitp}`); }
  }
  if (e.any_of?.length) { const tries = e.any_of.map((a) => judge(a, calls, text)); if (!tries.some((t) => !t.length)) bad.push(`none of the acceptable behaviours happened (${tries.map((t, i) => `(${i + 1}) ${t[0]}`).join("; ")})`); }
  for (const r of e.text_has ?? []) if (!new RegExp(r, "im").test(text)) bad.push(`the text lacks /${r}/`);
  for (const r of e.text_not ?? []) if (new RegExp(r, "im").test(text)) bad.push(`the text must not contain /${r}/`);
  return bad;
}
export const callLine = (x: Call, n = 110) => `${x.tool}${roleOf(x) ? `(${roleOf(x)})` : ""}${x.tool === "Agent" || x.tool === "SendMessage" ? ` "${String(x.input.prompt ?? x.input.message ?? "").slice(0, n).replace(/\s+/g, " ")}"` : x.tool === "Bash" ? ` \`${String(x.input.command ?? "").slice(0, n).replace(/\s+/g, " ")}\`` : x.tool.startsWith("mcp__") ? ` ${inputStr(x).slice(0, n)}` : ""}`;


// ---- EFFICIENCY AUDIT: not "did it decide right" but "how did it get there": extra calls, looks at what it already had, a check re-run whose result it was given, a check BEFORE any change, many look rounds,
// too many agents for the work, the same call twice. It never fails a case by itself (notes + a verdict lean / ok / wasteful); only an explicit `expect.budget` fails.
export interface Audit { calls: number; looks: number; rounds: number; agents: number; verdict: "lean" | "ok" | "wasteful"; notes: string[] }
const CHECK = /\b(tsc --noEmit|node --check|pnpm (run )?(build|test)|proto_check|vitest|jest)\b/;
const WRITE = new Set(["Write", "Edit", "MultiEdit"]);
/** `all` = every call of every step (looks first, then the deciding turn); `rounds` = how many turns it took (1 = decided at once); `given` = the text of everything the case handed it (stuff, messages) */
export function auditEfficiency(all: Call[], rounds: number, given: string, isLook: (c: Call) => boolean, expectsMax?: number): Audit {
  const notes: string[] = [], agents = all.filter((c) => c.tool === "Agent" || c.tool === "SendMessage" || c.tool === "mcp__team__fork_all").reduce((n, c) => n + weight(c), 0), looks = all.filter(isLook).length;
  const seen = new Map<string, number>(); for (const c of all) seen.set(c.tool + inputStr(c), (seen.get(c.tool + inputStr(c)) ?? 0) + 1);
  for (const [k, n] of seen) if (n > 1) notes.push(`the same call ${n} times: ${k.slice(0, 80)}`);
  if (rounds > 1) notes.push(`${rounds} look rounds before it decided${rounds > 2 ? " (the context already held what it needed)" : ""}`);
  for (const c of all.filter(isLook)) {   // a look at something the case handed over already
    const path = /["'/]?((?:run_test\/)?[\w./-]{4,}\.(?:ts|js|md|json|html|css|vue|yaml|yml|txt))/.exec(inputStr(c))?.[1];
    if (path && given.includes(path)) { notes.push(`looked at ${path.split("/").slice(-2).join("/")}, which it was already given`); break; }
  }
  for (const c of all) { const cmd = String(c.input.command ?? ""); if (c.tool === "Bash" && CHECK.test(cmd)) { const kw = CHECK.exec(cmd)![1]!.replace(/\s+/g, " "); if (new RegExp(kw.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&").replace(/ /g, "\\s+")).test(given)) { notes.push(`re-ran \`${kw}\`, whose result it was already given`); break; } } }
  const firstWrite = all.findIndex((c) => WRITE.has(c.tool)), firstCheck = all.findIndex((c) => c.tool === "Bash" && CHECK.test(String(c.input.command ?? "")));
  if (firstCheck >= 0 && firstWrite > firstCheck) notes.push("ran a check BEFORE it changed anything (nothing to check yet)");
  if (all.length > 6) notes.push(`${all.length} tool calls in one decision`);
  if (expectsMax !== undefined && agents > expectsMax) notes.push(`${agents} agent call(s) for work that needs ${expectsMax}`);
  const verdict = notes.length >= 3 || rounds > 2 || all.length > 8 ? "wasteful" : notes.length ? "ok" : "lean";
  return { calls: all.length, looks, rounds, agents, verdict, notes };
}
