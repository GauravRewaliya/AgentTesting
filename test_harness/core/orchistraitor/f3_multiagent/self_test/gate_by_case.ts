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
const bad = results.filter((x) => !x.ok).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
