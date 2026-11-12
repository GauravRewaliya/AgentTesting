// BRANCH syntax for test cases (one place; every loader uses it).
//   after:       "<id>"   CONTINUE the parent: same lead session, same workspace. Only ONE case may continue a parent (the main line).
//   branch_from: "<id>"   FORK the parent's checkpoint: the case runs in its own folder `<parent session>/branches/branch_<hex>/` (workspace copy, store copy without record/),
//                         its lead is a clone of the parent's Claude session made on the fly (see test_harness/.../f1_multiagent/testrun/branch.ts).
// If 2+ cases hang under the SAME parent (even in different suites) all but ONE must say `branch_from`. A case that still says `after` there is CORRECTED AUTOMATICALLY
// (`normalizeBranches` marks it `branch_auto` and turns it into a branch, so nothing crashes or shares a session by accident) and `branchWarnings` lists it so it can be fixed in the file later.
// For all older code a branch is normalised to `{ after: <parent>, branch_from: <parent> }`, so every reader of `after` (chains, UI, judge) keeps working.
type Node = { id: string; after?: string; branch_from?: string; branch_auto?: boolean; suite?: string };
export const parentOf = (c: Node) => c.branch_from ?? c.after;
/** `all` = the cases of ALL suites in load order (the first `after` child of a parent is its main line). */
export function normalizeBranches<T extends Node>(all: T[]): T[] {
  const main = new Set<string>();   // parents whose main line is already taken
  return all.map((c) => {
    if (c.branch_from) return { ...c, after: c.branch_from };
    if (!c.after) return c;
    if (!main.has(c.after)) { main.add(c.after); return c; }
    return { ...c, branch_from: c.after, branch_auto: true };   // second (third ...) `after` child of one parent: it cannot share the parent's session
  });
}
/** Messages for `bun run dev`, check.ts and validate.ts. Give it the NORMALISED cases of ALL suites. */
export function branchWarnings(all: Node[]): string[] {
  const out: string[] = [];
  const byParent = new Map<string, Node[]>();
  for (const c of all) if (c.branch_auto) byParent.set(c.after!, [...(byParent.get(c.after!) ?? []), c]);
  for (const [p, bad] of byParent) {
    const sib = all.filter((k) => parentOf(k) === p);
    out.push(`found a branch but not the branch syntax: "${p}" has ${sib.length} children (${sib.map((k) => k.id + (k.suite ? "@" + k.suite : "")).join(", ")}); write \`branch_from: "${p}"\` instead of \`after\` on: ${bad.map((k) => k.id).join(", ")} (treated as branch_from automatically for now)`);
  }
  for (const c of all) if (c.branch_from && !c.branch_auto && c.after && c.after !== c.branch_from) out.push(`${c.id}: has both after and branch_from with different parents`);
  return out;
}
