// Sub-agent index + positive/negative cases, executed on the REAL pieces:
//   lookup  = Harness.spawn (the same fixture lookup the mod uses: keywords, then similarity >= HIT_MIN)
//   guard   = checkHandover (the role-order rules from agent_fixture/store/*_rules.json)
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkHandover, type Rule } from "@test_harness/core/orchistraitor/harness_own_custom/core/guard.ts";
import { Harness, loadResults } from "@test_harness/core/orchistraitor/harness_own_custom/main.ts";
import { agentDefs, fixtureIndex, guardRules, ROOT } from "./data.ts";
import { FIXTURES } from "@core/paths.ts";
import type { CaseResult } from "../shared/types.ts";
export type { CaseResult };

// ASSUMPTION: the category is not stored anywhere in the harness; this map is the one place to change it.
const CATEGORY: Record<string, string> = {
  researcher: "research_agent", "package-researcher": "research_agent",
  builder: "builder", writer: "builder",
  planner: "planning", "ux-designer": "UX",
  reviewer: "summary_agent", "qa-reviewer": "summary_agent",
  poet: "distractor",
};
const categoryOf = (agent?: string) => (agent && CATEGORY[agent]) || "uncategorised";


const results = (() => { let p: ReturnType<typeof loadResults> | undefined; return () => (p ??= loadResults(join(FIXTURES, "results"))); })();

/** Real lookup: a fresh Harness in a temp workspace; returns the reply, the fixture id and the files run() wrote. */
export async function lookup(agent: string, query: string) {
  const ws = mkdtempSync(join(tmpdir(), "ta3-web-"));
  try {
    const h = new Harness({ fixtures: [], results: await results(), root: ROOT, ws });
    const r = h.spawn(agent, query);
    const files = readdirSync(ws, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name).slice(ws.length + 1));
    return { reply: r.reply, fixture: r.fixture ?? null, found: !r.reply.startsWith("NOTFOUND"), files };
  } finally { rmSync(ws, { recursive: true, force: true }); }
}

export async function listAgents() {
  const defs = await agentDefs(), idx = fixtureIndex(), rules = guardRules();
  return defs.map((d) => ({
    ...d, category: categoryOf(d.name),
    responses: idx.filter((r) => r.agent === d.name).length,
    guard: Object.entries(rules).filter(([, r]) => r[d.name]).map(([file, r]) => ({ file, rule: r[d.name]! })),
  }));
}

/** The index: every recorded response (sub_agent_response id, category, query, setup). Responses with no agent apply to any. */
export function listResponses() {
  return fixtureIndex().map((r) => ({ id: r.id, agent: r.agent ?? null, category: categoryOf(r.agent), query: r.text, title: r.title, setup: { keywords: r.keywords ?? [], matchBy: r.keywords?.length ? "keywords (all must appear)" : "similarity >= 0.15", copies: r.copies ?? [], file: r.file } }));
}

/** Positive + negative cases for one recorded response, run now. */
export async function casesForResponse(id: string): Promise<CaseResult[]> {
  const r = fixtureIndex().find((x) => x.id === id);
  if (!r) return [];
  const agent = r.agent ?? "researcher";
  const out: CaseResult[] = [];
  const add = (c: Omit<CaseResult, "id">) => out.push({ id: `${id}:${out.length + 1}`, ...c });
  // + : the recorded question must be answered by THIS response
  const pos = await lookup(agent, r.text);
  add({ kind: "positive", layer: "lookup", name: "recorded question is served by this response", query: r.text, expect: `fixture ${id}`, actual: pos.fixture ?? "NOTFOUND", pass: pos.fixture === id, fixture: pos.fixture, files: pos.files });
  // + : keywords alone (what a lead hand-over would contain at minimum)
  if (r.keywords?.length) {
    const q = `Please handle this: ${r.keywords.join(" ")}`;
    const k = await lookup(agent, q);
    add({ kind: "positive", layer: "lookup", name: "all keywords present -> served", query: q, expect: `fixture ${id}`, actual: k.fixture ?? "NOTFOUND", pass: k.fixture === id, fixture: k.fixture });
    // - : one keyword missing must not be served by this response
    for (const miss of r.keywords) {
      const q2 = `Please handle this: ${r.keywords.filter((x) => x !== miss).join(" ") || "something unrelated"}`;
      const m = await lookup(agent, q2);
      add({ kind: "negative", layer: "lookup", name: `keyword '${miss}' missing -> not served by this response`, query: q2, expect: `not ${id}`, actual: m.fixture ?? "NOTFOUND", pass: m.fixture !== id, fixture: m.fixture });
    }
  }
  // - : too short / off-topic
  for (const [name, q] of [["off-topic text -> NOTFOUND", "What is the weather like on Mars in winter?"], ["tiny query -> NOTFOUND", "hi"]] as const) {
    const m = await lookup(agent, q);
    add({ kind: "negative", layer: "lookup", name, query: q, expect: "NOTFOUND", actual: m.fixture ?? "NOTFOUND", pass: !m.found, fixture: m.fixture });
  }
  // - : the same question sent to a different agent type must not reach this response
  if (r.agent) {
    const other = (await agentDefs()).find((d) => d.name !== r.agent && !d.forbidden)?.name;
    if (other) { const m = await lookup(other, r.text); add({ kind: "negative", layer: "lookup", name: `same question sent to '${other}' -> not served by this response`, query: r.text, expect: `not ${id}`, actual: m.fixture ?? "NOTFOUND", pass: m.fixture !== id, fixture: m.fixture }); }
  }
  return out;
}

