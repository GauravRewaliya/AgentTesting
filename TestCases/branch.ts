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

// ── before_node_run (Case.before_node_run): a plain function that runs right before the lead of a node starts, the way a fixture's `run` does. ──
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import type { Case, NodeRunCtx } from "./types.ts";
/** The default: nothing to change, just say which node this is (so a branch run is visible in the output). */
export const defaultBeforeNodeRun = (ctx: NodeRunCtx): void => ctx.log(`default ${ctx.phase}: nothing to prepare (${ctx.node}${ctx.parent ? " of " + ctx.parent : ""}${ctx.branch ? ", folder " + ctx.branch : ""}, workspace ${ctx.run_test})`);
/** Build the context and run the case's hook (or the default). Errors are NOT swallowed: a hook that throws fails the run before any model call is spent. */
export async function runBeforeNode(c: Pick<Case, "id" | "before_node_run" | "after_node_run">, o: { phase?: "before" | "after"; node: NodeRunCtx["node"]; parent?: string; branch?: string; workspace: string; print?: (s: string) => void }): Promise<void> {
  const rt = join(o.workspace, "run_test"), print = o.print ?? console.log;
  const safe = (p: string) => { const f = resolve(rt, p); if (f !== rt && !f.startsWith(rt + sep)) throw new Error(`before_node_run: path leaves run_test: ${p}`); return f; };
  const phase = o.phase ?? "before", ctx: NodeRunCtx = { case_id: c.id, phase, node: o.node, parent: o.parent, branch: o.branch, workspace: o.workspace, run_test: rt,
    read: (p) => { const f = safe(p); return existsSync(f) ? readFileSync(f, "utf8") : undefined; },
    write: (p, t) => { const f = safe(p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, t); },
    patch: (p, from, to) => { const f = safe(p); if (!existsSync(f)) return false; const t = readFileSync(f, "utf8"), u = t.replace(from, to); if (u === t) return false; writeFileSync(f, u); return true; },
    apply_patch: (pf, d) => {   // from the workspace root with --directory: inside a repo, `git apply` run in a subfolder silently SKIPS paths that are not relative to the repo root (it said "applied" and changed nothing)
      const dir = relative(o.workspace, safe(d)).split(sep).join("/"), r = spawnSync("git", ["apply", "-p1", "--whitespace=nowarn", `--directory=${dir}`, pf], { cwd: o.workspace, encoding: "utf8" });
      return r.status === 0 ? "" : (r.stderr || r.stdout || "git apply failed").slice(0, 400); },
    auto_run: (a) => {
      const g = (args: string[]) => spawnSync("git", ["-C", o.workspace, "-c", "user.name=auto_run (mimics the master)", "-c", "user.email=auto_run@harness.local", ...args], { encoding: "utf8" });
      const files = existsSync(a.fixDir) ? readdirSync(a.fixDir).filter((f) => f.endsWith(".patch")).sort() : [], commits: { sha: string; subject: string; files: string[] }[] = [];
      if (!files.length) return { commits, error: `no .patch files in ${a.fixDir}` };
      for (const f of files) {   // (a long Subject is folded over several lines by format-patch: unfolded below)
        const text = readFileSync(join(a.fixDir, f), "utf8"), subject = (text.match(/^Subject: (?:\[PATCH[^\]]*\] )?((?:.*)(?:\n .*)*)/m)?.[1] ?? f).replace(/\n\s+/g, " "), body = (text.split(/^---$/m)[0] ?? "").split(/\n\n/).slice(1).join("\n\n").trim();
        const bad = ctx.apply_patch(join(a.fixDir, f), a.dir); if (bad) return { commits, error: `${f}: ${bad}` };
        g(["add", "-A", "--", `run_test/${a.dir}`]); g(["commit", "-qm", subject, ...(body ? ["-m", body] : [])]);
        commits.push({ sha: g(["rev-parse", "--short", "HEAD"]).stdout.trim(), subject, files: [...text.matchAll(/^diff --git a\/(\S+)/gm)].map((m) => m[1]!) });
      }
      const sd = join(dirname(o.workspace), "store"); mkdirSync(sd, { recursive: true }); writeFileSync(join(sd, "auto_run.json"), JSON.stringify({ case: c.id, found: a.found, commits }, null, 1) + "\n");
      return { commits };
    },
    log: (m) => print(`   ${phase}_node_run${phase === "after" ? "   " : "  "}: ${m}`) };
  await ((phase === "after" ? c.after_node_run : c.before_node_run) ?? defaultBeforeNodeRun)(ctx);
}
