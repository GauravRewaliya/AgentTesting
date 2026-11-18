// Free check (bun self_test/session_audit.ts): the SESSION AUDIT fails a slow / wasteful real session with the reasons and passes a lean one. Synthetic sessions: nothing from .state is needed.
// The bad one reproduces the real session smwm7hrwx (333 s: one builder for all, QA stopped by a false alarm, 2 videos, 3 pictures, ffmpeg, sleep loops, find /).
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { auditSession } from "../../../session_audit.ts";
import { results, setSuite, t } from "./lib.ts";
setSuite("session audit: the cost of a real run is judged, with the reason");

type Ev = { t: number; type: string; agent_id?: string; data?: Record<string, unknown> };
const T0 = 1_000_000;
const ev = (s: number, type: string, agent_id?: string, data?: Record<string, unknown>): Ev => ({ t: T0 + s * 1000, type, agent_id, data });
const toolLog = (agent: string, n: number, cmds: string[]) => cmds.map((c) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: c } }] } })).join("\n") + "\n";
function session(events: Ev[], logs: Record<string, string[]>, media: { videos?: number; pictures?: number }) {
  const d = mkdtempSync(join(tmpdir(), "audit-")); writeFileSync(join(d, "store.json"), JSON.stringify({ events }));
  mkdirSync(join(d, "logs", "t"), { recursive: true });
  for (const [agent, cmds] of Object.entries(logs)) { const [name, n] = agent.split("#"); writeFileSync(join(d, "logs", "t", `${name}_${n}.sess.jsonl`), toolLog(agent, cmds.length, cmds)); }
  mkdirSync(join(d, "qa", "run"), { recursive: true });
  for (let i = 0; i < (media.videos ?? 0); i++) writeFileSync(join(d, "qa", "run", `v${i}.webm`), "x");
  for (let i = 0; i < (media.pictures ?? 0); i++) writeFileSync(join(d, "qa", "run", `p${i}.png`), "x");
  return d;
}
const grant = (s: number, callee: string, kind = "new") => ev(s, "agent.call.granted", "lead#1", { callee, kind });
const run = (agent: string, from: number, to: number, mode = "new") => [ev(from, "agent.start", agent, { mode }), ev(to, "agent.done", agent, { mode })];

