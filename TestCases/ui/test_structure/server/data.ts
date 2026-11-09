// Reads the REAL Test_agent_3 files. Nothing is copied or cached on disk; every call reads what is there now.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { CASES, FIXTURES, HELPER_AGENTS, ROOT, STATE } from "@core/paths.ts";
export { ROOT };
const json = <T>(p: string): T | undefined => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : undefined);
const lines = (p: string) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

export type RawCase = { id: string; title: string; after?: string; agents: string[]; distractors?: string[]; tags?: string[]; guard?: string; router?: boolean; turns: { user: string; expected: { context: string; expected_agents_res: string[] } }[] };
type Last = { at: string; status: string; warnings?: string[]; turns: { actual: string[]; expected: string[]; match: boolean; guard: boolean; notfound: boolean; calls: number; cost: number; reply?: string }[] };
type Ckpt = { sessionId: string; ids: Record<string, string> };

export async function loadSuites() {
  const out: { suite: string; tags: string[]; cases: RawCase[] }[] = [];
  for (const d of readdirSync(CASES, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const f = join(CASES, d.name, "main.ts");
    if (!existsSync(f)) continue;
    const m = await import(pathToFileURL(f).href + `?m=${statSync(f).mtimeMs}`); // re-imported only when the file changes
    out.push({ suite: d.name, tags: m.tags ?? [], cases: m.cases });
  }
  return out;
}

export const readLast = (id: string) => json<Last & { title: string }>(join(STATE, "last", `${id}.json`));
export const readCkpt = (id: string) => json<Ckpt>(join(STATE, id, "ckpt.json"));
export const wsDir = (id: string) => join(STATE, id, "ws");
export const harnessEvents = () => lines(join(STATE, "harness.jsonl")) as { t: number; kind: string; id?: string; agent?: string; text?: string; fixture?: string | null }[];

export const agentDefs = async () => {
  const dir = HELPER_AGENTS;
  const out: { name: string; description: string; role: string; forbidden: boolean }[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
    const m = (await import(pathToFileURL(join(dir, f)).href)).default;
    out.push({ name: m.name, description: m.description, role: m.role, forbidden: !!m.forbidden });
  }
  return out;
};
export const fixtureIndex = () => json<{ id: string; file: string; title: string; agent?: string; keywords?: string[]; text: string; copies?: string[] }[]>(join(FIXTURES, "index.json")) ?? [];
export const guardRules = () => {
  const dir = join(FIXTURES, "store");
  const out: Record<string, Record<string, import("@test_harness/core/orchistraitor/harness_own_custom/core/guard.ts").Rule>> = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith("_rules.json"))) out[f] = json(join(dir, f))!;
  return out;
};
