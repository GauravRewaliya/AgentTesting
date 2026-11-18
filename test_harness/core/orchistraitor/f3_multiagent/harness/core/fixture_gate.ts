// FLOW of a call to a mocked sub-agent (agent.json "fixtures": true):
//   1. SESSION   did the master pass a session id (--session) that is in the DB table fixture_sessions? yes -> the call continues that fixture session (a REAL session -> real runner).
//   2. FIXTURE   check the prompt (guard) and look up a recorded result (keywords, `match.after`). Found -> serve it (script copies/patches run_test/, observer adds what changed).
//                A known session that asks for nothing new ("what did you do?") is answered from the table.
//   3. NO FIXTURE  case says allow_real_subAg -> the REAL sub-agent is called as a ONE-SHOT (no --session-id, no CLI session kept): the history from fixture_sessions (earlier fixture AND real turns) is put in its prompt,
//                  so it knows what was done; the answer is recorded in the table, its follow-ups stay real
//                  otherwise -> error "FIXTURE NOT FOUND" (call fails, the case is marked FAILED via fixture.fail).
// check_and_correction for agents with "fixtures": true in agent.json (test mode). The sub-agent is NOT run; this gate stands in front of it as a Runner:
//   1. CHECK    the lead's request (the whole prompt) must satisfy the guard rules (TestCases/test_folders/agent_fixture/store/*_rules.json) AND match a recorded result.
//   2. CORRECT  if not: the reply says what is missing and nothing runs. The lead may try again.
//   3. SERVE    if so: the recorded work runs (files go to <agent cwd>/run_test/) and its reply is the sub-agent's answer, on the fly, no model call.
//   SESSIONS    every call is recorded in the table `fixture_sessions` (fixture_sessions.ts): master task -> fixture session id -> state, version, served results, history. When the master sends the SAME session id
//               again ("check with <agent>") it is a follow-up of that fixture session: a new `fix` result may be served (workspace is shared, `match.after`), anything else ("what did you do?") is answered from the
//               table (history + files on disk now) without guard and without a model. No `claude -p`, no --session-id: the gate itself is the observer between the master and the mocked sub-agent.
//   OBSERVER    each served reply carries what the harness SAW change in run_test/ (see observe()).
//   LIMIT       at most `max_agent_calls` calls (declared on the test case; default GATE_LIMIT) to the agent per task. The call after that is refused and the case FAILS ("fixture.fail" event, shown by the judge):
//               a lead that never makes a valid request, or keeps going back to the sub-agent, is a failure.
// State is kept as store events ("fixture.call", "fixture.fail"): every tools.ts process sees them, and the judge (testrun/cases.ts) reads them.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES } from "@core/paths.ts";
import { loadResults, pickRecorded, type Recorded } from "../../../harness_own_custom/main.ts";
import { checkHandover, type Rule } from "../../../harness_own_custom/core/guard.ts";
import type { MStore } from "./board.ts";
import { findSession, historyDigest, historyForReal, isVerifyAsk, recordTurn, servedInTask } from "./fixture_sessions.ts";
import type { Runner, RunCall, RunResult } from "./base/types.ts";

export const GATE_LIMIT = 2;
export const MAX_VERIFY = 3;   // verify asks answered from the session table that do not count toward max_agent_calls
export type GateVerdict = "served" | "corrected" | "extra" | "real" | "notfound";
export interface GateCall { role: string; n: number; call: string | null; verdict: GateVerdict; result?: string; why?: string[]; reply?: string; observed?: string }

/** Every store/*_rules.json merged (roles do not overlap): { role: Rule }. */
function allRules(only?: string | null): Record<string, Rule> {
  const dir = join(FIXTURES, "store"), out: Record<string, Rule> = {};   // the case's own guard file when it names one (a real role such as builder has different rules per suite), else all
  for (const f of only && existsSync(join(dir, only)) ? [only] : readdirSync(dir).filter((x) => x.endsWith("_rules.json"))) Object.assign(out, JSON.parse(readFileSync(join(dir, f), "utf8")));
  return out;
}


