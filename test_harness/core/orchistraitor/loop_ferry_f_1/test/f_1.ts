// Test 1: loop_ferry_f_1 = the harness WITHOUT multi-agent. plan -> build -> review loop with persistent sessions.
//   bun test/f_1.ts            offline suite (scripted agents, free)
//   bun test/f_1.ts --real     also the real suite (real `claude -p` haiku sessions, ~12 calls, a few cents)
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkAgents, loadAgents } from "../harness/core/agents.ts";
import { lastJson, similar } from "../harness/core/parse.ts";
import { callAgent } from "../harness/core/call.ts";
import { brief } from "../harness/core/briefs.ts";
import { runTask, roleRow } from "../harness/core/loop.ts";
import { MixedRunner, RealRunner, ScriptRunner, projectDirFor, transcriptExistsAnywhere, transcriptFor } from "../harness/core/runner.ts";
import { decide, stagesFor } from "../harness/core/stages.ts";
import { Store } from "../harness/core/store.ts";
import type { RunCall } from "../harness/core/types.ts";
import { HARNESS_DIR, loadDefs, loadPipeline } from "../harness/main.ts";
import { find, renderCalls, renderSummary, renderTree, spans, summary, timeline } from "../harness/core/trace.ts";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { mkRepo, results, rm, setSuite, t, writeReport } from "./lib.ts";

const REAL = process.argv.includes("--real");
const defs = loadDefs(), pl = loadPipeline();
const mkCtx = (runner: ScriptRunner | RealRunner, cap = 3) => ({ store: new Store(), runner, defs, sessionCap: cap });

