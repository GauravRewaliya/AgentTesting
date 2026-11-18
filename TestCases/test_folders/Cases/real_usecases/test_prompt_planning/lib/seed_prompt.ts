// Copy a frozen PLAN (agent_fixture/prompt_fixtures/<plan>) into the workspace of a node: run_test/<dir>.
// "Can the team BUILD it from this plan alone?" = the plan is already in run_test/plan when the lead starts, and the user only says "build it".
// No model call. Nothing but the plan is copied: no reference store, no result of an earlier run.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { NodeRunCtx } from "../../../../../types.ts";

export const PROMPT_FIXTURES = join(import.meta.dir, "..", "..", "..", "..", "agent_fixture", "prompt_fixtures");

export type Shape = "multi_phase" | "one_phase_complete";

/** Copy agent_fixture/prompt_fixtures/<plan>[/<shape>] (no shape = the plan folder itself) into run_test/<dir> (default `plan`). Runs BEFORE the first turn (Case.before_node_run). */
export function seedPromptFixture(ctx: NodeRunCtx, plan: string, shape: Shape | null, dir = "plan"): void {
  const from = shape ? join(PROMPT_FIXTURES, plan, shape) : join(PROMPT_FIXTURES, plan);
  if (!existsSync(join(from, "README.md"))) throw new Error(`prompt fixture missing: ${from}/README.md`);
  const dest = join(ctx.run_test, dir);
  rmSync(dest, { recursive: true, force: true }); mkdirSync(dest, { recursive: true });
  cpSync(from, dest, { recursive: true });
  ctx.log(`seeded prompt fixture ${plan}${shape ? "/" + shape : ""} -> run_test/${dir}`);
}
