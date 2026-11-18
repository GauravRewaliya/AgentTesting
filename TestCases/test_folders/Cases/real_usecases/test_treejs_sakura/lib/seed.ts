// Seeds of the sakura suite: the TWO REAL builds of the same request, copied exactly as they were built (nothing is edited, nothing is invented):
//   pass      = qa/build_b_cdn       the real session rs_sakura_page_mwm8na741: the good one (three.js from a CDN importmap, so the QA browser needs network)
//   hard_neg  = qa/build_a_vendored  the real session rs_sakura_page_mwm8na740: very close to good, but not: a QA that LOOKS must see why (three.js vendored, runs offline)
import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { NodeRunCtx } from "../../../../../types.ts";

export const QA_DIR = join(import.meta.dir, "..", "qa");
export const PASS = join(QA_DIR, "build_b_cdn");
export const HARD_NEG = join(QA_DIR, "build_a_vendored");
export const GOOD = PASS;   // the recorded builder fixture (agent_fixture/results/test_treejs_sakura/role-sakura-builder.ts) hands out the good build

export function seedSakura(ctx: NodeRunCtx, variant: "pass" | "hard_neg"): void {
  const dest = join(ctx.run_test, "sakura"); rmSync(dest, { recursive: true, force: true }); cpSync(variant === "pass" ? PASS : HARD_NEG, dest, { recursive: true });
  ctx.log?.(`seeded the ${variant} sakura build -> run_test/sakura`);
}
