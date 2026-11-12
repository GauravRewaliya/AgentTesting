// Checks for the console (ui/server.ts) and the wiring bugs found while using it. Fake runner, throwaway store, no model calls.
//   ../limited.sh bun self_test/ui_checks.ts        every failure is printed loudly and the exit code is 1
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ScriptRunner, callAgent, findTranscript, loadAgents } from "../harness/core/base.ts";
import { MStore } from "../harness/core/board.ts";
import { runLead } from "../harness/lead.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), ".."), results: { id: string; ok: boolean; what: string; detail?: string }[] = [];
const t = (id: string, what: string, ok: boolean, detail?: string) => { results.push({ id, ok, what, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${what}${!ok && detail ? "\n        " + detail : ""}`); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dir = mkdtempSync(join(tmpdir(), "uichk-"));
const defs = loadAgents(join(ROOT, "harness", "agents"));
let port = 5300 + Math.floor(Math.random() * 400);

async function server(name: string, env: Record<string, string> = {}) {
  const p = ++port, store = join(dir, name + ".json"), repo = join(dir, name + "-repo");
  const child = spawn("bun", [join(ROOT, "ui", "server.ts")], { env: { ...process.env, UI_PORT: String(p), UI_STORE: store, UI_REPO: repo, UI_RUNNER: "fake", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; child.stdout.on("data", (d) => (log += d)); child.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${p}/api/state`)).ok) break; } catch { /* not up yet */ } await sleep(100); }
  const hd = (task?: string) => (task ? { "x-session": task } : {});
  const get = async (path: string, task?: string) => (await fetch(`http://127.0.0.1:${p}${path}`, { headers: hd(task) })).json() as Promise<any>;
  const post = async (path: string, body: unknown, task?: string) => (await fetch(`http://127.0.0.1:${p}${path}`, { method: "POST", headers: { "content-type": "application/json", ...hd(task) }, body: JSON.stringify(body) })).json() as Promise<any>;
  return { get, post, store, log: () => log, stop: () => child.kill("SIGKILL") };
}

