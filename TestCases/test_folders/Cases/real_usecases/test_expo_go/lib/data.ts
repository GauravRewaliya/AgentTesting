// Typed AND validated access to the two JSON files of agent_fixture/store/expo_go. No casts: each file is parsed field by field when this module loads,
// so a JSON that drifted from lib/types.ts (missing field, wrong type, a value outside an enum) fails right here with the path of the bad value.
import sourcesRaw from "../../../../agent_fixture/store/expo_go/sources.json";
import phasesRaw from "../../../../agent_fixture/store/expo_go/phases.json";
import { FIXTURE_KINDS, type PhaseRow, type PhasesFile, type SourceEntry, type SourcesFile } from "./types.ts";

export const STORE = "TestCases/test_folders/agent_fixture/store/expo_go";

type Obj = Record<string, unknown>;
const fail = (where: string, what: string): never => { throw new Error(`${where}: ${what}`); };
const obj = (v: unknown, where: string): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : fail(where, "expected an object"));
const str = (o: Obj, k: string, where: string): string => (typeof o[k] === "string" ? (o[k] as string) : fail(`${where}.${k}`, `expected a string, got ${JSON.stringify(o[k])}`));
const optStr = (o: Obj, k: string, where: string): string | undefined => (o[k] === undefined ? undefined : str(o, k, where));
const num = (o: Obj, k: string, where: string): number => (typeof o[k] === "number" ? (o[k] as number) : fail(`${where}.${k}`, `expected a number, got ${JSON.stringify(o[k])}`));
const strs = (o: Obj, k: string, where: string): string[] => (Array.isArray(o[k]) && (o[k] as unknown[]).every((x) => typeof x === "string") ? (o[k] as string[]) : fail(`${where}.${k}`, "expected a string[]"));

function parseSource(v: unknown, where: string): SourceEntry {
  const o = obj(v, where), kind = str(o, "kind", where);
  if (!(FIXTURE_KINDS as readonly string[]).includes(kind)) fail(`${where}.kind`, `"${kind}" is not one of ${FIXTURE_KINDS.join(" | ")}`);
  return { ref: str(o, "ref", where), url: str(o, "url", where), repo: optStr(o, "repo", where), sha: optStr(o, "sha", where), branch: optStr(o, "branch", where), path: optStr(o, "path", where),
    kind: kind as SourceEntry["kind"], committed: optStr(o, "committed", where), fetch: o.fetch === undefined ? undefined : o.fetch === true ? true : fail(`${where}.fetch`, "expected true"),
    commit: optStr(o, "commit", where), last_change: optStr(o, "last_change", where), expo_go: str(o, "expo_go", where) };
}
function parsePhase(v: unknown, where: string): PhaseRow {
  const o = obj(v, where);
  return { n: num(o, "n", where), sha: str(o, "sha", where), from: str(o, "from", where), folded: num(o, "folded", where), snapshot: o.snapshot === undefined ? undefined : o.snapshot === true ? true : fail(`${where}.snapshot`, "expected true"),
    legacy_pins: o.legacy_pins === undefined ? undefined : strs(o, "legacy_pins", where), date: str(o, "date", where), subject: str(o, "subject", where), patch: str(o, "patch", where),
    files: strs(o, "files", where), patch_bytes: num(o, "patch_bytes", where) };
}

export const sources: SourcesFile = Object.fromEntries(Object.entries(obj(sourcesRaw, "sources.json")).filter(([k]) => k !== "_note").map(([k, v]) => [k, parseSource(v, `sources.json:${k}`)]));
export const phases: PhasesFile = Object.fromEntries(Object.entries(obj(phasesRaw, "phases.json")).map(([k, rows]) =>
  [k, (Array.isArray(rows) ? rows : fail(`phases.json:${k}`, "expected an array")).map((r, i) => parsePhase(r, `phases.json:${k}#${i + 1}`))]));
export const source = (name: string): SourceEntry => sources[name] ?? fail("sources.json", `no entry "${name}"`);
