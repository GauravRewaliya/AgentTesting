// The shape of the route tables (index.ts files) under Cases/. Types and one helper; the data lives in the index files.
//
//   Cases/index.ts                 root: its own suites + `mount` of the group indexes below (like routers mounted on a router)
//   Cases/core_testing/index.ts    group: its suites
//   Cases/real_usecases/index.ts   group: its suites
//   Cases/subagents/index.ts       group: its suites
//
// Each suite route says WHAT the suite is for (`about`), WHICH case ids belong to it (`ids`, prefixes) and WHERE its cases are (`main`).
// Reading the index files is enough to know what is tested where. `validate_cases.ts` keeps them equal to the folders on disk.
import { join } from "node:path";

export interface SuiteRoute {
  /** the suite name = its folder name (CLI: `bun testrun/run.ts <name>`; fixtures: `agent_fixture/results/<name>/`). Unique across all groups. */
  name: string;
  /** one line: what this suite is for */
  about: string;
  /** the case ids of this suite start with one of these prefixes (checked) */
  ids: string[];
  /** the file with `export const cases`, relative to the folder of the index that lists it */
  main: string;
}
export interface GroupRoute {
  /** the folder name under Cases/ (the root uses "cases") */
  id: string;
  title: string;
  about: string;
  suites: SuiteRoute[];
  /** other group indexes mounted here (their folder is `<this folder>/<id>`) */
  mount?: GroupRoute[];
}
export interface FlatSuite extends SuiteRoute { /** "cases" for the root, else the group folder ("core_testing"; nested: "a/b") */ group: string; /** the suite's folder */ dir: string; /** absolute path of main */ file: string }

/** Walk the route tree: every suite with its group label and absolute paths. `dir` = the folder of `g`'s index.ts. */
export const flatten = (g: GroupRoute, dir: string, label = g.id, top = true): FlatSuite[] => [
  ...g.suites.map((s) => { const file = join(dir, s.main); return { ...s, group: label, dir: join(file, ".."), file }; }),
  ...(g.mount ?? []).flatMap((m) => flatten(m, join(dir, m.id), top ? m.id : `${label}/${m.id}`, false)),
];
