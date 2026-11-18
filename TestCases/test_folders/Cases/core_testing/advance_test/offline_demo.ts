// OFFLINE run of adv_4 (build a page, QA it with a recorded video): no model, no lead. It drives the same FixtureGate the real run uses, and writes into the real per-session layout:
//   test_harness/.state/v1/t_adv_4_qa_video_offline/{store,workspace}      bun TestCases/test_folders/Cases/core_testing/advance_test/offline_demo.ts
//     store/store.json(.board)   the registry and the fixture_sessions table      store/record/*.json  the session record      store/qa/<id>/qa.webm|png|json  the VIDEO
//     workspace/run_test/qa-demo/index.html   what the builder fixture wrote
// Needs the QA image (bun test_harness/infra/qa/run_qa.ts --build). Run again = a fresh folder (the old one is replaced).
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { recordSession } from "../../../../../test_harness/infra/record_session.ts";
import { qaImageReady } from "../../../../../test_harness/infra/qa/run_qa.ts";
import { MStore, FixtureGate } from "../../../../../test_harness/core/orchestrator.ts";

if (!qaImageReady()) { console.log("image agent-testing-qa:1 is missing: bun test_harness/infra/qa/run_qa.ts --build"); process.exit(1); }
const task = "t_adv_4_qa_video_offline", home = resolve(import.meta.dir, "../../../../../test_harness/.state/v1", task);
rmSync(home, { recursive: true, force: true }); mkdirSync(join(home, "store"), { recursive: true }); mkdirSync(join(home, "workspace"), { recursive: true });
const store = new MStore(join(home, "store", "store.json")), gate = new FixtureGate({ run: async () => { throw new Error("no real call in an offline demo"); } } as never, () => store, 4);
let n = 0; const ask = (role: string, prompt: string) => gate.run({ agent: { name: role, fixtures: true }, row: { task_id: task, agent_id: `${role}#1`, caller_agent_id: "lead", parent_session_id: "offline", last_call_id: "c" + ++n }, cwd: join(home, "workspace"), prompt, session: { id: "u" + n, resume: false } } as never);
const b = await ask("builder", "Build the slug demo page in run_test/qa-demo: one index.html with an input that shows the slug and a Clear button. PLAN.md: single self-contained file, no packages. Report what you wrote.");
const q = await ask("qa-reviewer", "QA the page in run_test/qa-demo in a real browser and record a video. Tell me where the video is.");
const video = q.reply.match(/VIDEO: (\S+)/)?.[1] ?? "";
const where = await recordSession({ store: store as never, suite: "advance_test", caseId: "adv_4_qa_video", title: "offline demo through the gate", task, status: b.ok && q.ok && existsSync(video) ? "pass" : "fail", cost: 0, repo: join(home, "workspace"), localDir: join(home, "store", "record"),
  turns: [{ turn: 1, user: "(offline demo)", expected: ["adv-qa-build", "adv-qa-video"], actual: ["new:builder", "new:qa-reviewer"], reply: q.reply.split("\n")[0] }] });
console.log(`builder ok=${b.ok}  qa ok=${q.ok}\nsession folder : ${home}\nvideo          : ${video}\nrecord         : ${where}`);
