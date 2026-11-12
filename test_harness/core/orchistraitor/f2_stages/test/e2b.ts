// f2 E2B test. Part 1 (free): the runner finds loopferry's pure code and fails clearly without keys.
// Part 2 (--real, spends E2B + Claude credits): one tiny task through plan/build/review with claude inside a sandbox.
//   bun test/e2b.ts            free checks      |   bun test/e2b.ts --real
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { E2bRunner, LOOPFERRY_DIR } from "../harness/core/e2b_runner.ts";
import { loadDefs, loadPipeline } from "../harness/main.ts";
import { runTask } from "../harness/core/loop.ts";
import { Store } from "../harness/core/store.ts";
import { mkRepo, rm, setSuite, t, writeReport } from "./lib.ts";

setSuite("e2b runner (free)");
t("E1", "loopferry is found and its claude-coding.ts is the pure module we import", existsSync(join(LOOPFERRY_DIR, "src/services/engine/providers/claude-coding.ts")), LOOPFERRY_DIR);
{
  const saved = { ...process.env };
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN; delete process.env.ANTHROPIC_API_KEY;
  const r = await new E2bRunner().run({ agent: [...loadDefs().values()][0]!, row: {} as never, cwd: "/tmp", prompt: "x", session: { id: "s", resume: false } });
  t("E2", "no key/login -> a clear failed result, never a throw", !r.ok && /E2B_API_KEY|Claude login|loopferry/.test(r.error ?? ""), r.error ?? "");
  Object.assign(process.env, saved);
}

if (process.argv.includes("--real")) {
  setSuite("e2b real (plan/build/review, claude inside a sandbox)");
  const repo = mkRepo({ "slug.js": "module.exports.slugify = (s) => s;\n" }), store = new Store(), runner = new E2bRunner();
  try {
    const r = await runTask({
      ctx: { store, runner, defs: loadDefs(), sessionCap: 3 }, pipeline: loadPipeline(), task_id: "e1", cwd: repo,
      checkCmd: `node -e "const {slugify}=require('./slug.js');process.exit(slugify('Hello World')==='hello-world'?0:1)"`,
    });
    t("E3", "the loop ends done and the check passes on the files copied back from the sandbox", r.status === "done", `${r.status} ${r.reason} rounds=${r.rounds} cost=$${r.cost.toFixed(4)}`);
    t("E4", "the builder's slug.js change reached the local repo", /toLowerCase|hello/i.test(readFileSync(join(repo, "slug.js"), "utf8")));
  } finally { await runner.close(); rm(repo); }
}
process.exit(writeReport(join(import.meta.dir, "e2b_report.md"), "f2_stages: E2B runner", "Free part checks wiring; `--real` runs one task in a real sandbox.") ? 1 : 0);
