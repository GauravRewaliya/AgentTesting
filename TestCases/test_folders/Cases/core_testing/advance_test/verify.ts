// Free check of the advance_test fixtures (no model): bun TestCases/test_folders/Cases/core_testing/advance_test/verify.ts
// Runs plan -> build -> review -> fix through the REAL FixtureGate on a temp store and asserts: order is enforced (`after`), the reviewer really finds the gaps in what the builder wrote,
// the fix closes them, the clean scenario is approved, the lead-visible OBSERVER block is there, and the session table keeps the history. Exit 1 on the first broken expectation.
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MStore, FixtureGate } from "../../../../../test_harness/core/orchestrator.ts";

let bad = 0; const ok = (name: string, cond: boolean, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!cond) bad++; };
const d = mkdtempSync(join(tmpdir(), "adv-")), st = new MStore(join(d, "s.json")), gate = new FixtureGate({ run: async () => { throw new Error("a real call must not happen here"); } } as never, () => st, 12);
st.ev("fixture.mock", "T", "", { roles: ["planner", "builder", "qa-reviewer"], guard: "stage_rules.json", ids: readdirSync(join(import.meta.dirname, "../../../agent_fixture/results/advance_test")).map((f) => f.replace(/\.ts$/, "")) });   // what declareGateLimit does for a real case
let n = 0; const ask = (role: string, prompt: string, agent = `${role}#1`) => gate.run({ agent: { name: role, fixtures: true }, row: { task_id: "T", agent_id: agent, caller_agent_id: "lead", parent_session_id: "L", last_call_id: "c" + ++n }, cwd: d, prompt, session: { id: "u" + n, resume: false } } as never);
const dir = "slugify-gap", ws = join(d, "run_test", dir), file = (f: string) => (existsSync(join(ws, f)) ? readFileSync(join(ws, f), "utf8") : "");
const H = (stage: string, extra = "") => `${stage} for the slugify job in run_test/${dir}. ${extra} Keep to PLAN.md and say what you did in detail so the lead can check it.`;

