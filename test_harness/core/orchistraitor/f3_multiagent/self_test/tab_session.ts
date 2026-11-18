// Free of model calls, needs a local Chrome (skips cleanly without one): `tab do` keeps ONE evidence folder, ONE report and ONE video per agent, whatever `--out` names the agent passes,
// and names the pictures itself (number + step name). Found in a real session: `--out sakura` then `--out sakura2` made two reports and two videos, pictures were a.png, b.png, c.png, d.png.
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { MStore } from "../harness/core/board.ts"; import { loadAgents } from "../harness/core/base.ts";
import { results, setSuite, t } from "./lib.ts";
setSuite("tab session: one report, one video, pictures named by the tool");
const HARNESS = join(import.meta.dir, "..", "harness"), chrome = ["google-chrome", "chromium", "chromium-browser"].some((c) => spawnSync("which", [c]).status === 0);
if (!chrome || spawnSync("which", ["ffmpeg"]).status !== 0) { console.log("SKIP: no Chrome or no ffmpeg on this machine"); process.exit(0); }
const dir = mkdtempSync(join(tmpdir(), "tabs-")); mkdirSync(join(dir, "run_test", "demo"), { recursive: true });
writeFileSync(join(dir, "run_test", "demo", "index.html"), '<!doctype html><meta charset=utf-8><h1 id=h>Hello</h1><button id=b onclick="h.textContent=1">Press</button>');
const defs = loadAgents(), st = new MStore(join(dir, "store.json")); const l = st.addAgent("t", defs.get("lead")!, { level: 1 }); l.status = "running"; const q = st.addAgent("t", defs.get("qa-reviewer")!, { level: 2, caller: "lead#1" }); q.status = "running"; st.save();
const env = { ...process.env, HARNESS_STORE: join(dir, "store.json"), HARNESS_TASK: "t", HARNESS_AGENT: q.agent_id, HARNESS_CWD: dir, HARNESS_RUNNER: "real" };
const tool = (...a: string[]) => { const r = spawnSync("bun", ["--smol", join(HARNESS, "tools.ts"), ...a], { env, encoding: "utf8", timeout: 90_000 }); try { return JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}"); } catch { return { raw: r.stdout + r.stderr }; } };
tool("tab", "open", "--url", "file://" + join(dir, "run_test", "demo", "index.html"));
const a = tool("tab", "do", "--out", "first", "--video", "--clear", "--steps", '[{"name":"start","shot":"a.png"},{"click":"#b","wait":200},{"name":"after click","shot":true}]');
const b = tool("tab", "do", "--out", "second", "--steps", '[{"name":"again","shot":"d.png"}]');
const c = tool("tab", "do", "--steps", '[{"name":"third"}]');
const closed = tool("tab", "close");
const folders = readdirSync(join(dir, "qa")), files = readdirSync(join(dir, "qa", folders[0]!));
t("ts.1", "three scripts, two of them with a different --out, end in ONE folder (named for the agent) with ONE report and ONE video", folders.length === 1 && folders[0] === "qa-reviewer-1" && files.filter((f) => f === "index.html").length === 1 && files.filter((f) => f.endsWith(".webm")).length === 1, `folders=${folders} files=${files}`);
t("ts.2", "the step numbers run on across the scripts (one report: 0..4), so the person reads one story", JSON.stringify([...(a.steps ?? []), ...(b.steps ?? []), ...(c.steps ?? [])].map((s: string) => s.split(" ")[0])) === '["0","1","2","3","4","5"]', JSON.stringify([a.steps, b.steps, c.steps]).slice(0, 200));
t("ts.3", "pictures are named by the tool, never by the agent (01_start.png, 03_after-click.png, not a.png), and with pictures OFF a session keeps TWO in all: the third shot (04_again) is not taken", files.filter((f) => f.endsWith(".png")).sort().join() === "01_start.png,03_after-click.png", files.join());
t("ts.6", "the step whose picture was dropped says so in its row (the limit of 2 per session), and still ran", /OK again.*limit of 2 pictures/.test((b.steps ?? [])[0] ?? ""), String((b.steps ?? [])[0]).slice(0, 200));
t("ts.4", "an --out that is not the session folder is answered with a note saying so; no --out gives no note", /was not used/.test(a.folder_note ?? "") && /was not used/.test(b.folder_note ?? "") && !c.folder_note, `${a.folder_note} | ${b.folder_note} | ${c.folder_note}`);
t("ts.5", "tab close waits for the video and says it is final", closed.video_final === true && (closed.videos ?? []).length === 1, JSON.stringify(closed).slice(0, 200));
// ---- the reply lists the pictures; a re-take replaces; browse by QA shares the folder and the cap, no automatic full / section pictures
t("ts.7", "the `tab do` reply LISTS the pictures with full paths (no hunting for a path): after script 1 it names 01_start.png and 03_after-click.png", Array.isArray(a.pictures) && a.pictures.length === 2 && /01_start\.png$/.test(a.pictures[0]) && /03_after-click\.png$/.test(a.pictures[1]), JSON.stringify(a.pictures));
{ tool("tab", "open", "--url", "file://" + join(dir, "run_test", "demo", "index.html"));   // (tab close above closed it)
  const e = tool("tab", "do", "--steps", '[{"name":"start","shot":true}]');   // the SAME step name again: a re-take
  const pics = readdirSync(join(dir, "qa", folders[0]!)).filter((f) => f.endsWith(".png")).sort();
  t("ts.8", "a re-take with the SAME step name REPLACES the first picture (still two pictures in all, the old 01_start.png is gone, the new one is there)", pics.length === 2 && pics.some((f) => /_start\.png$/.test(f)) && !pics.includes("01_start.png"), pics.join() + " | " + JSON.stringify(e.pictures)); }
{ const br = tool("browse", "--file", "run_test/demo/index.html", "--shots", "sk", "--steps", '[{"name":"another","shot":"x.png"}]');
  const all = readdirSync(join(dir, "qa")), inFolder = readdirSync(join(dir, "qa", folders[0]!)).filter((f) => f.endsWith(".png"));
  t("ts.9", "`browse` by a QA agent goes to the SAME session folder (no separate browse folder), adds NO automatic full-page / section pictures, and respects the two-picture limit", !all.includes("browse") && all.length === 1 && !inFolder.some((f) => /^sk-/.test(f)) && inFolder.length <= 2, `qa folders=${all} pictures=${inFolder} ok=${br.ok}`); }
const bad = results.filter((x) => !x.ok).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
