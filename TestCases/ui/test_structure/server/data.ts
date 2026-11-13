// Reads the REAL Test_agent_3 files. Nothing is copied or cached on disk; every call reads what is there now.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { CASES, FIXTURES, HELPER_AGENTS, ROOT } from "@core/paths.ts";
import { normalizeBranches } from "../../../branch.ts";
import { f1, f1WsDir } from "./experiment.ts";
export { ROOT };
const json = <T>(p: string): T | undefined => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : undefined);

export type RawCase = { allow_real_subAg?: boolean; id: string; title: string; after?: string; branch_from?: string; branch_auto?: boolean; agents: string[]; distractors?: string[]; tags?: string[]; guard?: string; router?: boolean; turns: { user: string; expected: { context: string; expected_agents_res: string[] } }[] };
type Last = { at: string; status: string; warnings?: string[]; turns: { actual: string[]; expected: string[]; match: boolean; guard: boolean; notfound: boolean; calls: number; cost: number; reply?: string }[] };
type Ckpt = { sessionId: string; ids: Record<string, string> };

export async function loadSuites() {
  const out: { suite: string; tags: string[]; cases: RawCase[] }[] = [];
  for (const d of readdirSync(CASES, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const f = join(CASES, d.name, "main.ts");
    if (!existsSync(f)) continue;
    const m = await import(pathToFileURL(f).href + `?m=${statSync(f).mtimeMs}`); // re-imported only when the file changes
    out.push({ suite: d.name, tags: m.tags ?? [], cases: m.cases as RawCase[] });
  }
  const flat = normalizeBranches(out.flatMap((s) => s.cases.map((c) => ({ ...c, suite: s.suite }))));   // across ALL suites: a parent's children may live in different suites
  for (const s of out) s.cases = flat.filter((c) => c.suite === s.suite).map(({ suite: _s, ...c }) => c) as RawCase[];
  return out;
}

// Everything the pages read about a run is what the f1 runner (testrun/run.ts: CLI, Experiment page and Flow page all use it) wrote: f1_exp/<case>.json + .state/<v>/<home>/store. See server/experiment.ts (refreshF1).
// The snapshot is refreshed by buildModel() at the start of every request that needs it.
export const readLast = (id: string): (Last & { title: string; verdict?: "pass" | "fail" | "skipped" }) | undefined => f1().last.get(id);
export const readCkpt = (id: string): Ckpt | undefined => f1().ckpt.get(id);
export const fixtureOf = (id: string) => f1().fixtureOf.get(id) ?? {};   // sub-session id -> result that answered it
export const caseEvents = (id: string) => f1().events.get(id) ?? [];
/** the files the agents left after this case: .state/<v>/<home>/workspace */
export const wsDir = (id: string) => f1WsDir(id);

export const agentDefs = async () => {
  const dir = HELPER_AGENTS;
  const out: { name: string; description: string; role: string; forbidden: boolean }[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
    const m = (await import(pathToFileURL(join(dir, f)).href)).default;
    out.push({ name: m.name, description: m.description, role: m.role, forbidden: !!m.forbidden });
  }
  return out;
};
export const fixtureIndex = () => json<{ id: string; suite: string; file: string; title: string; agent?: string; keywords?: string[]; text: string; copies?: string[] }[]>(join(FIXTURES, "index.json")) ?? [];
export const guardRules = () => {
  const dir = join(FIXTURES, "store");
  const out: Record<string, Record<string, import("@test_harness/core/orchistraitor/harness_own_custom/core/guard.ts").Rule>> = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith("_rules.json"))) out[f] = json(join(dir, f))!;
  return out;
};