let r = await ask("qa-reviewer", H("Review it"));   ok("review BEFORE build is refused (order enforced)", !r.ok && r.reply.includes("FIXTURE NOT FOUND"));
r = await ask("builder", H("Build it", "PLAN.md says: create src/slugify.ts and tests.")); ok("build BEFORE plan is refused", !r.ok && r.reply.includes("FIXTURE NOT FOUND"));
r = await ask("planner", H("Plan it"));           ok("plan served", r.ok && file("PLAN.md").includes("A3 accents"));
r = await ask("builder", H("Build it", "PLAN.md says: create src/slugify.ts and tests."));   ok("gappy build served", r.ok && !file("src/slugify.ts").includes("normalize") && r.reply.startsWith("OBSERVER"), "observer line first");
r = await ask("qa-reviewer", H("Review it"));        ok("reviewer REALLY finds 3 gaps in the files on disk", r.ok && ["F1", "F2", "F3"].every((f) => r.reply.includes(f)) && r.reply.includes("changes_requested"));
r = await ask("builder", "Verify the files in run_test/slugify-gap and confirm which of them exist, list them, nothing else is needed.", "builder#1"); ok("a pure CHECK ask while the fix is eligible is answered from the table (does NOT serve the fix)", r.ok && r.reply.includes("SESSION of builder#1") && !file("src/slugify.ts").includes("normalize"));
r = await ask("builder", H("Fix it", "Findings F1 F2 F3 from the review. PLAN.md applies."), "builder#1"); ok("fix served after the review (same builder agent)", r.ok && r.reply.includes("You are right, sorry") && file("src/slugify.ts").includes("normalize") && file("src/slugify.test.ts").match(/\btest\(/g)!.length === 3);
r = await ask("qa-reviewer", "What exactly did you find in your review? list the findings", "qa-reviewer#1"); ok("asking the reviewer again = answered from the session table (history)", r.ok && r.reply.includes("SESSION of qa-reviewer#1") && r.reply.includes("served adv-gap-review"));
const tbl = st.fixtureSessions.map((x) => `${x.agent_id}:${x.version}:${x.history.map((h) => h.kind).join(",")}`);
ok("session table keeps one row per agent with its full history (the refused out-of-order call is part of it)", tbl.includes("builder#1:4:corrected,served,verify,served") && tbl.includes("qa-reviewer#1:3:corrected,served,verify"), JSON.stringify(tbl));
// a lead that opens a SECOND reviewer and then asks that new agent a check question (seen in a real run): answered from the table, not FIXTURE NOT FOUND
r = await ask("qa-reviewer", H("Review the current files again"), "qa-reviewer#2"); ok("a second reviewer asking for a re-review gets the (already done) answer, not an error", r.ok);
r = await ask("qa-reviewer", "From your review: state which findings are closed and which are still open, with evidence", "qa-reviewer#2"); ok("check question to that second reviewer is answered from the table", r.ok && r.reply.includes("SESSION of qa-reviewer#2"));
// clean scenario
const dir2 = "slugify-ok"; const H2 = (s: string, e = "") => `${s} for the slugify job in run_test/${dir2}. ${e} Keep to PLAN.md and report in detail.`;
await ask("planner", H2("Plan it"), "planner#2"); await ask("builder", H2("Build it", "PLAN.md says: create src/slugify.ts and tests."), "builder#2");
r = await ask("qa-reviewer", H2("Review it"), "qa-reviewer#2"); ok("clean build: reviewer approves, no findings", r.ok && r.reply.includes("REVIEW: approved") && !/\bF\d\b/.test(r.reply.split("REPORT")[0]));
// context loss (adv_3): the hand-over decides which reviewer answers
const dir3 = "copy-demo", H3 = (s: string, e = "") => `${s} the files in run_test/${dir3}. ${e} Report in detail what you found.`;
await ask("builder", H3("Copy index.html to index2.html in", "A plain copy, nothing else; PLAN.md is not needed."), "builder#3");
r = await ask("qa-reviewer", H3("Review", "Check index2.html."), "qa-reviewer#3"); ok("review hand-over WITHOUT the intent gets the harmful finding (what a careless lead causes)", r.ok && r.reply.includes("unrequested duplicate") && r.reply.includes("remove it"));
const dir4 = "copy-demo"; void dir4;
r = await ask("qa-reviewer", H3("Review", "index2.html is the BACKUP the user asked for; compare it with index.html."), "qa-reviewer#4"); ok("hand-over WITH the intent ('backup') gets the approving review", r.ok && r.reply.includes("REVIEW: approved") && r.reply.includes("byte-identical"));
// browser QA with a real video (needs the docker image: bun test_harness/infra/qa/run_qa.ts --build); skipped when the image is missing
const { qaImageReady } = await import("../../../../../test_harness/infra/qa/run_qa.ts");
if (!qaImageReady()) console.log("SKIP  QA video (image agent-testing-qa:1 missing)");
else {
  await ask("builder", "Build the slug demo page in run_test/qa-demo. PLAN.md: one index.html, input + Clear button. Report in detail so the lead can check it.", "builder#5");
  r = await ask("qa-reviewer", "QA the page in run_test/qa-demo in a browser and record a video. Report what you saw in detail.", "qa-reviewer#9");
  const video = r.reply.match(/VIDEO: (\S+)/)?.[1] ?? "";
  ok("QA agent records a REAL video in the container", r.ok && r.reply.includes("QA PASS") && video.endsWith("qa.webm") && existsSync(video) && readFileSync(video).subarray(0, 4).toString("hex") === "1a45dfa3", video);
  ok("QA saw the page react to typing (slug of the typed title)", r.reply.includes("cafe-creme-2026"));
}
console.log(bad ? `\n${bad} FAILED` : "\nadvance_test fixtures: all ok"); process.exit(bad ? 1 : 0);