// ── OBSERVER ────────────────────────────────────────────────────────────────────────────────────────────────
// The lead has no file tools, so it can only judge a sub-agent by what the answer SAYS. A fixture's own reply can be incomplete or boastful (that is what rework cases test), so the gate adds what it SEES:
// run_test/ is hashed before and after a served call; the difference (added / changed / removed files + the first lines of a few small changed files) is appended to the reply as an OBSERVER block, and the same
// block answers a later "verify / what did you do" ask (no model, no claude -p, no --session-id: the observer is the gate itself).
type Snap = Map<string, { size: number; sig: string }>;
const SKIP = new Set(["node_modules", ".git"]);
function snap(root: string, rel = "", out: Snap = new Map()): Snap {
  if (!existsSync(join(root, rel))) return out;
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) snap(root, p, out);
    else { const b = readFileSync(join(root, p)); out.set(p, { size: b.length, sig: createHash("md5").update(b).digest("hex") }); }
  }
  return out;
}
const lines = (p: string) => readFileSync(p, "utf8").split("\n");
/** One line for the FRONT of a reply (`wait` shows the lead only the first 600 chars of an answer): counts + the first changed paths, max 420 chars. */
export function observeHead(before: Snap, after: Snap): string {
  const add = [...after.keys()].filter((p) => !before.has(p)), chg = [...after].filter(([p, a]) => before.has(p) && before.get(p)!.sig !== a.sig).map(([p]) => p), del = [...before.keys()].filter((p) => !after.has(p));
  const paths = [...add.map((p) => "+" + p), ...chg.map((p) => "~" + p), ...del.map((p) => "-" + p)];
  return `OBSERVER(harness saw): ${add.length} added, ${chg.length} changed, ${del.length} removed: ${paths.join(" ")}`.slice(0, 420);
}
export function observe(root: string, before: Snap, after: Snap): string {
  const add: string[] = [], chg: string[] = [], del: string[] = [];
  for (const [p, a] of after) { const b = before.get(p); if (!b) add.push(p); else if (b.sig !== a.sig) chg.push(p); }
  for (const p of before.keys()) if (!after.has(p)) del.push(p);
  if (!add.length && !chg.length && !del.length) return "OBSERVER (the harness compared run_test/ before and after this call): NO file was added, changed or removed.";
  const fmt = (m: string, p: string) => `${m} ${p} (${existsSync(join(root, p)) ? lines(join(root, p)).length + " lines" : "gone"})`;
  const out = [`OBSERVER (the harness compared run_test/ before and after this call; this is what really changed, not what the sub-agent says):`, ...add.map((p) => fmt("+", p)), ...chg.map((p) => fmt("~", p)), ...del.map((p) => `- ${p}`)];
  const code = [...add, ...chg].filter((p) => /\.(tsx?|jsx?|css|json|mjs|js)$/.test(p) && (after.get(p)?.size ?? 1e9) < 20_000).sort((x, y) => Number(/\.json$/.test(x)) - Number(/\.json$/.test(y))).slice(0, 3);   // code before json
  for (const p of code) out.push(`--- ${p} (first lines)`, ...lines(join(root, p)).slice(0, 10).map((l) => "  " + l));
  return out.join("\n");
}

export class FixtureGate implements Runner {
  private results: Recorded[] | null = null;
  constructor(private real: Runner, private store: () => MStore, private limit = GATE_LIMIT) {}
  killAll() { this.real.killAll?.(); }