// ---- the slow one: what the real session did
const bad = session([
  ev(0, "agent.start", "lead#1", { mode: "new" }), grant(8, "builder#1"), ...run("builder#1", 8, 67),
  ev(73, "agent.call.denied", "lead#1", { code: "readonly_declared_writes" }), grant(75, "qa-reviewer#1"),
  ...run("qa-reviewer#1", 75, 106), ev(106, "agent.needs_parent", "qa-reviewer#1", {}), grant(108, "qa-reviewer#1", "resume"), ...run("qa-reviewer#1", 108, 323, "resumed"), ev(333, "agent.done", "lead#1", {}),
], { "builder#1": ["cat > index.html <<EOF"], "qa-reviewer#1": ["find / -type d -name sakura 2>/dev/null | head", "bun tools.ts tab do --out a --video --steps '[]'", "ffmpeg -y -i a.webm a.mp4", "sleep 15; ls", "bun tools.ts tab do --out b --video --steps '[]'", "ffmpeg -y -i b.webm b.mp4"] }, { videos: 2, pictures: 3 });
const rb = auditSession(bad, { expect: "page" }), why = rb.reasons.join(" | ");
t("sa.1", "the slow real session FAILS, and the reasons name each problem: total time, QA time, duplicate video, extra pictures, ffmpeg, sleep, find /, the NEEDS_PARENT stop; the grade is poor",
  !rb.ok && /took 333 s/.test(why) && /QA needed 246 s/.test(why) && /2 videos/.test(why) && /3 pictures/.test(why) && /ffmpeg/.test(why) && /sleep/.test(why) && /find \//.test(why) && /NEEDS_PARENT/.test(why) && rb.grade === "poor", why.slice(0, 300));

// ---- a builder that records, one builder resumed again and again, QA never ran (the stopped run sm_speed1)
const seq = session([ev(0, "agent.start", "lead#1", { mode: "new" }), grant(8, "builder#1"), ...run("builder#1", 8, 63), ...run("builder#1", 65, 122, "resumed"), ...run("builder#1", 126, 180, "resumed")],
  { "builder#1": ["cat > record_demo.mjs <<EOF", "node record_demo.mjs && ffmpeg -i demo.webm demo.mp4"] }, {});
const rs = auditSession(seq, { expect: "page" }), why2 = rs.reasons.join(" | ");
t("sa.2", "one builder resumed again and again, running a recorder itself, and QA never running FAILS with those three reasons", !rs.ok && /resumed 2 times/.test(why2) && /recorded or ran a browser/.test(why2) && /QA never ran/.test(why2), why2.slice(0, 300));

// ---- the lean one: three builders together, one QA run, one video, one picture, no waste
const good = session([
  ev(0, "agent.start", "lead#1", { mode: "new" }), grant(6, "builder#1"), grant(6, "builder#2"), grant(7, "builder#3"), ...run("builder#1", 6, 50), ...run("builder#2", 6, 55), ...run("builder#3", 7, 48),
  grant(60, "qa-reviewer#1"), ...run("qa-reviewer#1", 60, 150), ev(160, "agent.done", "lead#1", {}),
], { "builder#1": ["node --check js/scene.js"], "builder#2": ["node --check js/effects.js"], "builder#3": ["node --check js/ui.js"], "qa-reviewer#1": ["bun tools.ts bg_start --cmd 'python3 -m http.server'", "bun tools.ts tab open --url http://x", "bun tools.ts tab do --out a --video --steps '[]'", "bun tools.ts tab close"] }, { videos: 1, pictures: 1 });
const rg = auditSession(good, { expect: "page" });
t("sa.3", "a lean session passes: 3 builders started together, one QA run of 4 calls, one video, one picture, 160 s", rg.ok && rg.reasons.length === 0, rg.reasons.join(" | "));

// ---- the budget is the case's: the same slow-ish run passes with a larger budget (a big job may take longer)
const rb2 = auditSession(good, { expect: "page", budget: { total_s: 100 } });
t("sa.4", "a smaller budget turns the lean session into a FAIL with the number in the reason (the budget belongs to the case)", !rb2.ok && /took 160 s in total \(budget 100 s\)/.test(rb2.reasons.join(" ")), rb2.reasons.join(" | "));

// ---- builders that did not start together
const spread = session([ev(0, "agent.start", "lead#1", { mode: "new" }), grant(6, "builder#1"), grant(70, "builder#2"), ...run("builder#1", 6, 50), ...run("builder#2", 70, 100), grant(110, "qa-reviewer#1"), ...run("qa-reviewer#1", 110, 180)], { "qa-reviewer#1": ["tab do --video"] }, { videos: 1 });
const rp = auditSession(spread, { expect: "page" });
t("sa.5", "two builders started 64 s apart are not parallel: FAIL 'did not start together'", !rp.ok && /did not start together \(64 s apart/.test(rp.reasons.join(" ")), rp.reasons.join(" | "));

// ---- the run that made the user say "poor": 4 builders for one small page, the biggest took 99 of 167 s, 4 pictures, cost $0.70 (rs_sakura_page_mwm8na740)
const over = session([
  ev(0, "agent.start", "lead#1", { mode: "new" }), grant(30, "builder#1"), grant(34, "builder#2"), grant(36, "builder#3"), grant(40, "builder#4"),
  ...run("builder#1", 30, 50), ...run("builder#2", 34, 66), ...run("builder#3", 36, 52), ...run("builder#4", 40, 139),
  grant(147, "qa-reviewer#1"), ...run("qa-reviewer#1", 147, 231), ev(239, "agent.done", "lead#1", { cost: 0.21 }),
], { "qa-reviewer#1": ["bun tools.ts tab do --out a --video --steps '[]'", "bun tools.ts tab close"] }, { videos: 1, pictures: 4 });
const ro = auditSession(over, { expect: "page" }), why3 = ro.reasons.join(" | ");
t("sa.6", "4 builders for one page with one part taking 59% is POOR: 'over-split' and 'uneven split' with the numbers, and the 4 pictures", ro.grade === "poor" && /4 builders for one page \(budget 3\)/.test(why3) && /uneven split: the biggest builder took 99 s of 167 s \(59%/.test(why3) && /4 pictures/.test(why3), why3.slice(0, 300));
// ---- ONE builder for a small page is the default, not a failure
const one = session([ev(0, "agent.start", "lead#1", { mode: "new" }), grant(8, "builder#1"), ...run("builder#1", 8, 67), grant(75, "qa-reviewer#1"), ...run("qa-reviewer#1", 75, 160), ev(170, "agent.done", "lead#1", {})], { "qa-reviewer#1": ["tab do --out a --video", "tab close"] }, { videos: 1, pictures: 1 });
const r1 = auditSession(one, { expect: "page" });
t("sa.7", "one builder then one QA for a page is GOOD (no 'must split' rule any more)", r1.grade === "good" && r1.reasons.length === 0, r1.reasons.join(" | "));
// ---- the cost budget: cost is summed from the agent.done events
const costly = session([ev(0, "agent.start", "lead#1", { mode: "new" }), ev(1, "agent.start", "builder#1", { mode: "new" }), ev(40, "agent.done", "builder#1", { mode: "new", cost: 0.55 }), grant(8, "builder#1"),
  ev(45, "agent.start", "qa-reviewer#1", { mode: "new" }), ev(100, "agent.done", "qa-reviewer#1", { mode: "new", cost: 0.3 }), ev(110, "agent.done", "lead#1", { mode: "new", cost: 0.2 })], { "qa-reviewer#1": ["tab do --out a --video", "tab close"] }, { videos: 1, pictures: 1 });
const rc = auditSession(costly, { expect: "page" }), rc2 = auditSession(costly, { expect: "page", budget: { cost_usd: 2 } });
t("sa.8", "cost is summed over the agents ($0.55 + $0.30 + $0.20 = $1.05): over the default budget the run is POOR with 'cost $1.05 (budget $0.7)'; with a budget of $2 it is not", rc.metrics.cost_usd === 1.05 && /cost \$1\.05 \(budget \$0\.7\)/.test(rc.reasons.join(" ")) && !rc2.reasons.some((r) => /^cost/.test(r)), rc.reasons.join(" | ") + " / " + String(rc.metrics.cost_usd));

// ---- a picture of motion is a defect (the video shows motion)
const qaWith = (steps: string) => session([ev(0, "agent.start", "lead#1", { mode: "new" }), grant(5, "builder#1"), ...run("builder#1", 5, 40), grant(45, "qa-reviewer#1"), ...run("qa-reviewer#1", 45, 100), ev(105, "agent.done", "lead#1", {})],
  { "qa-reviewer#1": [`team tab do --video --clear --steps '${steps}'`, "team tab close"] }, { videos: 1, pictures: 2 });
const rm = auditSession(qaWith('[{"name":"day-rotating","shot":true},{"name":"day later to prove rotation","shot":true}]'), { expect: "page" });
t("sa.9", "pictures named after motion ('day-rotating', 'day later to prove rotation') are a reason, with the names", rm.grade === "poor" && /2 picture\(s\) of motion \("day-rotating", "day later to prove rotation"\)/.test(rm.reasons.join(" ")), rm.reasons.join(" | "));
const rn = auditSession(qaWith('[{"name":"main view","shot":true},{"name":"sunset look","shot":true},{"name":"rotate","click":"#btn-rotate"}]'), { expect: "page" });
t("sa.10", "a main view and the toggled look are fine, and a step named 'rotate' WITHOUT a picture is fine too", !rn.reasons.some((r) => /motion/.test(r)), rn.reasons.join(" | "));
const badN = results.filter((x) => !x.ok).length; console.log(`\n${results.length - badN}/${results.length} passed`); process.exit(badN ? 1 : 0);
