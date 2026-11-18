// Put a recorded project (a zip in agent_fixture/store/projects) into the workspace of a node.
// Use it in `Case.before_node_run`: "check the project" = the zip is already unpacked in run_test/<dir> when the lead starts.
// No model call, no network. A zip with ONE top-level folder is lifted up (run_test/<dir>/package.json, not run_test/<dir>/<name>/package.json).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { NodeRunCtx } from "../../../../../types.ts";

export const PROJECT_ZIPS = join(import.meta.dir, "..", "..", "..", "..", "agent_fixture", "store", "projects");

/** Unpack `<zip>.zip` into `<ctx.run_test>/<dir>` (replaced if it is already there). Throws when the zip is missing or unzip fails. */
export function seedProject(ctx: NodeRunCtx, zip: string, dir: string): void {
  const file = join(PROJECT_ZIPS, zip + ".zip");
  if (!existsSync(file)) throw new Error(`project fixture missing: ${file}`);
  const dest = join(ctx.run_test, dir);
  rmSync(dest, { recursive: true, force: true }); mkdirSync(dest, { recursive: true });
  const r = spawnSync("unzip", ["-q", "-o", file, "-x", "__MACOSX/*", "-d", dest], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`unzip ${zip}.zip failed: ${r.stderr || r.stdout}`);
  const top = readdirSync(dest);
  if (top.length === 1 && statSync(join(dest, top[0]!)).isDirectory()) {   // lift the single wrapper folder
    const inner = join(dest, top[0]!), tmp = dest + ".__lift";
    renameSync(inner, tmp); rmSync(dest, { recursive: true, force: true }); renameSync(tmp, dest);
  }
  ctx.log(`seeded ${zip}.zip -> run_test/${dir} (${readdirSync(dest).length} entries)`);
}
