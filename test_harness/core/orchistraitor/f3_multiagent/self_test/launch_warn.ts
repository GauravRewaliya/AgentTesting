// Free check (bun self_test/launch_warn.ts): a launch prompt over the limit makes a console warning, a `prompt.big` event and an admin report; a small one makes none.
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { MStore } from "../harness/core/board.ts"; import { loadAgents, callAgent, ScriptRunner } from "../harness/core/base.ts"; import { launchDef } from "../harness/core/launch.ts";
import { results, setSuite, t } from "./lib.ts";
setSuite("launch warning (final call)");
const defs = loadAgents(), dir = mkdtempSync(join(tmpdir(), "lw-")), warns: string[] = [], orig = console.warn; console.warn = (...a: unknown[]) => { warns.push(a.join(" ")); };
const run = async (name: string) => { const st = new MStore(join(dir, name + ".json")); st.save?.(); const ld = launchDef(defs.get(name)!, defs, 2, 4, dir, "team"); const d = new Map(defs).set(name, ld);
  const lead = st.addAgent("t", defs.get("lead")!, { level: 1 }); const ag = st.addAgent("t", ld, { level: 2, cwd: dir }); st.tx(() => { lead.status = "running"; });
  await callAgent({ store: st, runner: new ScriptRunner(async () => "ok"), defs: d, sessionCap: 3 } as never, ag, dir, () => "TASK t\nOBJECTIVE: x", undefined, {}, {}); return st; };
const big = await run("builder"), small = await run("researcher"); console.warn = orig;
const issues = (n: string) => { const f = join(dir, n + ".json").replace(/\.json$/, ".json"); return existsSync(join(dir, "admin_issues.jsonl")) ? readFileSync(join(dir, "admin_issues.jsonl"), "utf8") : ""; };
t("lw.1", "a builder (launch prompt ~10k chars) gets a console warning naming the size and the limit", warns.some((w) => /launch prompt of builder is \d+ chars \(limit 8000/.test(w)), warns.join(" | ").slice(0, 200));
t("lw.2", "and a prompt.big event in its store", big.evs("prompt.big", "t").length === 1);
t("lw.3", "and a row in admin_issues.jsonl (kind prompt_big) next to the store: the dashboard lists it", /"kind":"prompt_big"/.test(issues("builder")));
t("lw.4", "a small prompt (researcher) warns about nothing", !warns.some((w) => /researcher/.test(w)) && small.evs("prompt.big", "t").length === 0);
const bad = results.filter((x) => !x.ok).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
