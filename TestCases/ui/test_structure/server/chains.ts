// Turns the model into flow data: one CaseOut per case, and the cards (linear chains / standalone groups).
// A card is a linear run of cases (each `after` the one before). Where a case has 2+ children each child starts a new
// card (a branch). Cases with no `after` and no children are collected per suite into one standalone card.
import type { CardOut, CaseOut } from "../shared/types.ts";
import type { Model } from "./model.ts";

export function caseOut(m: Model, id: string): CaseOut {
  const { raw: c, suite, tags } = m.cases.get(id)!;
  const last = m.last.get(id), ck = m.ckpt.get(id), parent = c.after ? m.ckpt.get(c.after) : undefined;
  const turns = c.turns.map((t, i) => ({ user: t.user, expectedAgents: t.expected.expected_agents_res, actualAgents: last?.turns[i]?.actual ?? [], match: last?.turns[i]?.match, notfound: last?.turns[i]?.notfound, guard: last?.turns[i]?.guard }));
  const status = !last ? "never_run" : last.status === "skipped" || last.verdict === "skipped" ? "skipped" : last.verdict ? last.verdict : turns.every((t) => t.match !== false && !t.guard) ? "pass" : "fail";
  return {
    profile: m.profile(id), caseId: id, suite, title: c.title, after: c.after, tags: [...tags, ...(c.tags ?? [])], status, ran: !!last, at: last?.at, sessionId: ck?.sessionId,
    relation: !c.after ? "root" : parent?.sessionId && ck?.sessionId === parent.sessionId ? "same_session" : "cloned",
    subSessions: m.sessionsOf(id).map(([label, sid]) => ({ label, id: sid, fixture: m.servedBy.get(sid) ?? null, inherited: m.owner.get(sid) !== id, ownerCase: m.owner.get(sid) ?? id })),
    turns,
  };
}

export function buildCards(m: Model): CardOut[] {
  const cards: CardOut[] = [];
  const walk = (startId: string, parentCard?: string, branchedAt?: string) => {
    const cases: CaseOut[] = []; let cur: string | undefined = startId, split: string[] = [];
    while (cur) {
      cases.push(caseOut(m, cur));
      const k: string[] = m.children.get(cur) ?? [];
      if (k.length === 1) cur = k[0]; else { split = k; cur = undefined; }
    }
    const id = `card:${startId}`;
    cards.push({ id, title: `${m.cases.get(startId)!.suite} · ${startId}`, suite: m.cases.get(startId)!.suite, kind: "chain", cases, parentCard, branchedAt });
    for (const k of split) walk(k, id, cases[cases.length - 1]!.caseId);
  };
  const solo = new Map<string, CaseOut[]>();
  for (const [id, c] of m.cases) {
    if (c.raw.after && m.cases.has(c.raw.after)) continue; // reached from its parent
    if (m.children.has(id)) walk(id);
    else solo.set(c.suite, [...(solo.get(c.suite) ?? []), caseOut(m, id)]);
  }
  for (const [suite, cases] of solo) cards.push({ id: `card:solo:${suite}`, title: `${suite} · standalone`, suite, kind: "standalone", cases });
  return cards;
}
