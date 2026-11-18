// Free check (bun self_test/writes_relative.ts): an ABSOLUTE path in `--writes` is turned into the workspace-relative one at the call (found in the real run tj_1_full_real: the lock was granted under the absolute path,
// the write guard compares the relative one, the builder was refused its own file twice, stopped twice with NEEDS_PARENT, and the lead replaced it: 97 s and $0.13).
import { mkdirSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; import { spawnSync } from "node:child_process";
import { MStore } from "../harness/core/board.ts"; import { loadAgents } from "../harness/core/base.ts";
import { relWrites } from "../harness/core/rel_writes.ts";
import { guardEdit } from "../harness/core/locks.ts";
import { results, setSuite, t } from "./lib.ts";
setSuite("writes: workspace-relative, whatever the lead typed");
const WS = "/work/space";
t("wr.1", "an absolute path inside the workspace becomes relative; a relative one stays (a leading ./ is dropped); two roots are tried", JSON.stringify(relWrites([`${WS}/run_test/sakura/index.html`, "run_test/a.js", "./run_test/b.js", "/other/root/run_test/c.js"], ["/nope", WS, "/other/root"])) === JSON.stringify(["run_test/sakura/index.html", "run_test/a.js", "run_test/b.js", "run_test/c.js"]), JSON.stringify(relWrites([`${WS}/run_test/x`], [WS])));
t("wr.2", "an absolute path OUTSIDE every root is left as it is (the guard then refuses it, naming it); a folder glob is kept", JSON.stringify(relWrites(["/etc/passwd", "run_test/sakura/**"], [WS])) === JSON.stringify(["/etc/passwd", "run_test/sakura/**"]), "");
// ---- end to end with the real `delegate` command and the fake runner (no model): what is GRANTED is relative, so the guard lets the builder write its file
const dir = mkdtempSync(join(tmpdir(), "wr-")); mkdirSync(join(dir, "run_test", "sakura"), { recursive: true });
const defs = loadAgents(), st = new MStore(join(dir, "store.json")); const lead = st.addAgent("t", defs.get("lead")!, { level: 1 }); lead.status = "running"; st.save();
const env = { ...process.env, HARNESS_STORE: join(dir, "store.json"), HARNESS_TASK: "t", HARNESS_AGENT: lead.agent_id, HARNESS_CWD: dir, HARNESS_RUNNER: "fake", HARNESS_MAX_DEPTH: "4" };
const r = spawnSync("bun", ["--smol", join(import.meta.dir, "..", "harness", "tools.ts"), "delegate", "--role", "builder", "--session", "new", "--objective", "write the sakura page", "--output", "files", "--boundaries", "only that file", "--writes", join(dir, "run_test", "sakura", "index.html")], { env, encoding: "utf8", timeout: 60_000 });
const after = new MStore(join(dir, "store.json")); after.reload?.();
const call = after.calls.find((c) => c.role === "builder"), granted = (call?.req?.writes ?? []) as string[];
t("wr.3", "a real `delegate --writes <ABSOLUTE path>` is recorded and granted as the RELATIVE path run_test/sakura/index.html", granted.join() === "run_test/sakura/index.html", `writes=${granted} | ${r.stdout.slice(0, 160)}`);
const lockPaths = after.locks.map((l) => l.path).concat(after.evs("lock.granted").flatMap((e) => ((e.data as { paths?: string[] })?.paths ?? [])));
t("wr.4", "the lock was granted under the relative path too (never the absolute one), so the write guard and the grant agree", lockPaths.length > 0 && lockPaths.every((p) => !p.startsWith("/")), JSON.stringify(lockPaths));
// ---- why the normalisation is needed: the write guard compares the RELATIVE path, so a lock held under the absolute one never matches (the old behaviour), a lock under the relative one does
const { acquire } = await import("../harness/core/locks.ts");
const sA = new MStore(), N = 1000;
acquire(sA, { task_id: "t", agent_id: "builder#1", call_id: "c1", paths: [join(dir, "run_test", "sakura", "index.html")], ttlMs: 60_000, now: N });
const old = guardEdit(sA, "t", "builder#1", "run_test/sakura/index.html", N);
const sB = new MStore(); acquire(sB, { task_id: "t", agent_id: "builder#1", call_id: "c1", paths: relWrites([join(dir, "run_test", "sakura", "index.html")], [dir])!, ttlMs: 60_000, now: N });
const fixed = guardEdit(sB, "t", "builder#1", "run_test/sakura/index.html", N);
t("wr.5", "the old bug is gone from both ends: a lock held under the ABSOLUTE path (what used to answer 'NOT DECLARED' twice) and one held RELATIVE (what relWrites produces) both ALLOW the file", (old as { allow: boolean }).allow === true && (fixed as { allow: boolean }).allow === true, JSON.stringify({ old, fixed }).slice(0, 260));
// ---- defence in depth: a lock stored with an ABSOLUTE path (an older call) still covers the relative file
const sC = new MStore(); acquire(sC, { task_id: "t", agent_id: "builder#9", call_id: "c9", paths: [join(dir, "run_test", "sakura", "index.html")], ttlMs: 60_000, now: N });
const tol = guardEdit(sC, "t", "builder#9", "run_test/sakura/index.html", N), other = guardEdit(sC, "t", "builder#9", "run_test/sakura/other.js", N);
t("wr.6", "the write guard accepts a lock stored with an ABSOLUTE path for the same relative file, and still refuses another file", (tol as { allow: boolean }).allow === true && (other as { allow: boolean }).allow === false, JSON.stringify({ tol, other }).slice(0, 220));
// ---- the hole found by READING locks.ts: overlaps() compared raw prefixes, so one file under two spellings was never seen as one file and two builders could hold it at once
const { overlaps } = await import("../harness/core/locks.ts");
const ABS = join(dir, "run_test", "sakura", "index.html");
t("wr.7", "overlaps() sees one file under two spellings (absolute, ./relative, relative) as ONE file, and still keeps different files apart", overlaps(ABS, "run_test/sakura/index.html") && overlaps("./run_test/sakura/index.html", ABS) && overlaps(join(dir, "run_test", "sakura") + "/**", "run_test/sakura/js/a.js") && !overlaps(ABS, "run_test/sakura/other.html") && !overlaps(ABS, "run_test/other/index.html"), "");
const sD = new MStore();
const first = acquire(sD, { task_id: "t", agent_id: "builder#1", call_id: "c1", paths: [ABS], ttlMs: 60_000, now: N });
const second = acquire(sD, { task_id: "t", agent_id: "builder#2", call_id: "c2", paths: ["run_test/sakura/index.html"], ttlMs: 60_000, now: N });
t("wr.8", "a second builder asking for the SAME file in another spelling is NOT granted while the first holds it (before: both were granted and could write it at once)", (first as { ok: boolean }).ok === true && (second as { ok: boolean }).ok === false, JSON.stringify({ first, second }).slice(0, 220));
const bad = results.filter((x) => !x.ok).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
