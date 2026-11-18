// Free check (bun self_test/gate_by_case.ts): the fixture gate serves the ONE result a case expects even when the master's hand-over lacks the case's incidental words (the eg_tw_01 incident),
// and still refuses when it is ambiguous or the hand-over rules fail.
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { MStore } from "../harness/core/board.ts"; import { loadAgents } from "../harness/core/base.ts"; import { FixtureGate } from "../harness/core/fixture_gate.ts"; import { ScriptRunner } from "../harness/core/base.ts";
import { results, setSuite, t } from "./lib.ts";
setSuite("fixture gate: by the case, not by wording");
const defs = loadAgents(), def = defs.get("expo-go")!, dir = mkdtempSync(join(tmpdir(), "gate-")), ID = "role-expo-go-eg_tw_01_0073f46";
const mk = (ids: string[]) => { const st = new MStore(); const lead = st.addAgent("t", defs.get("lead")!, { level: 1 }); const ag = st.addAgent("t", def, { level: 2, cwd: dir }); st.tx(() => st.ev("fixture.mock", "t", "", { roles: ["expo-go"], guard: null, ids })); return { st, gate: new FixtureGate(new ScriptRunner(async () => "real"), () => st), ag, lead }; };
const call = (g: ReturnType<typeof mk>, prompt: string) => g.gate.run({ agent: def, row: g.ag, cwd: dir, prompt, session: { id: "s1", resume: false } } as never);
const GOOD_BUT_PARAPHRASED = `Request from the person: "Create an Expo Router app styled with Tailwind through NativeWind". Work only in run_test/tw-app. Write PLAN.md first, then build it.`;   // has 'tw-app', lacks 'phase 1 of 1'
{ const g = mk([ID]); const r = await call(g, GOOD_BUT_PARAPHRASED); const ev = g.st.evs("fixture.by_case", "t");
  t("gb.1", "the expected result is served although the hand-over lacks 'phase 1 of 1', and `fixture.by_case` says why", r.ok === true && ev.length === 1 && (ev[0]!.data as { result?: string }).result === ID, r.error ?? r.reply.slice(0, 120)); }
{ const g = mk([ID]); const r = await call(g, "Starting point: fixture with-tailwindcss (set up in run_test/tw-app). Phase 1 of 1. Create the app."); t("gb.2", "a hand-over that matches the keywords is served the normal way (no by_case event)", r.ok === true && g.st.evs("fixture.by_case", "t").length === 0); }
{ const g = mk([]); const r = await call(g, GOOD_BUT_PARAPHRASED); t("gb.3", "a case that expects NO result of this role still gets FIXTURE NOT FOUND (nothing is served by guess)", r.ok === false && /FIXTURE NOT FOUND/.test(r.error ?? "")); }
{ const g = mk([ID]); await call(g, GOOD_BUT_PARAPHRASED); const r2 = await call(g, GOOD_BUT_PARAPHRASED + " Another one."); t("gb.4", "the same result is not served twice by the case rule (the second identical call gets no new serve)", g.st.evs("fixture.by_case", "t").length === 1, JSON.stringify(g.st.evs("fixture.call", "t").map((e) => (e.data as { verdict?: string }).verdict))); }
// ---- role order and forbidden instructions with the REAL rules file of the sakura suite (store/sakura_rules.json): qa-reviewer needs the builder served first; a builder is never told to record
const sakuraWorld = () => { const sb = defs.get("builder")!, sq = defs.get("qa-reviewer")!, st = new MStore(); st.addAgent("t", defs.get("lead")!, { level: 1 });
  const ab = st.addAgent("t", sb, { level: 2, cwd: dir }), aq = st.addAgent("t", sq, { level: 2, cwd: dir });
  st.tx(() => st.ev("fixture.mock", "t", "", { roles: ["builder", "qa-reviewer"], guard: "sakura_rules.json", ids: ["role-sakura-builder", "role-sakura-qa-pass"] }));
  const gate = new FixtureGate(new ScriptRunner(async () => "real"), () => st);
  const go = (who: "builder" | "qa", prompt: string) => gate.run({ agent: who === "qa" ? sq : sb, row: who === "qa" ? aq : ab, cwd: dir, prompt, session: { id: "s-" + who + Math.random(), resume: false } } as never);
  const last = () => (st.evs("fixture.call", "t").at(-1)?.data ?? {}) as { verdict?: string; why?: string[] };
  return { go, last };
};
const BUILDER_OK = "Person asked: a famous sakura scene with three.js. You own run_test/sakura (index.html, css/style.css, js/main.js, js/world.js, js/sakura.js). Shared ids: #btn-rot, #btn-time, #btn-wind. Only your files. Quick syntax check only; no video, screenshots, server.";
const QA_OK = "Verify run_test/sakura (three.js sakura, #btn-rot, #btn-time, #btn-wind): loads with no console errors, rotates, petals fall, the buttons work. Record ONE demo video of rotate, day, sunset and the gust, and judge the quality of the sakura look.";
{ const w = sakuraWorld(); await w.go("qa", QA_OK);
  t("gb.5", "role order works in this gate: QA before any builder is served is CORRECTED with 'needs builder done first'", w.last().verdict === "corrected" && (w.last().why ?? []).some((x) => /needs 'builder' done first/.test(x)), JSON.stringify(w.last())); }
{ const w = sakuraWorld(); await w.go("builder", BUILDER_OK + " Also record a demo video of the page and take screenshots.");
  t("gb.6", "a builder hand-over that INSTRUCTS a recording or screenshots is CORRECTED, the reasons name the words (contains_none)", w.last().verdict === "corrected" && (w.last().why ?? []).some((x) => /tells 'builder' to do 'demo video'/.test(x)) && (w.last().why ?? []).some((x) => /'screenshot'/.test(x)), JSON.stringify(w.last()).slice(0, 220)); }
{ const w = sakuraWorld(); const rb = await w.go("builder", BUILDER_OK);
  t("gb.7", "the lead's real builder hand-over (with 'no video, screenshots, server' as a LIMIT) is SERVED", w.last().verdict === "served" && rb.ok === true, JSON.stringify(w.last()).slice(0, 160)); }
{ const w = sakuraWorld(); await w.go("builder", BUILDER_OK); const rq = await w.go("qa", QA_OK);
  t("gb.8", "after the builder was served, the QA hand-over (what to record, not how) is SERVED", w.last().verdict === "served" && rq.ok === true, JSON.stringify(w.last()).slice(0, 160)); }
{ const w = sakuraWorld(); await w.go("builder", BUILDER_OK); await w.go("qa", QA_OK + " Use playwright via pnpm dlx and convert the video with ffmpeg.");
  t("gb.9", "a QA hand-over that dictates HOW (playwright, pnpm dlx, ffmpeg) is CORRECTED, with the words named", w.last().verdict === "corrected" && (w.last().why ?? []).some((x) => /tells 'qa-reviewer' to do 'playwright'/.test(x)) && (w.last().why ?? []).some((x) => /'ffmpeg'/.test(x)), JSON.stringify(w.last()).slice(0, 220)); }
const bad = results.filter((x) => !x.ok).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
