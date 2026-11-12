// The ONE place that maps the raw files into relations. Everything else (cards, usage, case detail, checks) reads this.
//   case --after--> case              (test_case/*/main.ts)
//   case --creates--> sub-session     (a session belongs to the case whose PARENT checkpoint does not already have it,
//                                      because ckpt.json carries the ancestors' ids forward)
//   sub-session --answered by--> fixture   (.state session agents carry the fixture that answered them)
//   case --expects--> fixture         (turns[].expected.expected_agents_res; "session:x#n" entries are follow-ups, not fixtures)
//   fixture --copies--> store path    (TestCases/test_folders/agent_fixture/index.json)
import { fixtureIndex, fixtureOf, loadSuites, readCkpt, readLast, type RawCase } from "./data.ts";
import type { CaseProfile, Usage } from "../shared/types.ts";

export type Model = Awaited<ReturnType<typeof buildModel>>;

export async function buildModel() {
  const suites = await loadSuites();
  const cases = new Map<string, { raw: RawCase; suite: string; tags: string[] }>();
  for (const s of suites) for (const c of s.cases) cases.set(c.id, { raw: c, suite: s.suite, tags: s.tags });

  const ckpt = new Map([...cases.keys()].map((id) => [id, readCkpt(id)]));
  const last = new Map([...cases.keys()].map((id) => [id, readLast(id)]));
  const sessionsOf = (id: string) => Object.entries(ckpt.get(id)?.ids ?? {}); // [label, sessionId]
  const has = (id: string | undefined, sid: string) => !!id && sessionsOf(id).some(([, x]) => x === sid);

  const owner = new Map<string, string>(); // sub-session id -> creator case
  for (const [id, c] of cases) for (const [, sid] of sessionsOf(id)) if (!has(c.raw.after, sid)) owner.set(sid, id);

  const servedBy = new Map<string, string>(); // sub-session id -> fixture that answered its spawn
  for (const id of cases.keys()) for (const [sid, fxid] of Object.entries(fixtureOf(id))) if (!servedBy.has(sid)) servedBy.set(sid, fxid);   // agent rows in .state carry the fixture that answered them
  const fixtures = fixtureIndex();
  const children = new Map<string, string[]>(); // case -> cases that continue it
  for (const [id, c] of cases) if (c.raw.after && cases.has(c.raw.after)) children.set(c.raw.after, [...(children.get(c.raw.after) ?? []), id]);

  /** Everything that depends on one fixture, for cleanup. */
  const usage = (fixtureId: string): Usage | undefined => {
    const f = fixtures.find((x) => x.id === fixtureId);
    if (!f) return undefined;
    const expectedBy = [...cases].flatMap(([id, c]) => c.raw.turns.flatMap((t, i) => (t.expected.expected_agents_res.includes(f.id) ? [{ caseId: id, suite: c.suite, turn: i + 1 }] : [])));
    const times = new Map<string, number>();
    for (const [sid, fx] of servedBy) if (fx === f.id && owner.has(sid)) times.set(owner.get(sid)!, (times.get(owner.get(sid)!) ?? 0) + 1);
    const servedIn = [...times].map(([caseId, n]) => ({ caseId, times: n }));
    const sharedStore = (f.copies ?? []).map((store) => ({ store, with: fixtures.filter((o) => o.id !== f.id && o.copies?.includes(store)).map((o) => o.id) })).filter((x) => x.with.length);
    const agentCases = f.agent ? [...cases].filter(([, c]) => [...c.raw.agents, ...(c.raw.distractors ?? [])].includes(f.agent!)).map(([id]) => id) : [];
    return { expectedBy, servedIn, sharedStore, agentCases, orphan: !expectedBy.length && !servedIn.length };
  };

  const agentOfFixture = new Map(fixtures.map((f) => [f.id, f.agent]));
  /** See CaseProfile in shared/types.ts. `session:writer#1` = follow-up to the existing writer session; any other id = a recorded result = a new sub-agent session. */
  const profile = (id: string): CaseProfile => {
    const c = cases.get(id)!.raw, expected = c.turns.flatMap((t) => t.expected.expected_agents_res);
    const followUps = expected.filter((e) => e.startsWith("session:")), spawns = expected.length - followUps.length;
    const subAgents = [...new Set(expected.map((e) => (e.startsWith("session:") ? e.slice(8).split("#")[0]! : agentOfFixture.get(e) ?? "?")))];
    const multi = c.router !== false && expected.length > 0;
    const multiPrompt = c.turns.length > 1, multiSession = !!c.after || followUps.length > 0 || spawns > 1;
    const kind = multi ? "multi_agent" : multiSession ? "solo_multi_session" : multiPrompt ? "solo_multi_prompt" : "solo_master";
    return { agentMode: multi ? "multi" : "solo", noDelegate: c.router !== false && expected.length === 0, multiPrompt, multiSession, subAgents, kind };
  };

  return { suites, cases, profile, ckpt, last, sessionsOf, owner, servedBy, fixtures, children, usage };
}