type Rev = { pass: boolean; findings?: { text: string; severity?: string }[] } | "none";
interface Plan { review: (r: number) => Rev; triage?: (r: number, ids: string[]) => string | undefined; build?: (r: number, cwd: string) => void }
function script(p: Plan) {
  const n: Record<string, number> = { plan: 0, build: 0, review: 0 };
  return (c: RunCall) => {
    const role = c.agent.role, r = ++n[role]!;
    if (role === "plan") {
      const ids = [...c.prompt.matchAll(/^(F\d+) \[/gm)].map((m) => m[1]!);
      const tri = ids.length ? (p.triage?.(r, ids) ?? JSON.stringify(ids.map((id) => ({ id, triage: "valid" })))) : "";
      return `1. do it\n${tri ? "TRIAGE: " + tri : ""}`;
    }
    if (role === "build") { p.build?.(r, c.cwd); return `done\nREPORT: {"summary":"built r${r}","files":["a.js"]}`; }
    const v = p.review(r);
    return v === "none" ? "looks fine" : `ok\nVERDICT: ${JSON.stringify({ pass: v.pass, findings: v.findings ?? [] })}`;
  };
}
const seq = (c: RunCall[]) => c.map((x) => x.agent.role).join(",");

async function offline() {
  setSuite("offline (scripted agents, real harness code)");
  const cwd = mkRepo();

  // F1 happy path
  { const rn = new ScriptRunner(script({ review: () => ({ pass: true }) })), ctx = mkCtx(rn);
    ctx.store.addRequest("t", "R1 text: make a.js");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    t("F1", "happy path: plan,build,review once, done", r.status === "done" && seq(rn.calls) === "plan,build,review" && r.rounds === 1, `${r.status} ${r.reason} ${seq(rn.calls)}`);
    const rows = ctx.store.agentsOf("t");
    t("F1b", "three agent rows, each with its own session id, all idle", rows.length === 3 && new Set(rows.map((x) => x.session_id)).size === 3 && rows.every((x) => x.status === "idle" && x.session_id), JSON.stringify(rows.map((x) => [x.agent_id, x.session_id?.slice(0, 6), x.status])));
    t("F1c", "reports and events are recorded for every call", ctx.store.reports.length === 3 && ctx.store.evs("agent.start").length === 3 && ctx.store.evs("task.end").length === 1, `reports=${ctx.store.reports.length}`);
  }
  // F2 reviewer issue -> planner -> builder -> reviewer, sessions kept, deltas only
  { const rn = new ScriptRunner(script({ review: (r) => r === 1 ? { pass: false, findings: [{ text: "trim is missing", severity: "major" }] } : { pass: true } })), ctx = mkCtx(rn);
    ctx.store.addRequest("t", "R1 text: make a.js");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    const c = rn.calls;
    t("F2", "issue loop: plan,build,review,plan,build,review then done in 2 rounds", r.status === "done" && r.rounds === 2 && seq(c) === "plan,build,review,plan,build,review", `${r.status} ${seq(c)}`);
    t("F2b", "round 2 resumes the SAME session of each role (no new session)", [0, 1, 2].every((i) => c[i + 3]!.session.id === c[i]!.session.id && c[i + 3]!.session.resume && !c[i]!.session.resume), c.map((x) => x.session.id.slice(0, 4) + (x.session.resume ? "r" : "n")).join(" "));
    t("F2c", "the resumed planner gets only the new finding, not the request again", c[3]!.prompt.includes("FINDINGS TO TRIAGE") && !c[3]!.prompt.includes("R1 text"), `resumed prompt: ${c[3]!.prompt.slice(0, 80).replace(/\n/g, " ")}`);
    t("F2d", "the builder is told which finding to fix; the reviewer is told what it raised before", c[4]!.prompt.includes("trim is missing") && c[5]!.prompt.includes("YOU RAISED THESE BEFORE"), "");
    t("F2e", "resume counters: 1 each; finding F1 ends fixed", ctx.store.agentsOf("t").every((x) => x.resume_count === 1) && ctx.store.findingsOf("t")[0]!.status === "fixed", JSON.stringify(ctx.store.findings.map((f) => [f.id, f.status])));
  }
  // F3 stuck
  { const rn = new ScriptRunner(script({ review: () => ({ pass: false, findings: [{ text: "Slug must trim", severity: "major" }] }) })), ctx = mkCtx(rn);
    ctx.store.addRequest("t", "R1");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    t("F3", "the same finding twice stops the loop and asks the person (stuck)", r.status === "waiting_person" && r.reason.startsWith("stuck") && r.rounds === 2, `${r.status} ${r.reason} rounds=${r.rounds}`);
  }
  // F4 max rounds
  { const rn = new ScriptRunner(script({ review: (r) => ({ pass: false, findings: [{ text: `different problem ${r} xyz${r}` }] }) })), ctx = mkCtx(rn);
    ctx.store.addRequest("t", "R1");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd, maxRounds: 2 });
    t("F4", "max rounds reached with new findings each time -> waiting_person", r.status === "waiting_person" && r.reason.startsWith("max_rounds") && r.rounds === 2, `${r.status} ${r.reason}`);
  }
  // F5 conflicts with request
  { const rn = new ScriptRunner(script({ review: () => ({ pass: false, findings: [{ text: "remove the trim" }] }), triage: (_r, ids) => JSON.stringify(ids.map((id) => ({ id, triage: "conflicts_with_request" }))) })), ctx = mkCtx(rn);
    ctx.store.addRequest("t", "R1");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    t("F5", "planner triages a finding as conflicting -> person, builder NOT called again", r.status === "waiting_person" && r.reason.startsWith("conflicts_with_request") && seq(rn.calls) === "plan,build,review,plan", `${r.status} ${r.reason} ${seq(rn.calls)}`);
  }
  // F6 deterministic check beats a passing reviewer
  { const d = mkRepo(); const rn = new ScriptRunner(script({ review: () => ({ pass: true }), build: (r, w) => { if (r === 2) writeFileSync(join(w, "ok.flag"), "1"); } })), ctx = mkCtx(rn);
    ctx.store.addRequest("t", "R1");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd: d, checkCmd: "test -f ok.flag" });
    t("F6", "reviewer says pass but the check fails -> another round; done once the check passes", r.status === "done" && r.rounds === 2 && ctx.store.findingsOf("t").some((f) => f.source === "checks" && f.status === "fixed"), `${r.status} rounds=${r.rounds} ${JSON.stringify(ctx.store.findings.map((f) => [f.id, f.source, f.status]))}`);
    rm(d);
  }
  // F7 two tasks never share
  { const rn = new ScriptRunner(script({ review: () => ({ pass: true }) })), ctx = mkCtx(rn);
    ctx.store.addRequest("tA", "R1 A"); ctx.store.addRequest("tB", "R1 B");
    await runTask({ ctx, pipeline: pl, task_id: "tA", cwd }); await runTask({ ctx, pipeline: pl, task_id: "tB", cwd });
    const a = ctx.store.agentsOf("tA"), b = ctx.store.agentsOf("tB");
    t("F7", "second task gets its own rows and sessions; ids resolve only inside their task", a.length === 3 && b.length === 3 && !a.some((x) => b.some((y) => y.session_id === x.session_id)) && ctx.store.agent("tB", "builder#1") !== ctx.store.agent("tA", "builder#1") && !ctx.store.agent("tC", "builder#1"), "");
  }
  // F8 session full -> rolled visibly, full brief again
  { const rn = new ScriptRunner(script({ review: (r) => r < 3 ? { pass: false, findings: [{ text: `issue number ${r} aaa${r}` }] } : { pass: true } })), ctx = mkCtx(rn, 1);
    ctx.store.addRequest("t", "R1 text");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd, maxRounds: 4 });
    const c = rn.calls;
    t("F8", "resume cap 1: round 3 rolls each role to a NEW session with a visible event and a full brief", r.status === "done" && ctx.store.evs("session.rolled").length === 3 && c[6]!.session.id !== c[3]!.session.id && !c[6]!.session.resume && c[6]!.prompt.includes("R1 text"), `${r.status} rolled=${ctx.store.evs("session.rolled").length}`);
  }
  // F9 a follow-up request: resumed, delta only
  { const rn = new ScriptRunner(script({ review: () => ({ pass: true }) })), ctx = mkCtx(rn);
    ctx.store.addRequest("t", "R1 original text"); await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    ctx.store.addRequest("t", "R2 follow up text"); await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    const c = rn.calls;
    t("F9", "follow-up request: all three roles resume; prompts hold R2 only", c.length === 6 && [3, 4, 5].every((i) => c[i]!.session.resume && c[i]!.session.id === c[i - 3]!.session.id && c[i]!.prompt.includes("R2") && !c[i]!.prompt.includes("R1 original")), c.slice(3).map((x) => x.prompt.length).join(","));
  }
  // F12/F13/F14
  { const rn = new ScriptRunner(() => { throw new Error("boom"); }), ctx = mkCtx(rn); ctx.store.addRequest("t", "R1");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    t("F12", "a failing agent halts the task and marks the agent failed", r.status === "halted" && r.reason.startsWith("agent_failed") && ctx.store.agentsOf("t").some((x) => x.status === "failed"), `${r.status} ${r.reason}`); }
  { const rn = new ScriptRunner(script({ review: () => ({ pass: true }) }), 1), ctx = mkCtx(rn); ctx.store.addRequest("t", "R1");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd, costCap: 1.5 });
    t("F12b", "spend cap halts the loop", r.status === "halted" && r.reason.startsWith("spend_cap"), `${r.status} ${r.reason}`); }
  { const rn = new ScriptRunner(script({ review: () => "none" }), 0.001), ctx = mkCtx(rn); ctx.store.addRequest("t", "R1");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd, maxRounds: 1 });
    t("F13", "a review without a verdict line counts as a failed review, never as a pass", r.status !== "done" && ctx.store.evs("review.no_verdict").length === 1, `${r.status} ${r.reason}`); }
  { const rn = new ScriptRunner(script({ review: () => ({ pass: true, findings: [{ text: "rename var", severity: "minor" }] }) })), ctx = mkCtx(rn); ctx.store.addRequest("t", "R1");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    t("F14", "a minor note on a pass is recorded but does not block", r.status === "done" && ctx.store.findings[0]?.status === "dropped", `${r.status}`); }
  // F11 pipeline as data + approval gate
  { t("F11", "pure pipeline: the PLANNER is a standard stage at every tier; a `when` condition still works for a custom pipeline; later rounds follow on_issue", [1, 2, 3, 4].every((tr) => stagesFor(pl, 1, { tier: tr, hasFindings: false }).join() === "plan,build,review") && stagesFor({ ...pl, stages: [{ role: "plan", when: "tier>=3" }, { role: "build" }, { role: "review" }] }, 1, { tier: 2, hasFindings: false }).join() === "build,review" && stagesFor(pl, 2, { tier: 1, hasFindings: true }).join() === "plan,build,review", "");
    const rn = new ScriptRunner(script({ review: () => ({ pass: true }) })), ctx = mkCtx(rn); ctx.store.addRequest("t", "R1");
    const a = await runTask({ ctx, pipeline: pl, task_id: "t", cwd, tier: 4 });
    t("F11b", "T4: the plan waits for a person; after approval the run continues", a.status === "waiting_person" && a.reason.startsWith("approval") && seq(rn.calls) === "plan", `${a.status} ${a.reason}`);
    const b = await runTask({ ctx, pipeline: pl, task_id: "t", cwd, tier: 4, approved: true });
    t("F11c", "approved run finishes", b.status === "done", `${b.status} ${b.reason}`);
    const f = (o: object) => decide({ pass: true, checksOk: true, open: [], stuck: [], round: 1, maxRounds: 3, ...o }).kind;
    t("F11d", "decide(): pass+checks+no findings = done; failed checks = again", f({}) === "done" && f({ checksOk: false }) === "again" && f({ pass: false }) === "again", ""); }
  // F10 agents:check
  { const ok = checkAgents(defs);
    t("F10", "agents:check passes on the real agent folders", ok.length === 0, ok.join("; "));
    const bad = new Map(defs); bad.set("ghost", { ...defs.get("builder")!, name: "ghost", agents: ["nobody"] });
    const cyc = new Map(defs); cyc.set("builder", { ...defs.get("builder")!, agents: ["reviewer"] }); cyc.set("reviewer", { ...defs.get("reviewer")!, agents: ["builder"] });
    const w = new Map(defs); w.set("planner", { ...defs.get("planner")!, tools: ["Read", "Write"] });
    t("F10b", "agents:check catches a missing callee, a cycle and a write tool on a read-only agent",
      checkAgents(bad).some((m) => m.includes("nobody")) && checkAgents(cyc).some((m) => m.startsWith("cycle")) && checkAgents(w).some((m) => m.includes("write tool")), ""); }
  // F17 the planner cannot waive a failing deterministic check
  { const d = mkRepo(); const rn = new ScriptRunner(script({ review: () => ({ pass: true }), triage: (_r, ids) => JSON.stringify(ids.map((id) => ({ id, triage: "out_of_scope" }))), build: (r, w) => { if (r === 2) writeFileSync(join(w, "ok.flag"), "1"); } })), ctx = mkCtx(rn);
    ctx.store.addRequest("t", "R1");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd: d, checkCmd: "test -f ok.flag" });
    t("F17", "planner marks a failing-check finding out_of_scope: ignored (event), the builder still gets it, done only when the check passes",
      r.status === "done" && ctx.store.evs("triage.ignored").length >= 1 && ctx.store.findingsOf("t")[0]!.status === "fixed" && rn.calls[4]!.prompt.includes("Checks failed"), `${r.status} ${r.reason} ignored=${ctx.store.evs("triage.ignored").length}`);
    rm(d); }
  // F18 navigating a task: tree, durations, timeline, search, summary, and the same from the command line on a store FILE
  { const file = join(tmpdir(), "lf-trace-" + Math.random().toString(36).slice(2, 7) + ".json");
    const rn = new ScriptRunner(async (c: RunCall) => { await new Promise((r) => setTimeout(r, 25)); return script({ review: (r) => r === 1 ? { pass: false, findings: [{ text: "trim is missing", severity: "major" }] } : { pass: true } })(c); }, 0.002);
    const ctx = { store: new Store(file), runner: rn, defs, sessionCap: 3 }; ctx.store.addRequest("t", "R1 text");
    await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    const sp = spans(ctx.store, "t"), sm = summary(ctx.store, "t"), tree = renderTree(ctx.store, "t"), tl = timeline(ctx.store, "t");
    t("F18", "trace helpers: 6 call spans each >= 20 ms with cost, a tree of the 3 agents, a timeline in order, a one-line summary",
      sp.length === 6 && sp.every((s) => s.ms >= 20 && s.cost === 0.002) && ["planner#1", "builder#1", "reviewer#1"].every((a) => tree.includes(a)) && tree.includes("resumed=1x") && sm.rounds === 2 && sm.calls === 6 && Math.abs(sm.cost - 0.012) < 1e-9 && tl.indexOf("task.start") < tl.indexOf("round.end") && renderSummary(ctx.store, "t").includes("2 round(s)"), tree + "\n" + renderSummary(ctx.store, "t"));
    t("F18b", "search: events of one agent, events by kind prefix, the review decisions per round", find(ctx.store, "t", { agent: "builder#1" }).every((e) => e.agent_id === "builder#1") && find(ctx.store, "t", { kind: "agent." }).length === 12 && find(ctx.store, "t", { kind: "round.end" }).length === 2 && timeline(ctx.store, "t", { kind: "round.end" }).includes("decision=again") && renderCalls(ctx.store, "t") === "", "");
    const cli = (c: string, extra: string[] = []) => spawnSync("bun", [join(HARNESS_DIR, "main.ts"), c, "--store", file, "--task", "t", ...extra], { encoding: "utf8" }).stdout;
    t("F18c", "the same views from the command line on the store file (tree, log --agent, summary): works on a finished OR a live store", cli("tree").includes("builder#1 [build]") && cli("log", ["--agent", "reviewer#1"]).includes("agent.done") && cli("summary").includes("2 round(s)"), cli("summary"));
    rmSync(file, { force: true }); }
  // F19 finished requests are history: a NEW or rolled session sees them as context only (the index2.html incident)
  { const rn = new ScriptRunner(script({ review: () => ({ pass: true }) })), ctx = mkCtx(rn, 0);   // cap 0: every call is a fresh session
    ctx.store.addRequest("t", "R1 original home page"); await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    ctx.store.addRequest("t", "R2 copy index.html to index2.html"); await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    const b2 = rn.calls.filter((c) => c.agent.role === "build")[1]!.prompt, v2 = rn.calls.filter((c) => c.agent.role === "review")[1]!.prompt;
    t("F19", "a finished request is marked satisfied; a fresh session gets it under ALREADY DONE (do not redo/undo) and only the new request as work",
      ctx.store.requests.find((r) => r.id === "R1")!.status === "satisfied" && b2.includes("ALREADY DONE EARLIER") && /ALREADY DONE EARLIER[^]*R1 original/.test(b2) && /REQUESTS TO DO NOW:\nR2/.test(b2) && /REQUESTS TO CHECK NOW:\nR2/.test(v2) && !/REQUESTS TO DO NOW:[^]*R1/.test(b2), b2); }
  // F20 the same complaint in other words is still "the same finding"
  { t("F20a", "similar(): the real incident wording (two phrasings of the same index2.html complaint) is recognised as one finding", similar("index2.html is not a byte-exact copy of index.html", "index2.html is not byte-identical to index.html"), "");
    t("F20b", "similar(): precise cases", similar("trim is missing", "The trim step is missing here") && !similar("remove the footer", "add a header") && !similar("index.html missing", "style.css missing") && !similar("", "x"), "");
    const rn = new ScriptRunner(script({ review: (r) => ({ pass: false, findings: [{ text: r === 1 ? "trim is missing" : "The trim step is still missing here" }] }) })), ctx = mkCtx(rn); ctx.store.addRequest("t", "R1");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    t("F20", "a reviewer that rewords the same complaint each round is caught as stuck in round 2 (not only after max rounds)", r.status === "waiting_person" && r.reason.startsWith("stuck") && r.rounds === 2, `${r.status} ${r.reason} rounds=${r.rounds}`); }
  // F21 a build that deletes a file nobody asked to delete gets it restored, deterministically
  { const d = mkRepo({ "index.html": "<html>1</html>\n", "notes.txt": "keep me\n" }); const rn = new ScriptRunner(script({ review: () => ({ pass: true }), build: (r, w) => { if (r === 1) execFileSync("git", ["-C", w, "rm", "-q", "notes.txt"]); } })), ctx = mkCtx(rn);
    ctx.store.addRequest("t", "tidy the page title in index.html");
    const r = await runTask({ ctx, pipeline: pl, task_id: "t", cwd: d });
    t("F21", "a tracked file deleted without a request is restored at once (event + audit finding), whatever the model said", existsSync(join(d, "notes.txt")) && ctx.store.evs("guard.restored").length === 1 && ctx.store.findings.some((f) => f.source === "guard"), `${r.status} restored=${ctx.store.evs("guard.restored").length}`);
    rm(d);
    const d2 = mkRepo({ "old.txt": "x\n" }); const rn2 = new ScriptRunner(script({ review: () => ({ pass: true }), build: (r, w) => { if (r === 1) execFileSync("git", ["-C", w, "rm", "-q", "old.txt"]); } })), ctx2 = mkCtx(rn2);
    ctx2.store.addRequest("t", "please delete old.txt");
    await runTask({ ctx: ctx2, pipeline: pl, task_id: "t", cwd: d2 });
    t("F21b", "but a deletion that a request asks for is allowed", !existsSync(join(d2, "old.txt")) && ctx2.store.evs("guard.restored").length === 0, ""); rm(d2); }
  // F22 an agent that is stuck stops and asks; the person answers; the SAME agent continues
  { const calls = { n: 0 }; const rn = new ScriptRunner((c: RunCall) => { if (c.agent.role === "build") { calls.n++; if (calls.n === 1) return "NEEDS_PARENT: which file name do you want? I found a.js and b.js."; return `done\nREPORT: {"summary":"built","files":["a.js"]}`; } return script({ review: () => ({ pass: true }) })(c); }), ctx = mkCtx(rn);
    ctx.store.addRequest("t", "R1 make the page");
    const r1 = await runTask({ ctx, pipeline: pl, task_id: "t", cwd });
    const askedRow = ctx.store.agentsOf("t").find((a) => a.name === "builder")!;
    ctx.store.addRequest("t", "R2 use a.js");   // the person is the parent: the answer is a new message
    const r2 = await runTask({ ctx, pipeline: pl, task_id: "t", cwd }), builds = rn.calls.filter((c) => c.agent.role === "build");
    t("F22", "STAGED: a builder that replies NEEDS_PARENT: stops the loop and asks the person (waiting_person, with the question; no review runs on an unfinished build); after the answer the SAME builder session continues and the task finishes",
      r1.status === "waiting_person" && /^needs_parent: builder#1 asks: which file name/.test(r1.reason) && !rn.calls.slice(0, builds.length + 1).some((c) => c.agent.role === "review") && r2.status === "done" && builds.length === 2 && builds[1]!.session.resume && builds[1]!.session.id === builds[0]!.session.id && !!askedRow.session_id, `${r1.status} ${r1.reason.slice(0, 90)} | ${r2.status} | ${rn.calls.map((c) => c.agent.role).join()}`); }
  // F15 parse
  { t("F15", "lastJson: nested braces, braces inside strings, last marker wins, bad json -> null",
      lastJson<{ a: string }>('x VERDICT: {"a":"1"} y VERDICT: {"a":"{2}","b":{"c":[1,2]}}', "VERDICT:")?.a === "{2}" && lastJson("VERDICT: {oops", "VERDICT:") === null && lastJson("nothing", "VERDICT:") === null, ""); }
  { const lines = (await import("node:fs")).readdirSync(join(HARNESS_DIR, "agents", "builder", ".claude")).join(",");
    t("F16", "an agent folder is the standard .claude layout and has no prompt.md", lines.includes("CLAUDE.md") && lines.includes("settings.json") && !existsSync(join(HARNESS_DIR, "agents", "builder", "prompt.md")), lines); }
  rm(cwd);
}

// ---------------- real suite ----------------
const CHECK_JS = `const {slugify}=require('./slug.js');const level=Number(process.argv[2]||1);
const cases=[["Hello World","hello-world"],["  Trim me  ","trim-me"],["A   B","a-b"]];if(level>=2)cases.push(["","untitled"]);
let bad=0;for(const [i,o] of cases){const g=slugify(i);if(g!==o){console.log("FAIL slugify("+JSON.stringify(i)+") = "+JSON.stringify(g)+" expected "+JSON.stringify(o));bad++}}
process.exit(bad?1:0)`;
async function real() {
  setSuite("real (claude -p, persistent sessions, haiku)");
  const runner = new RealRunner(), store = new Store();
  const cwdA = mkRepo({ "check.js": CHECK_JS }), cwdB = mkRepo({});
  const ctx = { store, runner, defs, sessionCap: 3, transcriptExists: (_cwd: string, id: string) => transcriptExistsAnywhere(id) };
  const modeOf = (task: string, name: string) => store.events.filter((e) => e.kind === "agent.start" && e.task_id === task && e.agent_id?.startsWith(name)).map((e) => e.data?.mode).join(">");
  try {
    // ---- task A, request 1
    store.addRequest("A", "Create slug.js (CommonJS) exporting slugify(s): lowercase it, trim it, and replace each run of whitespace with a single dash.");
    const r1 = await runTask({ ctx, pipeline: pl, task_id: "A", cwd: cwdA, checkCmd: "node check.js 1", costCap: 0.6 });
    const chk1 = existsSync(join(cwdA, "slug.js")) ? (await import("node:child_process")).spawnSync("node", ["check.js", "1"], { cwd: cwdA }).status : 99;
    t("R1", "request 1: the loop ends done (or asks a person) and the deterministic check passes on the real files", r1.status === "done" && chk1 === 0, `${r1.status} ${r1.reason} rounds=${r1.rounds} cost=$${r1.cost.toFixed(4)} check=${chk1}`);
    const rowsA = store.agentsOf("A");
    t("R1b", "each role has a persistent session and its transcript file exists on disk", rowsA.length === 3 && rowsA.every((x) => x.session_id && existsSync(transcriptFor(cwdA, x.session_id!))), rowsA.map((x) => `${x.agent_id}:${x.session_id?.slice(0, 6)}:${x.session_id ? existsSync(transcriptFor(cwdA, x.session_id)) : "-"}`).join(" "));
    t("R1c", "the CLI used exactly the session id the harness chose (no id mismatch)", store.evs("session.id_mismatch", "A").length === 0, "");
    const builderSid = roleRow(ctx, "A", "build", cwdA).session_id, plannerSid = roleRow(ctx, "A", "plan", cwdA).session_id;

    // ---- task A, request 2 (a person's follow-up): sessions are resumed and prompts are deltas
    store.addRequest("A", "Also: slugify('') must return 'untitled'.");
    const before = store.evs("agent.start", "A").length;
    const r2 = await runTask({ ctx, pipeline: pl, task_id: "A", cwd: cwdA, checkCmd: "node check.js 2", costCap: 0.6 });
    const chk2 = (await import("node:child_process")).spawnSync("node", ["check.js", "2"], { cwd: cwdA }).status;
    t("R2", "request 2 (follow-up): done and the stricter check passes", r2.status === "done" && chk2 === 0, `${r2.status} ${r2.reason} rounds=${r2.rounds} cost=$${r2.cost.toFixed(4)} check=${chk2}`);
    const b = roleRow(ctx, "A", "build", cwdA);
    t("R2b", "the builder and planner kept their sessions (resumed, same id)", b.session_id === builderSid && roleRow(ctx, "A", "plan", cwdA).session_id === plannerSid && b.resume_count >= 1, `builder modes: ${modeOf("A", "builder")}; planner: ${modeOf("A", "planner")}`);
    const starts = store.evs("agent.start", "A").slice(before);
    const firstLen = store.evs("agent.start", "A").find((e) => (e.agent_id ?? "").startsWith("planner"))!.data!.prompt_chars as number;
    const resumedLen = starts.find((e) => (e.agent_id ?? "").startsWith("planner"))!.data!.prompt_chars as number;
    t("R2c", "the follow-up prompt to the planner is shorter than its first brief (delta only)", resumedLen < firstLen, `first=${firstLen} resumed=${resumedLen}`);
    // memory probe: ask the builder, with no tools, what request 1 said. Only its session can know the word CommonJS.
    const probe = await callAgent(ctx as never, b, cwdA, () => "Without using any tools, answer from memory of THIS conversation only: quote the first six words of request R1.");
    t("R2d", "context kept: the builder recalls request 1 from its own session", probe.ok && /Create slug\.js/i.test(probe.reply) && /CommonJS/i.test(probe.reply), probe.reply.slice(0, 200));

    // ---- best effort: a check the builder is NOT told about, so the reviewer/check may send the work around the loop once
    const cwdC = mkRepo({ "check.js": `const {norm}=require('./util.js');const c=[["  Hello  ","hello"],["A   B","a b"],["X","x"]];let bad=0;for(const [i,o] of c){const g=norm(i);if(g!==o){console.log("FAIL norm("+JSON.stringify(i)+") = "+JSON.stringify(g)+" expected "+JSON.stringify(o));bad++}}process.exit(bad?1:0)` });
    try {
      store.addRequest("C", "Create util.js (CommonJS) exporting norm(s): lowercase it and trim it.");
      const rC = await runTask({ ctx, pipeline: pl, task_id: "C", cwd: cwdC, checkCmd: "node check.js", hideCheckFromBuilder: true, costCap: 0.6, maxRounds: 3 });
      const chkC = existsSync(join(cwdC, "util.js")) ? (await import("node:child_process")).spawnSync("node", ["check.js"], { cwd: cwdC }).status : 99;
      const bC = store.agentsOf("C").find((x) => x.name === "builder")!;
      const looped = rC.rounds > 1;
      t("R4", `issue loop with real agents (${looped ? "the loop ran " + rC.rounds + " rounds, ended " + rC.status + ": " + rC.reason.slice(0, 40) : "no issue arose: the builder passed first time, loop not exercised"})`,
        ["done", "waiting_person"].includes(rC.status) && (rC.status !== "done" || chkC === 0) && (!looped || (modeOf("C", "planner").includes("resumed") && (rC.status === "waiting_person" ? /conflicts_with_request|needs_person|stuck|max_rounds/.test(rC.reason) : bC.resume_count >= 1 && modeOf("C", "builder").includes("resumed")))),
        `${rC.status} ${rC.reason} rounds=${rC.rounds} check=${chkC} builder modes=${modeOf("C", "builder")} findings=${JSON.stringify(store.findingsOf("C").map((f) => [f.id, f.source, f.status]))}`);
    } finally { rmSync(projectDirFor(cwdC), { recursive: true, force: true }); rm(cwdC); }

    // ---- task B on its own: must not see task A
    store.addRequest("B", "Create add.js (CommonJS) exporting add(a,b) that returns a+b.");
    const rB = await runTask({ ctx, pipeline: pl, task_id: "B", cwd: cwdB, checkCmd: `node -e "process.exit(require('./add.js').add(2,3)===5?0:1)"`, costCap: 0.6 });
    const rowsB = store.agentsOf("B");
    t("R3", "task B runs on its own and finishes", rB.status === "done", `${rB.status} ${rB.reason} cost=$${rB.cost.toFixed(4)}`);
    t("R3b", "task B sessions differ from task A's", rowsB.length === 3 && !rowsB.some((x) => rowsA.some((y) => y.session_id === x.session_id)), "");
    const bB = roleRow(ctx, "B", "build", cwdB);
    const leak = await callAgent(ctx as never, bB, cwdB, () => "Without using any tools, answer from memory of THIS conversation only: what is the name of the function in request R1? Reply with one word.");
    t("R3c", "no leak: task B's builder knows add and has never heard of slugify", leak.ok && /add/i.test(leak.reply) && !/slug/i.test(leak.reply), leak.reply.slice(0, 120));
    const cost = store.reports.reduce((s, r) => s + r.cost, 0);
    console.log(`\nreal suite cost ~ $${cost.toFixed(4)}; calls=${runner.calls.length}`);
  } finally {
    for (const d of [cwdA, cwdB]) { rmSync(projectDirFor(d), { recursive: true, force: true }); rm(d); }
  }
}

// ---------------- the index2.html incident (task 01a1a6a8): a one-line follow-up that the review used to undo ----------------
const INDEX_HTML = `<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Acme Home</title></head>\n<body>\n<header><h1>Acme</h1><p>Tools for small teams.</p></header>\n<section id="features"><h2>Features</h2><ul><li>Fast</li><li>Simple</li><li>Cheap</li></ul></section>\n<footer>2026 Acme</footer>\n</body>\n</html>\n`;
const FOLLOWUP = "can you copy index.html -> index2.html so i have an safty";
const same = (a: string, b: string) => existsSync(a) && existsSync(b) && readFileSync(a, "utf8") === readFileSync(b, "utf8");
async function index2Case() {
  setSuite("real: the index2.html incident (follow-up copy request; the old review undid it)");
  const mk = () => mkRepo({ "index.html": INDEX_HTML }), seedReq = (s: Store) => s.addRequest("I", "Create index.html: a small company home page with a header, a features list and a footer.", "satisfied");   // finished in an earlier run, as in the incident
  const defsI = loadDefs();
  // I1: natural run, real planner/builder/reviewer
  { const cwd = mk(), store = new Store(), runner = new RealRunner();
    const ctx = { store, runner, defs: defsI, sessionCap: 3, transcriptExists: (_c: string, id: string) => transcriptExistsAnywhere(id) };
    try {
      seedReq(store); store.addRequest("I", FOLLOWUP);
      const r = await runTask({ ctx, pipeline: pl, task_id: "I", cwd, tier: 1, costCap: 0.5 });
      const reviewerPrompt = runner.calls.find((c) => c.agent.role === "review")?.prompt ?? "";
      const parts = { done: r.status === "done", copy: same(join(cwd, "index.html"), join(cwd, "index2.html")), idxUntouched: readFileSync(join(cwd, "index.html"), "utf8") === INDEX_HTML, reviewerTold: reviewerPrompt.includes("index2.html") };
      t("I1", "natural run: index2.html is an exact copy, index.html untouched, the loop ends done, the REVIEWER was told the follow-up request",
        r.status === "done" && same(join(cwd, "index.html"), join(cwd, "index2.html")) && readFileSync(join(cwd, "index.html"), "utf8") === INDEX_HTML && reviewerPrompt.includes("index2.html"),
        `${JSON.stringify(parts)} ${r.status} ${r.reason} rounds=${r.rounds} cost=$${r.cost.toFixed(4)} ${renderSummary(store, "I")} STAGES[${spans(store, "I").map((x) => x.agent_id.split("#")[0] + " " + (x.ms / 1000).toFixed(1) + "s").join(", ")}] findings=${JSON.stringify(store.findingsOf("I").map((f) => [f.id, f.status, f.text.slice(0, 60)]))}`);
      // I1b: a later message continues the SAME builder session (the one that did the copy)
      const bBefore = roleRow(ctx, "I", "build", cwd), sidBefore = bBefore.session_id;
      store.addRequest("I", "Also change the <title> of index2.html to Backup copy. Do not touch index.html.");
      const r2 = await runTask({ ctx, pipeline: pl, task_id: "I", cwd, tier: 1, costCap: 0.5 });
      const b = roleRow(ctx, "I", "build", cwd);
      const probe = await callAgent(ctx as never, b, cwd, () => "Without using any tools, answer from memory of THIS conversation: what did the follow-up request ask you to copy, and to what name? One line.");
      t("I1b", "a later message continues the SAME builder (same session id, resumed): it edited only index2.html and still remembers the copy request",
        r2.status === "done" && b.session_id === sidBefore && b.resume_count >= 1 && /Backup copy/.test(readFileSync(join(cwd, "index2.html"), "utf8")) && readFileSync(join(cwd, "index.html"), "utf8") === INDEX_HTML && /index2/.test(probe.reply) && /index\.html/.test(probe.reply),
        `${r2.status} resume_count=${b.resume_count} probe="${probe.reply.slice(0, 100)}"`);
      const board = store.agentsOf("I").map((a) => `${a.agent_id} status=${a.status} session=${a.session_id?.slice(0, 6)} resumed=${a.resume_count}x last_report=${a.last_report_id}`);
      t("I1c", "the agent status and work can be read back at any time (registry rows + reports)", board.length >= 2 && store.reports.length >= 4 && store.agentsOf("I").every((a) => a.status === "idle" && a.session_id), renderTree(store, "I"));
    } finally { rmSync(projectDirFor(cwd), { recursive: true, force: true }); rm(cwd); } }
  // I2: replay the old bad review against REAL planner and builder (3 tries: the planner is a model)
  let safe = 0; const why: string[] = [];
  for (let k = 1; k <= 3; k++) {
    const cwd = mk(), store = new Store();
    const badReview = () => `VERDICT: ${JSON.stringify({ pass: false, findings: [
      { text: "index2.html was added but the task never asked for a second page or a backup. Drop index2.html from the commit.", severity: "major" },
      { text: "index.html has invented marketing claims in the features list; remove or soften them.", severity: "major" }] })}`;
    const runner = new MixedRunner(new RealRunner(), { review: badReview });
    const ctx = { store, runner, defs: defsI, sessionCap: 3, transcriptExists: (_c: string, id: string) => transcriptExistsAnywhere(id) };
    try {
      seedReq(store); store.addRequest("I", FOLLOWUP);
      const r = await runTask({ ctx, pipeline: pl, task_id: "I", cwd, tier: 1, costCap: 0.5, maxRounds: 3 });
      const kept = existsSync(join(cwd, "index2.html")) && same(join(cwd, "index.html"), join(cwd, "index2.html")), idxOk = readFileSync(join(cwd, "index.html"), "utf8") === INDEX_HTML;
      const builds = runner.calls.filter((c) => c.agent.role === "build").length;
      const ok = kept && idxOk && r.status === "waiting_person";
      if (ok) safe++;
      why.push(`#${k}: ${r.status} (${r.reason.slice(0, 70)}) index2 kept=${kept} index.html untouched=${idxOk} builder calls=${builds} files=[${(await import("node:fs")).readdirSync(cwd).filter((f) => !f.startsWith(".")).join(",")}] builder said: ${(store.reports.find((x) => x.role === "build")?.summary ?? "").slice(0, 160).replace(/\n/g, " ")}`);
    } finally { rmSync(projectDirFor(cwd), { recursive: true, force: true }); rm(cwd); }
  }
  t("I2", "replay of the bad review ('drop index2.html' + edit index.html) against real planner/builder: the work is NOT undone and a person is asked (3 tries)", safe === 3, `safe ${safe}/3\n${why.join("\n")}`);
}

await offline();
if (REAL) await real();
if (REAL || process.argv.includes("--index2")) await index2Case();
if (!REAL) console.log("\n(real suite skipped; add --real, or --index2 for the incident case only)");
const failed = writeReport(join(import.meta.dirname, "test_report.md"), "Test 1: loop_ferry_f_1 (no multi-agent)",
  `Harness under test: \`harness/\` (agents/, pipelines/, core/). Offline = scripted agents through the real harness code; real = \`claude -p\` haiku, persistent sessions. ${REAL ? "Real suite included." : "Real suite NOT run."}`);
process.exit(failed ? 1 : 0);
