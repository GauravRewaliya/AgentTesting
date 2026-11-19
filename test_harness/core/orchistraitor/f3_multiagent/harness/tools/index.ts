// THE INDEX of the `team` tools (bun harness/tools.ts <command> ...; bin/team and the group wrappers in bin/ call it).
// 1. help is answered here, before anything is loaded (core/help.ts: `team --help`, `team bg --help`, `team bg start --help`).
// 2. ctx.ts reads the environment of this agent once; a slow tool started with --async becomes a background job (below).
// 3. the command goes to ITS group file only (the others are never loaded): read that file to change a command.
//    calls.ts delegate, fork_all, wait ...   plans.ts plan_*, phase_*   board.ts board, bugs, cost, workspace reads
//    ref.ts ref_*, site_*, proto_*           browser.ts browse, tab      bg.ts bg_*, servers, processes
// Shared: ctx.ts (arguments, environment, store), media.ts (QA evidence files), calls_core.ts (granting and running calls).
import { helpFor } from "../core/help.ts";
import { ROUTE } from "./route.ts";

const helpText = helpFor(process.argv.slice(2));
if (helpText !== undefined) { console.log(JSON.stringify({ ok: true, help: helpText })); process.exit(0); }


const { cmd, rest, out, E, HDIR, cwd } = await import("./ctx.ts");
const { spawn } = await import("node:child_process");
const { join } = await import("node:path");
const JOB_COMMANDS = new Set(["ref_capture", "ref_compare", "site_audit", "browse", "tab", "proto_check"]);
if (JOB_COMMANDS.has(cmd ?? "") && rest.includes("--async") && !E.HARNESS_JOB) {   // BACKGROUND JOB: the slow tool runs by itself and this call returns at once; `wait --any --agents job_..` (also with agent ids) hands the result over the moment it is ready
  const jd = join(cwd, "run_test", "_jobs"), { mkdirSync } = await import("node:fs"), id = "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  mkdirSync(jd, { recursive: true });
  const q = (x: string) => "'" + x.replace(/'/g, "'\\''") + "'", args = [cmd!, ...rest.filter((x) => x !== "--async")].map(q).join(" ");
  spawn("sh", ["-c", `bun --smol ${q(join(HDIR, "tools.ts"))} ${args} > ${q(join(jd, id + ".json"))} 2> ${q(join(jd, id + ".err"))}; echo $? > ${q(join(jd, id + ".done"))}`], { detached: true, stdio: "ignore", env: { ...process.env, HARNESS_JOB: id } }).unref();
  out({ ok: true, job_id: id, tool: cmd, status: "running", next: `Keep working. When you need the result: agent wait --any --agents ${id} (it can be mixed with agent ids: it returns the moment the first of them is done).` });
} else if (!cmd || !ROUTE[cmd]) out({ ok: false, reason: `unknown command ${cmd}. Groups: bg, browser, plans, ... try \`team --help\`` });
else await (await import(`./${ROUTE[cmd]}.ts`)).run();
