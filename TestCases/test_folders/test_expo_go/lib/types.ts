// Every structure of the expo_go suite is declared HERE. Nothing else in this folder (and no JSON in TestCases/test_folders/agent_fixture/store/expo_go) may use an undeclared shape.
// `check.ts` (run at import of main.ts) fails loudly when a file does not follow these types or was forgotten after a change.
import type { TestTag } from "../../../tags.ts";
import type { Case } from "@core/types.ts";

/* ───────────── TestCases/test_folders/agent_fixture/store/expo_go/sources.json ───────────── */

/** example = copy of a folder of expo/examples; demo = a repo behind an expo.dev demo or a github demo; demo-collection/demo-phased = a repo with many demos. */
export const FIXTURE_KINDS = ["example", "demo", "demo+commit", "demo-collection", "demo-phased"] as const;
export type FixtureKind = (typeof FIXTURE_KINDS)[number];

/** One entry of sources.json: where a fixture comes from and what fetch.sh must do. */
export interface SourceEntry {
  /** Human reference shown at the top of cases, e.g. "expo/examples" or "expo.dev/demos/paul-nguyen". */
  ref: string;
  /** Link a person can open. */
  url: string;
  /** Git remote fetch.sh clones from (not set for fixtures that exist only as a committed copy). */
  repo?: string;
  /** Pinned commit of the FINAL state (fetch.sh without a phase number). */
  sha?: string;
  /** Solarin only (first version of the file): base/target of the single commit. */
  base_sha?: string;
  target_sha?: string;
  branch?: string;
  /** Folder inside the repo (examples: "with-typescript", enzo: "src/animations/clerk-toast", whole repo: "."). */
  path?: string;
  kind: FixtureKind;
  /** Copied into TestCases/test_folders/agent_fixture/store/expo_go/<committed>. */
  committed?: string;
  committed_patch?: string;
  /** true = fetch.sh must clone it. */
  fetch?: boolean;
  commit?: string;
  last_change?: string;
  /** Verdict a judge can expect for the FINAL state: starts with ok / NO / likely. */
  expo_go: string;
}
/** sources.json without its `_note` text: name -> entry. data.ts validates the file while loading it. */
export type SourcesFile = Record<string, SourceEntry>;

/* ───────────── TestCases/test_folders/agent_fixture/store/expo_go/phases.json (generated from git history) ───────────── */

/** One real commit of a project = one phase. */
export interface PhaseRow {
  /** 1-based position in the chain. */
  n: number;
  /** Full 40-char sha of the commit. */
  sha: string;
  /** Full sha the patch starts from: the parent of the commit (phase 1) or the previous replayed commit. fetch.sh <name> <dest> <n> checks this out. */
  from: string;
  /** true = no history replayed: the patch builds the project from nothing to its LATEST state (version upgrades are ignored on purpose). `from` is then git's empty tree. */
  snapshot?: boolean;
  /** package names whose version was kept from history because the repo's latest package.json no longer has them (package.json is modernised: names from the commit, versions from the latest). */
  legacy_pins?: string[];
  /** Skipped commits (that touched the folder) between `from` and `sha`, folded into this phase's patch. 0 = the patch is exactly one commit. */
  folded: number;
  date: string;
  subject: string;
  /** Developer's real diff of this commit, relative to store/expo_go (never given to the agent). */
  patch: string;
  /** Files the commit changed (b-side of the patch; deleted files are not listed). */
  files: string[];
  patch_bytes: number;
}
/** phases.json: name (a key of sources.json) -> its commits in order. */
export type PhasesFile = Record<string, PhaseRow[]>;

/* ───────────── test authoring (the sub files ex_*.ts / demo_*.ts) ───────────── */

/** Expo Go verdict the agent's REPORT line must give (`expo_go` field). */
export const EXPO_GO_VERDICTS = ["ok", "needs_dev_build"] as const;
export type ExpoGoVerdict = (typeof EXPO_GO_VERDICTS)[number];

/** What check.ts validates: every case the suite exports. */
export interface SuiteSpec {
  cases: Case[];
  tags: TestTag[];
  /** sources.json names that no result file mentions by `"name"` but that a case still uses (folio: a module result). */
  otherSources: string[];
}

/** A problem check.ts found. */
export interface Problem { where: string; what: string }
