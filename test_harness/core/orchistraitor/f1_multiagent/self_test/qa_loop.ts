// Free test of the QA repair loop (no Docker, no model): bun self_test/qa_loop.ts
import { MAX_SAME, emptyState, giveUp, qaFailed, recordCheck, signature } from "../harness/core/qa_loop.ts";
let bad = 0; const ok = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}  ${n}`); if (!c) bad++; };
const e = (l: number) => `src/App.tsx(${l},46): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`;
ok("line numbers do not change the issue", signature("typecheck", [e(3)]) === signature("typecheck", [e(9)]));
ok("another message is another issue", signature("typecheck", [e(3)]) !== signature("typecheck", ["src/App.tsx(3,1): error TS2304: Cannot find name 'x'."]));
{ const s = emptyState(); const r = [1, 2, 3].map((l) => recordCheck(s, { ok: false, stage: "typecheck", reasons: [e(l)] }));
  ok(`same issue: 1, 2, then stop at ${MAX_SAME}`, r[0]!.n === 1 && r[1]!.n === 2 && r[2]!.n === 3 && !r[0]!.stop && !r[1]!.stop && r[2]!.stop && s.status === "stopped" && qaFailed(s)); }
{ const s = emptyState(); recordCheck(s, { ok: false, stage: "typecheck", reasons: [e(1)] }); recordCheck(s, { ok: false, stage: "typecheck", reasons: [e(1)] });
  const r = recordCheck(s, { ok: false, stage: "smoke", reasons: ["page error: ReferenceError x"] });
  ok("a DIFFERENT issue starts again at 1 and does not stop", r.n === 1 && !r.stop && s.status === "open"); 
  const r2 = recordCheck(s, { ok: false, stage: "typecheck", reasons: [e(1)] }); ok("the old issue coming back is not 'in a row': count restarts", r2.n === 1 && !r2.stop); }
{ const s = emptyState(); recordCheck(s, { ok: false, stage: "typecheck", reasons: [e(1)] }); recordCheck(s, { ok: true, stage: "smoke", reasons: [] }); ok("a pass marks it fixed", s.status === "fixed"); }
{ const s = emptyState(); giveUp(s, "pre-existing errors in the fixture"); ok("give up fails the test at once", qaFailed(s) && s.status === "gave_up"); }
process.exit(bad ? 1 : 0);
