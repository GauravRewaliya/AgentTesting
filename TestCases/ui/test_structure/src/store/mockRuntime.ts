// The sub-agent mock, as plain functions so the panel and the tests share them.
// checkBeforeRun(query) runs first; only when it passes does run() pick a fixture and answer.
import type { BeforeRunRule, CheckResult, SubAgentMock, TryRunResult } from "@/types";

export function checkBeforeRun(rules: BeforeRunRule[], query: string): CheckResult {
  const q = query.toLowerCase();
  const failures = rules
    .filter((r) => {
      switch (r.kind) {
        case "must_contain":
          return !q.includes(String(r.value).toLowerCase());
        case "must_not_contain":
          return q.includes(String(r.value).toLowerCase());
        case "min_chars":
          return query.trim().length < Number(r.value);
        case "max_chars":
          return query.length > Number(r.value);
      }
    })
    .map((r) => ({ ruleId: r.id, message: r.message }));
  return { ok: failures.length === 0, failures };
}

/** Same rule as the real harness: a fixture matches when ALL its keywords appear in the task. */
export function run(mock: SubAgentMock, query: string): { fixtureId?: string; reply: string } {
  const q = query.toLowerCase();
  const hit = mock.fixtures.find((f) => f.keywords.every((k) => q.includes(k.toLowerCase())));
  return hit ? { fixtureId: hit.id, reply: hit.reply } : { reply: "NOTFOUND: no recorded result matches this task" };
}

export function tryCall(mock: SubAgentMock, query: string): TryRunResult {
  if (mock.forbidden) {
    return {
      accepted: false,
      check: { ok: false, failures: [{ ruleId: "forbidden", message: `${mock.id} is a distractor: it must not be called` }] },
      reply: `GUARD: ${mock.id} is forbidden. Something went wrong.`,
    };
  }
  const check = checkBeforeRun(mock.beforeRun, query);
  if (!check.ok) return { accepted: false, check, reply: `${mock.id} rejected the call before run(): ${check.failures.map((f) => f.message).join("; ")}` };
  return { accepted: true, check, ...run(mock, query) };
}
