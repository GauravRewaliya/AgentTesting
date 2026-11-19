// COMMANDS: bg_* (background tasks), get_public_url, proc_*: servers and host processes. Help text: core/help.ts.
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { cmd, cwd, file, flag, inWs, me, out, projPath, rest, task } from "./ctx.ts";

export const COMMANDS = ["get_public_url", "proc_list", "proc_stop", "bg_start", "bg_use", "bg_list", "bg_log", "bg_stop", "bg_restart"];
export async function run(): Promise<void> {
if (cmd === "get_public_url") {   // PORT -> the address a PERSON's browser can open (localhost works only on this machine): --port <n> [--id <background task id>] [--path /x]. With --id the port is LINKED to that task (bg_list and the UI then show its addresses); with --id alone the task's port is used. Says whether anything answers on the port right now.
  const pv = await import("../core/preview.ts"), bgm = await import("../core/bg.ts"), sdir = dirname(file), id = flag("id"); let port = Number(flag("port") ?? 0), linked: string | undefined;
  if (!port && id) port = bgm.getBg(sdir, id)?.port ?? 0;
  else if (port && id) linked = bgm.linkPort(sdir, id, port) ? id : undefined;
  if (!port) out({ ok: false, reason: "give --port <n> (and --id <background task id> to link it to that task), or --id of a task that has a port" });
  else {
    const path = (flag("path") ?? "").replace(/^(?!\/)(.+)/, "/$1"), local = `http://127.0.0.1:${port}${path}`; let reachable = false;
    try { reachable = (await fetch(local, { signal: AbortSignal.timeout(2500) })).status < 500; } catch { /* nothing there */ }
    out({ ok: true, port, url: local, public_url: `http://${pv.publicHost()}:${port}${path}`, reachable, linked_task: linked, note: reachable ? "Give public_url to the person; url works only on this machine." : "Nothing answers on that port right now: start the server first (`bg start --port auto`) or read `bg log`." });
  }
}
if (cmd === "proc_list" || cmd === "proc_stop") {   // the host processes inside THIS workspace (dev servers, installs, leftover shells): any agent of the team may look at them and stop one (core/procs.ts)
  const pc = await import("../core/procs.ts");
  out(cmd === "proc_list" ? { ok: true, processes: pc.listTaskProcs(cwd) } : pc.stopTaskProc(cwd, Number(flag("pid"))));
}
if (cmd === "bg_start" || cmd === "bg_use" || cmd === "bg_list" || cmd === "bg_log" || cmd === "bg_stop" || cmd === "bg_restart") {
  // BACKGROUND TASKS (core/bg.ts): `cmd &` with a record = a title (kind, default server_run), a description, a status and a log file. ANY command: a dev server, a static server for a wireframe, a back end, a watcher, a long build.
  // The harness does not know or decide what it runs: no project detection, no install, no page check, no time limit unless --timeout. The agent chooses the command and the folder; it looks at a web page with `browse`.
  const bgm = await import("../core/bg.ts"), pv = await import("../core/preview.ts"), sdir = dirname(file), by = flag("by") ?? (me || "agent"), iso = (t?: number) => (t ? new Date(t).toISOString() : undefined);
  const brief = (r: import("../core/bg.ts").BgRow) => ({ id: r.id, title: r.title ?? "server_run", description: r.label, status: r.status, cmd: r.cmd.slice(0, 200), dir: r.dir, pid: r.pid, port: r.port, url: r.port ? `http://127.0.0.1:${r.port}` : undefined, public_url: r.port ? `http://${pv.publicHost()}:${r.port}` : undefined, started: iso(r.started), ended_at: iso(r.ended_at), exit_code: r.exit_code, stopped_by: r.stopped_by, log_file: bgm.bgLogFile(sdir, r.id), log_bytes: r.log_bytes, started_by: r.by, used_by: r.users?.length ? r.users : undefined, separate_reason: r.separate_reason });
  if (cmd === "bg_list") {   // COMPACT rows: what an agent decides with (is it running, where, who started / uses it, what for). The long absolute paths, pid, byte counts and the command repeated three times made one call 21 KB: `bg_log --id <id>` shows the log, `--full` gives every field.
    const all = rest.includes("--all"), rows = bgm.listBg(sdir, { all }).filter((r) => r.task === task), full = rest.includes("--full"), CAP = 8, shown = full ? rows : rows.slice(0, rows.some((r) => r.status === "running") ? Math.max(CAP, rows.filter((r) => r.status === "running").length) : CAP);
    const lite = (r: import("../core/bg.ts").BgRow) => ({ id: r.id, status: r.status, port: r.port, url: r.port ? `http://127.0.0.1:${r.port}` : undefined, public_url: r.port ? `http://${pv.publicHost()}:${r.port}` : undefined, for: r.label && r.label !== r.cmd ? r.label.slice(0, 60) : r.cmd.slice(0, 70), folder: r.dir.split("/").slice(-2).join("/"), started_by: r.by, used_by: r.users?.length ? r.users : undefined, separate_reason: r.separate_reason, ...(r.status === "running" ? {} : { exit_code: r.exit_code, stopped_by: r.stopped_by, log_file: bgm.bgLogFile(sdir, r.id) }) });
    out({ ok: true, count: rows.length, tasks: full ? shown.map(brief) : shown.map(lite), hidden: rows.length > shown.length ? `${rows.length - shown.length} older finished tasks not shown (--full lists all)` : undefined, note: all ? undefined : "only the running ones; --all adds the finished ones" }); }
  else if (cmd === "bg_log") { const r = bgm.getBg(sdir, flag("id") ?? ""); out(r ? { ok: true, id: r.id, status: r.status, exit_code: r.exit_code, log_file: bgm.bgLogFile(sdir, r.id), log: bgm.bgLog(sdir, r.id, Number(flag("tail") ?? 60)) ?? "" } : { ok: false, reason: "no such background task" }); }
  else if (cmd === "bg_use") { const r = bgm.useBg(sdir, flag("id") ?? "", by, flag("as") ?? ""); out(r.ok ? { ok: true, users: r.users, note: "noted: nobody can stop this server under you without asking" } : r); }
  else if (cmd === "bg_stop") { const id = flag("id") ?? "", g = rest.includes("--force") ? undefined : bgm.stopGuard(sdir, id, by); out(g ? { ok: false, reason: g } : bgm.stopBg(sdir, id, by)); }
  else if (cmd === "bg_restart") { const r = await bgm.restartBg(sdir, flag("id") ?? "", by); const row = "id" in r ? bgm.getBg(sdir, r.id) : undefined; out(row ? { ok: true, ...brief(row) } : { ok: false, reason: "reason" in r ? r.reason : "could not restart" }); }
  else {   // bg_start --cmd "<shell command>" [--dir <folder, default run_test>] [--label "<description>"] [--port auto|<n>] [--timeout <min>] [--wait <sec>]
    const command = flag("cmd") ?? "", dirArg = flag("dir"), full = dirArg ? projPath(dirArg, ".") : join(cwd, "run_test");
    if (!command.trim()) out({ ok: false, reason: '--cmd "<shell command>" is required' });
    else if (!inWs(full)) out({ ok: false, reason: "--dir must be a folder inside the workspace" });
    else {
      mkdirSync(full, { recursive: true });
      const sep = (flag("separate") ?? "").trim(), same = bgm.findSame(sdir, { dir: full, cmd: command, task });
      if (same && !sep) { out({ ok: false, already_running: true, reason: `the same server is already running (started by ${same.by}): use it instead of starting another one`, existing: { id: same.id, status: same.status, url: `http://127.0.0.1:${same.port}`, public_url: `http://${pv.publicHost()}:${same.port}`, started_by: same.by, used_by: same.users?.length ? same.users : undefined }, next: `Use ${brief(same).url} and run \`bg use --id ${same.id}\` so nobody stops it under you. Only when you need your OWN (it is for dev / a different build / a changed copy): repeat with --separate "<why>". If unsure, ask your parent.` }); }
      else {
      const pf = flag("port"), port = pf === "auto" ? await bgm.freePort(Number(pv.cfg("PREVIEW_PORT_FROM", "5300")), Number(pv.cfg("PREVIEW_PORT_TO", "5399"))) : pf && Number(pf) > 0 ? Number(pf) : undefined;
      const tmo = Number(flag("timeout") ?? 0), m = bgm.startBg(sdir, { task, cmd: command, dir: full, by, title: flag("title"), label: flag("label") ?? flag("description"), separate_reason: sep || undefined, port, publicHost: port ? pv.publicHost() : undefined, timeoutMin: tmo > 0 ? tmo : undefined });
      const wait = Number(flag("wait") ?? 0); let ready: boolean | undefined;
      if (wait > 0 && port) ready = (await bgm.waitReady(sdir, m.id, `http://127.0.0.1:${port}/`, wait)).ready;
      else if (wait > 0) { for (let i = 0; i < wait && bgm.getBg(sdir, m.id)?.status === "running"; i++) await new Promise((ok) => setTimeout(ok, 1000)); }
      const row = bgm.getBg(sdir, m.id)!;
      out({ ok: true, ...brief(row), ready, ...(wait > 0 ? { log: bgm.bgLog(sdir, m.id, 20) ?? "" } : {}), next: port ? "Open the url with `browser shot --url <url>` (public_url is for a person's browser). `bg log --id <id>` shows its output." : "`bg list` / `bg log --id <id>` show it; `bg stop --id <id>` ends it." });
      }
    }
  }
}
}