  async run(c: RunCall): Promise<RunResult> {
    const st = this.store(); st.reload();
    const mockEv = st.evs("fixture.mock", c.row.task_id).pop()?.data as { roles?: string[]; guard?: string | null; ids?: string[] } | undefined;   // declared by the case (declareGateLimit)
    if (!c.agent.fixtures && !mockEv?.roles?.includes(c.agent.name)) return this.real.run(c);
    const task = c.row.task_id, role = c.agent.name, mine = st.evs("fixture.call", task).map((e) => e.data as unknown as GateCall).filter((d) => d.role === role);
    const limit = Number((st.evs("fixture.limit", task).pop()?.data as { limit?: number } | undefined)?.limit ?? this.limit);   // declared by the test case (max_agent_calls)
    const n = mine.length + 1, ret = (reply: string, ok = true, error?: string): RunResult => ({ reply, session_id: c.session.id, cost: 0, ok, error });
    const log = (d: Omit<GateCall, "role" | "n" | "call">) => st.tx(() => st.ev("fixture.call", task, c.row.agent_id, { role, n, call: c.row.last_call_id ?? null, ...d }));

    // 5. LIMIT: `max_agent_calls` counts calls that DO something (served / corrected / real). A verify ask answered from the session table is free but capped (MAX_VERIFY) so a lead cannot loop on it for ever.
    const sinceT = Number(st.evs("fixture.limit", task).pop()?.t ?? 0), cur = st.evs("fixture.call", task).filter((e) => e.t >= sinceT).map((e) => e.data as unknown as GateCall).filter((d) => d.role === role);   // the limit counts the calls of THIS case only (declared by it: `fixture.limit`): in a chain (`after`) the task is shared, so the phase before must not use up this phase's calls
    const used = cur.filter((m) => m.verdict !== "extra").length;
    const refuse = (why: string): RunResult => {
      const reason = `call ${n} to '${role}' (${why}): the lead ${mine.some((m) => m.verdict === "served") ? "kept going back to the sub-agent after it was served" : "never made a valid request to it"}`;
      st.tx(() => st.ev("fixture.fail", task, c.row.agent_id, { role, n, call: c.row.last_call_id ?? null, reason }));
      return ret(`REFUSED: ${reason}. The case is marked FAILED.`, false, reason);
    };
    const charge = (): RunResult | null => (used + 1 > limit ? refuse(`limit ${limit}`) : null);   // call before anything that is NOT a free verify answer
    if (cur.length + 1 > limit + MAX_VERIFY) return refuse(`limit ${limit} + ${MAX_VERIFY} verify asks`);
    this.results ??= await loadResults(join(FIXTURES, "results"));
    const ws = join(c.cwd, "run_test"), allowReal = st.evs("fixture.allow_real", task).length > 0;
    // ── FLOW ── 1. session  2. prompt + fixture  3. no fixture: allow_real_subAg ? real call (--session-id) : error "FIXTURE NOT FOUND"
    // 1. SESSION: did the master pass a session id we know (the DB table fixture_sessions)? Then this call continues THAT session.
    const session = findSession(st, c, task);
    const real = async (): Promise<RunResult> => {   // the REAL sub-agent: ONE-SHOT claude call (no --session-id, nothing kept by the CLI). Its memory = the fixture_sessions history, put in the prompt.
      const over = charge(); if (over) return over;
      const hist = historyForReal(st, task, role), files = [...snap(ws).keys()].slice(0, 60);
      const prompt = hist ? `CONTEXT (kept by the test harness; you have no memory of earlier calls; the workspace run_test/ is shared and already holds these files):\n${files.map((p) => "  " + p).join("\n")}\n\nWHAT HAS HAPPENED SO FAR with this sub-agent in this task (oldest first):\n${hist}\n\nYOUR TASK NOW:\n${c.prompt}` : c.prompt;
      const r = await this.real.run({ ...c, prompt, stateless: true });
      st.tx(() => recordTurn(st, c, task, role, ws, { kind: "real", reply: r.reply }));
      log({ verdict: "real", reply: r.reply.slice(0, 2000) });
      return r;
    };
    if (session?.state === "real") return real();   // a follow-up of a session that was a real call: it is real, no fixture involved
    const followUp = !!session && session.served.length > 0;
    // 2. PROMPT + FIXTURE
    // role order (`requires_done`): the roles ALREADY served in this task. It was `done: []` before, so a rule such as "qa-reviewer needs builder done first" could never pass in this gate.
    const doneRoles = [...new Set(st.evs("fixture.call", task).map((e) => e.data as unknown as GateCall).filter((d) => d.verdict === "served" || d.verdict === "real").map((d) => d.role))];
    const rules = allRules(mockEv?.guard), why = checkHandover({ rules, agent: role, prompt: c.prompt, done: doneRoles });
    let rec = pickRecorded(mockEv?.ids ? this.results.filter((r) => mockEv.ids!.includes(r.id)) : this.results, role, c.prompt, servedInTask(st, task), true);
    // BY THE CASE, NOT BY WORDING: the case declares which recorded results it expects (mockEv.ids). When no keyword of the hand-over matches but the case expects exactly ONE not-yet-served result of this role
    // (and its `after` is served), that result is the answer: a good hand-over that does not repeat an incidental phrase of the case (eg_tw_01 needed 'phase 1 of 1') must not fail. Hand-over QUALITY stays the job
    // of the guard rules (checkHandover, `why`), which still apply. The event `fixture.by_case` makes every such serve visible in the logs.
    if (!rec && mockEv?.ids?.length && why.length === 0 && !isVerifyAsk(c.prompt)) {
      const served = servedInTask(st, task), open = this.results.filter((r) => mockEv.ids!.includes(r.id) && (!r.agent || r.agent === role) && !served.includes(r.id) && (!r.after || served.includes(r.after)));
      if (open.length === 1) { rec = open[0]; st.tx(() => st.ev("fixture.by_case", task, c.row.agent_id, { role, result: rec!.id, reason: "no keyword of the hand-over matched; the case expects exactly this one result of the role, so it was served" })); }
    }   // `after` may name a result of ANOTHER agent (stage chains): task-wide   // strict: never a result of another agent/suite
    const verify = (): RunResult => {   // a "check / what did you do" ask: answered from the session table (history + files on disk now). No new work, no model, no claude -p.
      const row = session ?? st.fixtureSessions.find((x) => x.task_id === task && x.role === role && x.served.length)!;
      const files = [...snap(ws).keys()].slice(0, 80);
      const reply = `THIS AGENT IS A RECORDED TEST FIXTURE: it cannot run new commands or change files, whatever you ask, and nothing new was run for this request. Do not ask it again: look at the files yourself and tell the person what is really there, including any difference from what they asked.\nSESSION of ${row.agent_id} (fixture, state ${row.state}, version ${row.version}; nothing new was run). History:\n${historyDigest(row)}\n\nFILES ON DISK NOW (${files.length}, shared workspace run_test/):\n${files.map((p) => "  " + p).join("\n")}`;
      st.tx(() => recordTurn(st, c, task, role, ws, { kind: "verify", result: rec?.id, reply }));
      log({ verdict: "extra", result: rec?.id });
      return ret(reply);
    };
    if (followUp && rec && servedInTask(st, task, role).includes(rec.id) && !(rec.repeatable && !isVerifyAsk(c.prompt))) return verify();   // known session, this result was already served: nothing NEW to run, add to the same session
    if (!rec && isVerifyAsk(c.prompt) && (followUp || servedInTask(st, task, role).length > 0)) return verify();   // a check ask to an agent that has history in this task (its own session or an earlier one of the same role): answered from the table (NEW work with no fixture goes on to step 3)
    if (!rec) {   // 3. NO FIXTURE for this prompt
      if (allowReal) return real();
      const reason = `FIXTURE NOT FOUND for '${role}': no recorded result matches this request (name the folder run_test/<dir> and the key words of the task exactly as the user wrote them) and the case does not set allow_real_subAg, so no real call is made`;
      st.tx(() => { recordTurn(st, c, task, role, ws, { kind: "corrected", reply: reason }); st.ev("fixture.fail", task, c.row.agent_id, { role, n, call: c.row.last_call_id ?? null, reason }); });
      log({ verdict: "notfound", why: [reason] });
      return ret(`ERROR: ${reason}. The case is marked FAILED.`, false, reason);
    }
    // a pure CHECK ask (check words, no work verb anywhere) FROM AN AGENT THAT ALREADY DID WORK (followUp) must not serve the NEXT step (the fix) just because its keywords match: it is answered from the table. A first request to a stage agent ("Review it ... report") is not affected
    if (followUp && rec.after && isVerifyAsk(c.prompt) && !/\b(fix|add|create|build|write|implement|redo|remove|install|update|change|repair|rewrite)\b/i.test(c.prompt) && servedInTask(st, task, role).length > 0) return verify();
    if (why.length) {   // a fixture exists but the hand-over is too thin
      const over = charge(); if (over) return over;   // (the lead may correct it and retry: guard rules)
      const reply = `NOT ACCEPTED (request check): ${why.join("; ")}. Send ONE complete request again.`;
      st.tx(() => recordTurn(st, c, task, role, ws, { kind: "corrected", reply }));
      log({ verdict: "corrected", why });
      return ret(reply);
    }
    const earlier = mine.find((m) => m.verdict === "served" && m.result === rec.id);
    if (earlier && !(rec.repeatable && !isVerifyAsk(c.prompt))) return verify();   // a REPEATABLE result (a generator called with other parameters) is run again unless the ask is only a check   // same result asked again from a NEW session: answered from the table too
    const over = charge(); if (over) return over;
    const before = snap(ws);
    const raw = rec.run({ agent: role, task: c.prompt, ws, root: "" });   // 4. SERVE
    if (/^\s*NEEDS_PARENT:/.test(raw)) {   // the sub-agent ASKS its parent (missing name / options): that is a question, NOT served work: the same result must be servable again once the parent answered
      st.tx(() => recordTurn(st, c, task, role, ws, { kind: "corrected", reply: raw }));
      log({ verdict: "corrected", why: [raw.slice(0, 200)] });
      return ret(raw);
    }
    const afterSnap = snap(ws), observed = observe(ws, before, afterSnap), reply = `${observeHead(before, afterSnap)}\n\n${raw}\n\n${observed}`;   // short observer line FIRST: the lead's wait() only shows the first 600 chars
    st.tx(() => recordTurn(st, c, task, role, ws, { kind: "served", result: rec.id, reply }));
    log({ verdict: "served", result: rec.id, reply: reply.slice(0, 4000), observed });
    return ret(reply);
  }
}