/** Guard cases for an agent: from its real rules, one positive and one negative per rule. */
export async function guardCases(agent: string): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  const defs = (await agentDefs()).find((d) => d.name === agent);
  const add = (c: Omit<CaseResult, "id">) => out.push({ id: `${agent}:g${out.length + 1}`, ...c });
  if (defs?.forbidden) {
    const why = checkHandover({ rules: { [agent]: { forbidden: true } }, agent, prompt: "write a poem", done: [] });
    add({ kind: "negative", layer: "forbidden", name: "a distractor must not be called", query: "write a poem", expect: "rejected", actual: why.length ? `rejected: ${why[0]}` : "accepted", pass: why.length > 0 });
  }
  for (const [file, rules] of Object.entries(guardRules())) {
    const r: Rule | undefined = rules[agent]; if (!r) continue;
    if (r.forbidden) { const w = checkHandover({ rules, agent, prompt: "any hand-over", done: [] }); add({ kind: "negative", layer: "forbidden", name: `${file}: marked forbidden -> rejected`, query: "any hand-over", expect: "rejected", actual: w.length ? "rejected" : "accepted", pass: w.length > 0 }); continue; }
    const good = [...(r.contains_all ?? [])].join(" ").padEnd(r.min_chars ?? 0, " .");
    const ok = checkHandover({ rules, agent, prompt: good, done: r.requires_done ?? [] });
    add({ kind: "positive", layer: "guard", name: `${file}: complete hand-over passes`, query: good, expect: "accepted", actual: ok.length ? `rejected: ${ok.join("; ")}` : "accepted", pass: ok.length === 0 });
    for (const k of r.contains_all ?? []) {
      const q = good.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "").padEnd(r.min_chars ?? 0, " .");
      const w = checkHandover({ rules, agent, prompt: q, done: r.requires_done ?? [] });
      add({ kind: "negative", layer: "guard", name: `${file}: hand-over lacks '${k}' -> rejected`, query: q, expect: "rejected", actual: w.length ? `rejected: ${w[0]}` : "accepted", pass: w.length > 0 });
    }
    if (r.min_chars) { const w = checkHandover({ rules, agent, prompt: "short", done: r.requires_done ?? [] }); add({ kind: "negative", layer: "guard", name: `${file}: too thin -> rejected`, query: "short", expect: "rejected", actual: w.length ? "rejected" : "accepted", pass: w.length > 0 }); }
    for (const d of r.requires_done ?? []) { const w = checkHandover({ rules, agent, prompt: good, done: (r.requires_done ?? []).filter((x) => x !== d) }); add({ kind: "negative", layer: "guard", name: `${file}: '${d}' not done yet -> rejected`, query: good, expect: "rejected", actual: w.length ? "rejected" : "accepted", pass: w.length > 0 }); }
  }
  return out;
}

/** Free-form try: guard first (with the rules the caller picks), then the real lookup. */
export async function tryCall(agent: string, query: string, done: string[]) {
  const defs = (await agentDefs()).find((d) => d.name === agent);
  const rules = guardRules();
  const rejections: string[] = [];
  if (defs?.forbidden) rejections.push(`'${agent}' is a distractor`);
  for (const [file, rs] of Object.entries(rules)) if (rs[agent]) rejections.push(...checkHandover({ rules: rs, agent, prompt: query, done }).map((w) => `${file}: ${w}`));
  if (rejections.length) return { accepted: false, rejections };
  return { accepted: true, rejections, ...(await lookup(agent, query)) };
}

/** Pass/total of every recorded response and every agent's guard cases: "is the index working?" in one call. */
export async function health() {
  const responses: Record<string, { pass: number; total: number; failing: string[] }> = {};
  for (const r of fixtureIndex()) { const c = await casesForResponse(r.id); responses[r.id] = { pass: c.filter((x) => x.pass).length, total: c.length, failing: c.filter((x) => !x.pass).map((x) => x.name) }; }
  const agents: Record<string, { pass: number; total: number; failing: string[] }> = {};
  for (const d of await agentDefs()) { const c = await guardCases(d.name); agents[d.name] = { pass: c.filter((x) => x.pass).length, total: c.length, failing: c.filter((x) => !x.pass).map((x) => x.name) }; }
  return { responses, agents };
}