try {
  // UI1: the master is GIVEN the roles it may call (it once guessed "build"; the launch copy was built but never used)
  {
    const seen: string[] = [];
    const store = new MStore(join(dir, "wire.json"));
    await runLead({ store, defs, sessionCap: 3, runner: new ScriptRunner((c) => { seen.push(readFileSync(c.agent.prompt_file, "utf8")); return "ok"; }) } as never, { task_id: "w", repo: dir, request: "hi", maxDepth: 4, runner: "fake" });
    t("UI1", "the master's prompt file lists the roles it may call (researcher, builder...) and how to call them", /Sub-agents you may call/.test(seen[0] ?? "") && /builder/.test(seen[0] ?? ""), (seen[0] ?? "(no prompt)").slice(-300));
    const off = []; const store2 = new MStore(join(dir, "wire2.json"));
    await runLead({ store: store2, defs, sessionCap: 3, runner: new ScriptRunner((c) => { off.push(readFileSync(c.agent.prompt_file, "utf8")); return "ok"; }) } as never, { task_id: "w2", repo: dir, request: "hi", maxDepth: 1, runner: "fake" });
    t("UI2", "with multi-agent off (depth 1) the master is not shown any sub-agents", !/Sub-agents you may call/.test(off[0] ?? ""));
  }

  // UI3-5: nothing the person writes or reads is cut; the queue sits BELOW the conversation; sessions do not mix
  {
    const s = await server("chat");
    const big = "y".repeat(100_000);
    await s.post("/api/chat", { text: big }); await sleep(2500);
    let st = await s.get("/api/state");
    t("UI3", "a 100,000-character message is stored whole (it used to be cut at 400)", st.chat[0]?.text.length === 100_000, `length ${st.chat[0]?.text.length}`);

    await s.post("/api/chat", { text: "one" });
    const q2 = await s.post("/api/chat", { text: "two" }); const q3 = await s.post("/api/chat", { text: "three" });
    st = await s.get("/api/state");
    t("UI4", "while the master is busy, new messages wait in the queue and are NOT in the conversation yet", st.chat.filter((m: any) => m.from === "user").map((m: any) => m.text).join() === ["y".repeat(100_000), "one"].join() && st.master_detail.queued.length === 2, JSON.stringify(st.master_detail.queued.map((q: any) => q.text)));
    const c = await s.post("/api/chat/cancel", { id: q3.id });
    await sleep(5500); st = await s.get("/api/state");
    const order = st.chat.map((m: any) => m.from[0]).join("");
    t("UI5", "a cancelled queued message never reaches the master; the rest are answered one by one, each reply right under its question", c.ok && order === "ulululul".slice(0, 6) && !st.chat.some((m: any) => m.text === "three") && st.master_detail.queued.length === 0, `order ${order}, cancel ${JSON.stringify(c)}, q2 ${q2.queued}`);

    const sentAt = st.chat.filter((m: any) => m.from === "user").map((m: any) => m.t);
    t("UI18", "every message carries its time: a queued message keeps the time it was SENT (not the time the master picked it up), and replies come after the question", sentAt.length >= 2 && sentAt.every((x: number, i: number) => i === 0 || x >= sentAt[i - 1]) && st.chat.every((m: any) => typeof m.t === "number" && m.t > 1e12), JSON.stringify(sentAt));
    const first = st.task, other = (await s.post("/api/session", { action: "new" })).task;
    const fresh = await s.get("/api/state", other);
    await s.post("/api/chat", { text: "other session" }, other); await sleep(2500);
    const back = await s.get("/api/state", first);
    t("UI6", "sessions keep separate chats (a new session starts empty; the first one is unchanged)", fresh.chat.length === 0 && fresh.known === false && !back.chat.some((m: any) => m.text === "other session") && back.chat.length > 0);
    const A = await s.get("/api/state", first), Bs = await s.get("/api/state", other), A2 = await s.get("/api/state", first);
    t("UI11", "two browser tabs on two sessions do not fight: each request returns the session ITS tab asked for, in any order (the server used to keep one global 'current session')", A.task === first && Bs.task === other && A2.task === first && A.chat.length !== Bs.chat.length, `${A.task} ${Bs.task} ${A2.task}`);
    const ghost = await s.get("/api/state", "nosuchsession");
    t("UI12", "an unknown session id is reported as not known (so a mistyped link is not shown as an empty real session)", ghost.known === false && ghost.chat.length === 0);

    const refused = await fetch(`http://127.0.0.1:${port}/api/chat`, { method: "POST", body: JSON.stringify({ text: "x" }) });
    t("UI7", "a POST without a JSON content type is refused (a web page on another site cannot drive the console)", refused.status === 403, `status ${refused.status}`);
    s.stop();
  }

  // UI8-10: after a restart nothing stays "running" without a process, and it is SAID in the chat; a live process is left alone
  {
    const SID = "eeeeeeee-0000-0000-0000-00000000000a";
    const store = new MStore(join(dir, "stale.json"));
    store.tx(() => {
      const lead = store.addAgent("T", defs.get("lead")!, { level: 1, cwd: dir }); lead.status = "running"; lead.session_id = "eeeeeeee-0000-0000-0000-00000000000b";
      const dead = store.addAgent("T", defs.get("builder")!, { caller: lead.agent_id, level: 2, type: "call" }); dead.status = "running"; dead.session_id = "eeeeeeee-0000-0000-0000-00000000000c";
      const live = store.addAgent("T", defs.get("researcher")!, { caller: lead.agent_id, level: 2, type: "call" }); live.status = "running"; live.session_id = SID;
    });
    store.tx(() => { store.runs.push({ id: "run_x", task_id: "T", title: "T", repo: dir, status: "active", main_agent_id: "lead#1", main_session_id: null, pm_agent_id: null, pm_session_id: null, plan_ids: [], config: { maxDepth: 4, runner: "fake", locks: "store", strict: false, canary: false, sessionCap: 8 }, created_at: Date.now(), last_active_at: Date.now(), resumed_count: 0, harness_version: "t" } as never); });
    const stand = spawn("bash", ["-c", `exec -a 'claude -p x --session-id ${SID}' sleep 60`], { stdio: "ignore" });
    await sleep(300);
    const s = await server("stale", { UI_STORE: join(dir, "stale.json"), UI_RECONCILE: "1" });
    const st = await s.get("/api/state");   // current session = the most recent run = T
    const by = (id: string) => st.agents.find((a: any) => a.id === id) ?? (st.lead?.id === id ? st.lead : undefined);
    t("UI8", "a master and a sub-agent marked running whose process is gone are marked interrupted at start (they would otherwise show 'working' for ever)", by("lead#1")?.status === "idle" && by("builder#1")?.status === "idle" && /interrupted/.test(by("builder#1")?.activity ?? ""), JSON.stringify([by("lead#1")?.status, by("builder#1")?.status, by("builder#1")?.activity]));
    t("UI9", "a sub-agent whose claude process is still alive is left running", by("researcher#1")?.status === "running", String(by("researcher#1")?.status));
    t("UI10", "the interruption is SAID in the chat, written to problems.log and the console, and shown as a problem", st.chat.some((m: any) => /INTERRUPTED/.test(m.text) && /NOT finished/.test(m.text)) && /PROBLEM .*interrupted/.test(s.log()) && existsSync(join(dir, "stale-data-unused")) === false && st.problems.length > 0, s.log().slice(-300));
    stand.kill("SIGKILL"); s.stop();
  }

  // UI13-15: every agent's log is archived next to the registry; if Claude's copy disappears (a writer's temporary worktree) it is restored on resume; no log at all is SAID
  {
    const home = join(dir, "home13"); mkdirSync(join(home, ".claude", "projects"), { recursive: true });
    const oldHome = process.env.HOME; process.env.HOME = home;
    try {
      const store = new MStore(join(dir, "arch.json")), enc = (c: string) => c.replace(/[^a-zA-Z0-9]/g, "-");
      const wt = join(dir, "worktree-1"); mkdirSync(wt, { recursive: true });
      const writeLog = (sid: string, cwd: string, text: string) => { const d = join(home, ".claude", "projects", enc(cwd)); mkdirSync(d, { recursive: true }); writeFileSync(join(d, sid + ".jsonl"), text); };
      const ctx = (script: (c: any) => string) => ({ store, defs, sessionCap: 3, runner: new ScriptRunner(script as never), transcriptExists: (_c: string, id: string) => findTranscript(id) !== null }) as never;
      const row = store.tx(() => store.addAgent("A", defs.get("builder")!, { level: 2, cwd: wt }));
      const out1 = await callAgent(ctx((c) => { writeLog(c.session.id, c.cwd, '{"type":"user"}\n'); return "done"; }), row, wt, () => "go");
      const sid = store.agent("A", row.agent_id)!.session_id!, arch = join(dir, "logs", "A", `${row.agent_id.replace(/\W/g, "_")}.${sid}.jsonl`);
      t("UI13", "after a run the harness keeps its own copy of the agent's log next to the registry, and the agent row points at it", out1.ok && existsSync(arch) && store.agent("A", row.agent_id)!.log_file === arch, `${out1.ok} ${arch}`);
      rmSync(join(home, ".claude", "projects", enc(wt)), { recursive: true, force: true });   // Claude's copy vanishes with the worktree
      let sawResume = "";
      const out2 = await callAgent(ctx((c) => { sawResume = String(c.session.resume); writeLog(c.session.id, c.cwd, '{"type":"user"}\n{"type":"assistant"}\n'); return "again"; }), store.agent("A", row.agent_id)!, wt, () => "more", undefined, { intent: "resume" });
      t("UI14", "Claude's copy is gone, ours exists: the log is restored and the agent RESUMES its session (it does not start blank or crash)", out2.ok && sawResume === "true" && store.events.some((e) => e.kind === "log.restored"), `${out2.ok} resume=${sawResume} ${out2.error ?? ""}`);
      const row2 = store.tx(() => store.addAgent("A", defs.get("researcher")!, { level: 2, cwd: wt }));
      await callAgent(ctx(() => "no log written"), row2, wt, () => "go");
      t("UI15", "a real run that leaves NO log file raises a log.missing event (loud, never silent)", store.events.some((e) => e.kind === "log.missing" && e.agent_id === row2.agent_id));
    } finally { process.env.HOME = oldHome; }
  }

  // UI16-17: a question nobody answered is NOT "finished": it is shown on the agent AND on its parent, with the same words; a missing parent and a refused call say "Something went wrong"
  {
    const store = new MStore(join(dir, "wait.json"));
    store.tx(() => {
      const lead = store.addAgent("W", defs.get("lead")!, { level: 1, cwd: dir }); lead.status = "idle"; lead.runs = 1;
      const r1 = store.addAgent("W", defs.get("researcher")!, { caller: lead.agent_id, level: 2, type: "call" }); r1.status = "idle"; r1.runs = 1; r1.needs_parent = "Please give me the official URL\nI tried search pages.";
      const orphan = store.addAgent("W", defs.get("researcher")!, { caller: "ghost#9", level: 2, type: "call" }); orphan.status = "idle"; orphan.runs = 1; orphan.needs_parent = "Which database?";
      store.ev("agent.call.denied", "W", lead.agent_id, { role: "build", code: "unknown_role", reason: 'unknown_role: no agent named "build"' });
      store.runs.push({ id: "run_w", task_id: "W", title: "W", repo: dir, status: "active", main_agent_id: lead.agent_id, main_session_id: null, pm_agent_id: null, pm_session_id: null, plan_ids: [], config: { maxDepth: 4, runner: "fake", locks: "store", strict: false, canary: false, sessionCap: 8 }, created_at: Date.now(), last_active_at: Date.now(), resumed_count: 0, harness_version: "t" } as never);
    });
    const s = await server("wait", { UI_STORE: join(dir, "wait.json") });
    const st = await s.get("/api/state", "W"), r1 = st.agents.find((a: any) => a.id === "researcher#1"), txt = st.problems.map((p: any) => p.text);
    t("UI16", "an agent that asked its parent a question shows 'waiting for its parent' (not 'finished'); the PARENT shows the same question; the master card counts it", /^waiting for its parent \(lead#1\): Please give me the official URL/.test(r1?.doing ?? "") && st.problems.some((p: any) => p.agent === "lead#1" && /researcher#1 is waiting for an answer from lead#1: Please give me the official URL/.test(p.text)) && st.master_detail.waiting_on_master === 1, JSON.stringify([r1?.doing, txt]));
    t("UI17", "a parent that no longer exists, and a refused call, are shown as 'Something went wrong' with the real reason", st.problems.some((p: any) => /^Something went wrong: researcher#2 is waiting for its parent ghost#9, which no longer exists/.test(p.text)) && st.problems.some((p: any) => p.agent === "lead#1" && /^Something went wrong: lead#1 could not call build: .*no agent named "build"/.test(p.text)), JSON.stringify(txt));
    s.stop();
  }
} catch (e) {
  t("UI-CRASH", "the checks themselves ran to the end", false, String(e));
} finally {
  spawnSync("pkill", ["-f", `UI_STORE=${dir}`]);
  rmSync(dir, { recursive: true, force: true });
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (bad.length) { console.error(`\n!!!!!! ${bad.length} FAILED: ${bad.map((b) => b.id).join(", ")} !!!!!!`); process.exit(1); }
