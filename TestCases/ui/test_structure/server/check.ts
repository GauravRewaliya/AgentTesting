// Structural checks on the REAL data. Run: bun server/check.ts   (exit 1 on a structural failure).
// FAIL = the mapping or layout is broken. WARN = real findings about the fixtures/harness, listed so you can act on them.
import { buildCards } from "./chains.ts";
import { buildModel } from "./model.ts";
import { casesForResponse, guardCases } from "./subagents.ts";
import { layout } from "../src/components/flow/layout.ts";
import { agentDefs } from "./data.ts";
import { branchWarnings } from "../../../branch.ts";

const m = await buildModel(), cards = buildCards(m);
let fails = 0; const warns: string[] = [];
const ok = (name: string, pass: boolean, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass || !detail ? "" : "\n        " + detail}`); if (!pass) fails++; };

// 1. cases and links
const placed = cards.flatMap((c) => c.cases.map((k) => k.caseId));
ok("every case is in exactly one card", placed.length === m.cases.size && new Set(placed).size === m.cases.size, `${placed.length} placed, ${m.cases.size} defined`);
const dangling = [...m.cases].filter(([, c]) => c.raw.after && !m.cases.has(c.raw.after)).map(([id]) => id);
ok("every `after` points at a defined case", !dangling.length, dangling.join(", "));
const cyc = [...m.cases.keys()].filter((id) => { const seen = new Set<string>(); for (let c: string | undefined = id; c; c = m.cases.get(c)?.raw.after) { if (seen.has(c)) return true; seen.add(c); } return false; });
ok("no `after` cycles", !cyc.length, cyc.join(", "));

// 2. layout: strict levels, no overlap
const lay = layout(cards), box = new Map(lay.boxes.map((b) => [b.id, b]));
const badLevel = lay.edges.filter((e) => box.get(e.target)!.level !== box.get(e.source)!.level + 1).map((e) => e.id);
ok("a follow-up is exactly one level below its parent", !badLevel.length, badLevel.join(", "));
const overlaps: string[] = [];
for (let i = 0; i < lay.boxes.length; i++) for (let j = i + 1; j < lay.boxes.length; j++) { const a = lay.boxes[i]!, b = lay.boxes[j]!; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push(`${a.id}/${b.id}`); }
ok(`no two cards overlap (${lay.boxes.length} cards)`, !overlaps.length, overlaps.slice(0, 5).join(", "));
const heads = new Set(cards.filter((c) => !c.parentCard).map((c) => c.id));
ok("every card belongs to a head", cards.every((c) => !c.parentCard || cards.some((p) => p.id === c.parentCard)) && heads.size > 0);

// 2b. profile: the solo / multi-agent tag must agree with how the case is defined
const prof = [...m.cases.keys()].map((id) => ({ id, p: m.profile(id) }));
const soloButDelegates = prof.filter((x) => m.cases.get(x.id)!.raw.router === false && x.p.subAgents.length).map((x) => x.id);
ok("router:false cases expect no sub-agent (solo means the lead works alone)", !soloButDelegates.length, soloButDelegates.join(", "));
const count = (f: (p: (typeof prof)[number]["p"]) => boolean) => prof.filter((x) => f(x.p)).length;
console.log(`      ${count((p) => p.agentMode === "multi")} multi-agent · ${count((p) => p.agentMode === "solo")} solo (${count((p) => p.noDelegate)} of them multi-agent setups that must NOT delegate) · ${count((p) => p.multiPrompt)} multi-prompt · ${count((p) => p.multiSession)} multi-session`);

// 3. sessions and fixtures
const bw = branchWarnings([...m.cases].map(([id, c]) => ({ id, after: c.raw.after, branch_from: (c.raw as { branch_from?: string }).branch_from, branch_auto: (c.raw as { branch_auto?: boolean }).branch_auto })));
for (const w of bw) warns.push(w);
const noOwner = [...m.cases.keys()].flatMap((id) => m.sessionsOf(id)).filter(([, sid]) => !m.owner.has(sid)).map(([l]) => l);
ok("every sub-agent session has one creator case", !noOwner.length, noOwner.join(", "));
const ids = new Set(m.fixtures.map((f) => f.id)), agents = new Set((await agentDefs()).map((a) => a.name));
const missing = [...m.cases].flatMap(([id, c]) => c.raw.turns.flatMap((t) => t.expected.expected_agents_res.filter((e) => !e.startsWith("session:") && !ids.has(e)).map((e) => `${id}→${e}`)));
ok("every expected fixture id exists in TestCases/test_folders/agent_fixture/index.json", !missing.length, missing.join(", "));
const badAgent = m.fixtures.filter((f) => f.agent && !agents.has(f.agent)).map((f) => `${f.id}→${f.agent}`);
ok("every fixture's agent is a defined agent", !badAgent.length, badAgent.join(", "));
const orphans = m.fixtures.filter((f) => m.usage(f.id)!.orphan).map((f) => f.id);
if (orphans.length) warns.push(`unused fixtures (cleanup candidates): ${orphans.join(", ")}`);
const mism = m.fixtures.filter((f) => { const u = m.usage(f.id)!; return u.servedIn.some((s) => !u.expectedBy.some((e) => e.caseId === s.caseId)); }).map((f) => f.id);
if (mism.length) warns.push(`served in a case that does not list them: ${mism.join(", ")}`);

// 4. + / − cases on the real lookup and guard
let pos = 0, posBad: string[] = [], neg = 0, negBad: Record<string, number> = {};
for (const f of m.fixtures) for (const c of await casesForResponse(f.id)) { if (c.kind === "positive") { pos++; if (!c.pass) posBad.push(`${f.id}: ${c.name}`); } else { neg++; if (!c.pass) { const k = c.name.split(" -> ")[0]!; negBad[k] = (negBad[k] ?? 0) + 1; } } }
ok(`all ${pos} positive lookup cases pass`, !posBad.length, posBad.join("\n        "));
for (const a of agents) for (const c of await guardCases(a)) if (!c.pass) { fails++; console.log(`FAIL  guard ${a}: ${c.name}`); }
for (const [n, k] of Object.entries(negBad)) warns.push(`negative lookup case failing on ${k} fixtures: "${n}" (${neg} negative cases run)`);

console.log(warns.length ? "\nWARN\n  " + warns.join("\n  ") : "\nno warnings");
console.log(fails ? `\n${fails} structural failure(s)` : "\nall structural checks pass");
process.exit(fails ? 1 : 0);
