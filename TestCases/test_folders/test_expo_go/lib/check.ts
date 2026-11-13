// Validator for the expo_go suite: run by main.ts at import (throws) and standalone: `bun TestCases/test_folders/test_expo_go/lib/check.ts`.
// It catches: a JSON that drifted from types.ts, a commit with no step (or a step with no commit), a missing patch file, an orphan patch/fixture,
// a case chain pointing at a missing/later case, unknown tags, an agent that has no folder, a prompt that leaks the commit, a skill folder that lost files.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isTag } from "../../../tags.ts";
import { phases, source, sources, STORE } from "./data.ts";
import type { Problem, SuiteSpec } from "./types.ts";
const resultId = (caseId: string) => `role-expo-go-${caseId}`;   // the recorded result that answers a case

const ROOT = resolve(import.meta.dir, "../../../..");
const STORE_DIR = join(ROOT, STORE);
const AGENTS = join(ROOT, "test_harness/core/orchistraitor/f1_multiagent/harness/agents");
const RESULTS = join(ROOT, "TestCases/test_folders/agent_fixture/results/test_expo_go");
const SHA40 = /^[0-9a-f]{40}$/;

export function check(spec: SuiteSpec): Problem[] {
  const bad: Problem[] = [], add = (where: string, what: string) => bad.push({ where, what });

  // 1. sources.json
  for (const [name, s] of Object.entries(sources)) {
    for (const k of ["ref", "url", "kind", "expo_go"] as const) if (!s[k]) add(`sources.json:${name}`, `missing "${k}"`);
    if (s.sha && !SHA40.test(s.sha)) add(`sources.json:${name}`, `sha is not 40 hex chars: ${s.sha}`);
    if (s.committed) { if (!existsSync(join(STORE_DIR, s.committed))) add(`sources.json:${name}`, `committed folder missing: ${s.committed}`); }
    else if (!s.repo || !s.sha) add(`sources.json:${name}`, "not committed, so it needs repo + sha for fetch.sh");
  }

  // 2. phases.json: shape, order, patch files
  const patchFiles = new Set<string>();
  for (const [name, rows] of Object.entries(phases)) {
    if (!sources[name]) add(`phases.json:${name}`, "no entry with this name in sources.json");
    rows.forEach((r, i) => {
      const w = `phases.json:${name}#${i + 1}`;
      if (r.n !== i + 1) add(w, `n is ${r.n}, expected ${i + 1}`);
      if (!SHA40.test(r.sha)) add(w, "sha is not 40 hex chars");
      if (!SHA40.test(r.from)) add(w, "from is not 40 hex chars");
      if (r.snapshot && rows.length !== 1) add(w, "a snapshot project has exactly one phase");
      if (i > 0 && r.from !== rows[i - 1].sha) add(w, "from must be the sha of the previous phase (the chain would not apply)");
      if (!r.subject) add(w, "empty subject");
      if (!existsSync(join(STORE_DIR, r.patch))) add(w, `patch file missing: ${r.patch}`); else patchFiles.add(r.patch);
      if (!r.patch.includes(r.sha.slice(0, 7))) add(w, `patch name does not carry the sha: ${r.patch}`);
    });
  }
  const pdir = join(STORE_DIR, "patches");
  if (existsSync(pdir)) for (const d of readdirSync(pdir)) for (const f of readdirSync(join(pdir, d))) if (!patchFiles.has(`patches/${d}/${f}`)) add(`patches/${d}/${f}`, "orphan patch: not listed in phases.json");

  // 3. history vs results: every phases.json project has exactly one recorded result per commit (the results are plain files, see agent_fixture/results/test_expo_go)
  const resultText = existsSync(RESULTS) ? readdirSync(RESULTS).filter((x) => x.endsWith(".ts")).map((f) => readFileSync(join(RESULTS, f), "utf8")) : [];
  for (const [name, rows] of Object.entries(phases)) {
    const n = resultText.filter((t) => t.includes(`"name":"${name}","n":`)).length;
    if (n < rows.length) add(`phases.json:${name}`, `${rows.length} commits but only ${n} recorded results apply them`);
  }
  for (const name of Object.keys(sources)) if (!spec.otherSources.includes(name) && !resultText.some((t) => t.includes(`"name":"${name}"`) || t.includes(`name: "${name}"`))) add(`sources.json:${name}`, "unused: no recorded result refers to it");

  // 4. cases
  const seen = new Map<string, number>();
  spec.cases.forEach((c, i) => {
    const w = `case ${c.id}`;
    if (seen.has(c.id)) add(w, `duplicate id (also #${seen.get(c.id)})`); seen.set(c.id, i);
    if (!/^eg_[a-z0-9]+_/.test(c.id)) add(w, "id must start with eg_<key>_");
    if (c.after && !(seen.get(c.after) !== undefined && seen.get(c.after)! < i)) add(w, `after "${c.after}" is missing or comes later`);
    if (!c.title.startsWith("[ref ")) add(w, 'title must start with "[ref <source>]"');
    for (const t of c.tags ?? []) if (!isTag(t)) add(w, `unknown tag ${t}`);
    for (const a of c.agents) if (!existsSync(join(AGENTS, a, "agent.json"))) add(w, `agent "${a}" has no folder in harness/agents`);
    c.turns.forEach((t, j) => {
      if (!t.user.trim() || !t.expected.context.trim()) add(w, `turn ${j + 1}: empty user/expected.context`);
      const want = resultId(c.id), got = JSON.stringify(t.expected.expected_agents_res);
      if (got !== JSON.stringify([want]) && got !== JSON.stringify([want, `${want}_fix`])) add(w, `turn ${j + 1}: expected_agents_res must be ["${want}"] (rework cases: plus "${want}_fix"), is ${got}`);
      if (JSON.stringify(t.allowed) !== JSON.stringify(["expo-go"])) add(w, `turn ${j + 1}: allowed must be ["expo-go"] (the guard stops any other call)`);
    });
    if (c.guard !== "expo_go_rules.json" || !existsSync(join(STORE_DIR, "..", "expo_go_rules.json"))) add(w, "guard must be expo_go_rules.json and exist in agent_fixture/store");
    if (!c.agents.includes("expo-go")) add(w, 'agents must contain "expo-go"');
    if (!Number.isInteger(c.max_agent_calls) || (c.max_agent_calls ?? 0) < 1) add(w, "must declare max_agent_calls (integer >= 1): how many calls to the fixture agent are accepted before the case fails");
  });

  // 4b. recorded results: one per case, same id, and the lookup must pick EXACTLY it for the ideal hand-over (the user text + its run_test folder)
  const kwOf = new Map<string, string[]>(), afterOf = new Map<string, string>();
  for (const f of existsSync(RESULTS) ? readdirSync(RESULTS).filter((x) => x.startsWith("role-expo-go-") && x.endsWith(".ts")) : []) {
    const txt = readFileSync(join(RESULTS, f), "utf8"), id = txt.match(/id: "([^"]+)"/)?.[1] ?? "", kw = txt.match(/keywords: (\[[^\]]*\])/)?.[1];
    if (id !== f.slice(0, -3)) add(`results/${f}`, `id "${id}" does not match the file name`);
    if (!kw) add(`results/${f}`, "no match.keywords"); else kwOf.set(id, JSON.parse(kw));
    const aft = txt.match(/after: "([^"]+)"/)?.[1]; if (aft) afterOf.set(id, aft);
  }
  for (const c of spec.cases) {
    const rid = resultId(c.id), kw = kwOf.get(rid);
    if (!kw) { add(`case ${c.id}`, `no recorded result ${rid} in agent_fixture/results (run build_results.ts)`); continue; }
    const user = c.turns[0].user, dir = user.match(/run_test\/([\w-]+)/)?.[1] ?? "", ideal = (`run_test/${dir} ` + user).toLowerCase();
    // what was already served when this case runs = the results of its ancestors (`after` chain); a result with `match.after` is eligible once that result was served; a served one never competes with the next step (pickRecorded prefers unserved)
    const served = new Set<string>(); for (let p = c.after ? spec.cases.find((x) => x.id === c.after) : undefined; p; p = p.after ? spec.cases.find((x) => x.id === p!.after) : undefined) served.add(resultId(p.id));
    const hits = [...kwOf].filter(([id, k]) => !served.has(id) && (!afterOf.has(id) || served.has(afterOf.get(id)!)) && k.every((w) => ideal.includes(w.toLowerCase()))).map(([id]) => id);
    if (hits.length !== 1 || hits[0] !== rid) add(`case ${c.id}`, `an ideal hand-over matches ${JSON.stringify(hits)} instead of only ["${rid}"]: keywords ${JSON.stringify(kw)} are ambiguous or too strict`);
  }
  for (const id of kwOf.keys()) {
    if (spec.cases.some((c) => resultId(c.id) === id)) continue;
    const neg = id.endsWith("_fix") ? id.slice(0, -4) : "";   // a rework case's positive result: `match.after` = the negative result
    if (neg && spec.cases.some((c) => resultId(c.id) === neg && c.turns[0].expected.expected_agents_res.includes(id))) {
      if (afterOf.get(id) !== neg) add(`results/${id}.ts`, `the fix result must declare match.after = "${neg}" (it is only served once the incomplete answer was served)`);
    } else add(`results/${id}.ts`, "orphan: no case expects it");
  }

  for (const t of spec.tags) if (!isTag(t)) add("suite tags", `unknown tag ${t}`);

  // 5. the agent and its skills
  const sk = join(AGENTS, "expo-go/.claude/skills");
  const skills = existsSync(sk) ? readdirSync(sk).filter((d) => existsSync(join(sk, d, "SKILL.md"))) : [];
  if (skills.length < 12) add("agents/expo-go/.claude/skills", `expected the 12 expo-* skills, found ${skills.length}`);
  for (const need of ["expo-router", "expo-animation", "expo-native-ui", "expo-design-system"]) if (!skills.includes(need)) add("agents/expo-go/.claude/skills", `skill missing: ${need}`);
  if (!existsSync(join(AGENTS, "expo-go/agent.json"))) add("agents/expo-go", "agent.json missing");
  try { source("folio-popup-book"); } catch (e) { add("sources.json", String(e)); }
  return bad;
}

export function assertValid(spec: SuiteSpec): void {
  const bad = check(spec);
  if (bad.length) throw new Error(`expo_go suite is invalid (${bad.length}):\n` + bad.map((p) => `  - ${p.where}: ${p.what}`).join("\n"));
}

if (import.meta.main) {
  const m = await import("../main.ts");   // importing main.ts already throws on a problem
  console.log(`ok: ${m.cases.length} cases, ${Object.keys(phases).length} phases.json projects`);
}
