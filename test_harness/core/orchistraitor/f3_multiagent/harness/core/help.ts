import { ROUTE, groupsListing } from "../tools/route.ts";
// `team <group> <sub> ... [--help]`: the short hint in the agent's prompt names the groups; the long syntax lives HERE and is printed on demand (`team bg --help`, `team bg start --help`).
// The old command names (bg_start, tab, browse, browser_status, proto_init ...) keep working: `normalize` rewrites the group form into the old name before tools.ts dispatches.
const LINES: Record<string, string[]> = {
 "ref": [
 "site_audit --dir run_test/<p> | --url <https://..> [--name <n>]   the real browser checks OUR OWN site (every page, desktop + phone) and lists what to improve: contrast, alt text, dead links, headings, tap targets, overflow, hidden content -> run_test/_audit/<n>/AUDIT.md + score",
 "site_build --dir run_test/<p> --ref <store>[,<store2>] --request \"<the person's words>\"   THE PIPELINE of a website clone, run by the harness: a design worker + per screens file a brief worker and a builder that starts the moment ITS brief is done (4 at a time); returns a plan_id, follow with plan_status --plan <id> --wait 60",
 "ref_compare --ref <name> --dir run_test/<p> [--route /]   does the clone match the captured reference? score + one line per gap (sections, card grids, CTAs, icons, animation, fonts, dark theme, dead links)",
 "ref_capture --url <https://site> --name <short-name> [--more \"<url>=<name>,<url>=<name>\"]   REAL reference of a site for a clone, no model call: raw html, css tokens (colours, fonts, variables), screenshots light/dark/mobile you can LOOK at with Read, sections and links -> run_test/_ref/<name>/REF.md"
],
 "browser": [
  "browser_status | browser_connect [--url http://127.0.0.1:9222] | browser_launch [--port 9222] | browser_toggle [--on|--off] | browser_disconnect   the CONNECTED browser (a Chrome a person can see and has logged in to): its open tabs; browse / ref_capture / ref_compare use it when connected, browse --tab '<part of a tab url or title>' inspects a tab that is already open",
  "browse --url <https://..>|--file run_test/<p>/index.html [--route /blog] [--scheme dark] [--mobile] [--shots <prefix>] [--video] [--out <name>] [--steps '[{\"scroll\":900},{\"click\":\"Features\"},{\"shot\":\"a.png\"},{\"outline\":true}]']   a REAL browser: scroll, click, screenshots (open with Read), section outline with real computed styles For a flow with clicks use tab instead (one open tab). --out <name> picks the folder in the session's store/qa (never inside the project).",
  "tab open --url <u> | tab do --steps '[{\"waitfor\":\"#go\"},{\"fill\":{\"#email\":\"a@b.c\"}},{\"name\":\"submit\",\"click\":\"Send\",\"wait\":1500},{\"key\":\"Enter\"},{\"goto\":\"<u2>\"}]' [--video] [--keep-going] [--background] [--clear] [--out <name>] | tab result [--job id] | tab status | tab close   ONE tab kept open for you (like a person's browser): open it once, then run whole scripts on it with no reopening or reloading. Steps: goto, waitfor, click (selector or button text), fill (form), type+text, key, scroll, wait, eval, name (numbered step: picture + video time + index.html report), shot. The FIRST failed step stops the script and the reply says which step, why, how many did not run, and shows the page as it is now (snapshot + picture): fix the step and send the rest (--keep-going runs on anyway). --background QUEUES the script and returns at once (scripts of one tab run in order; every step is tried): carry on, read it later with tab result. A click waits up to 4 s for its target to exist and be enabled before it counts as failed. Closes itself after 30 min.  RECORDING = named clips: {\"rec\":\"login\"} starts a clip (<name>.webm in your folder), {\"rec\":\"stop\"} ends it; use several in ONE script for several short clips, or leave one on and it carries on in the next script. --video = a clip named session. `tab rec list|start --name n|stop|wait|rename --from a --to b`. `tab do --url <u> ...` opens the tab itself (no tab open needed; tab close is optional). `--tab admin` = a second tab of yours. A failed step stops the script, keeps the tab and the page as it is (snapshot + FAIL_nn.png): fix and send the rest. Pictures taken during a clip come from the same frames."
 ],
 "bg": [
  "bg_start --cmd \"<shell command>\" [--dir <folder, default run_test>] [--title <kind, default server_run>] [--label \"<description>\"] [--port auto|<n>] [--wait <sec>] [--timeout <min>]   ANY background command (a dev server, a wireframe, a back end, a watcher): a title (its kind: server_run by default; or preview, wireframe, backend ...), a description, a status and a log file; --port auto gives {port}/$PORT and returns url + public_url; no time limit unless --timeout. ONE server per thing: if the same one already runs, bg_start refuses and shows it (use its url + bg_use); a second one needs --separate \"<why>\" (for dev, a changed copy)",
  "bg_list [--all]                                background tasks (--all: finished ones too: succeeded / failed / stopped / interrupted)",
  "bg_log --id <id> [--tail 60]                   output of a task, finished or not (the log file path is in bg_list)",
  "bg_use --id <id> [--as \"<what for>\"]            say you rely on a running task (qa, preview, video ...): bg_list shows used_by; nobody can stop it under you without --force",
  "bg_stop --id <id> [--force]                    end a background task (refused while another agent started or uses it)",
  "bg_restart --id <id>                           run the same command again (same folder, same port, same title)",
  "get_public_url --port <n> | --id <task id> [--path /x]   the address a PERSON's browser can open for a port (localhost works only on this machine) + whether anything answers now"
 ],
 "proto": [
  "proto_init --dir run_test/<project> --title \"<name>\" --nav \"Overview, Apps, Build>Logs, Build>Playground, Settings\" [--kind site --accent #10b981 --font \"DM Sans\" --bg-dark #0b0d10 --extra \"Privacy, Terms\"]   START of a prototype (kind app = admin dashboard; kind site = marketing / blog WEBSITE with light+dark themes, scroll animations, every page linked) in milliseconds (no model call): design kit + working shell + one stub screen per nav item + PROTO.md; \"Group>Label\" puts screens of one group in one file (one builder each)",
  "proto_check --dir <prototype folder in run_test/>   NO-BUILD prototype (index.html + plain scripts + Vue CDN): files exist, scripts parse, every screen/component used is defined; under a second"
 ],
 "proc": []
};

/** group form -> old command name: `bg list` -> `bg_list`, `browser tab open` -> `tab open`, `browser shot` -> `browse`, `browser record` -> `tab do --video` */
/** AGENT CALLING by name: `agent builder --objective ..` = delegate --role builder; the keywords below manage the agents; an id given as the next word becomes --agent (--agents for wait) */
const AGENT_SUBS: Record<string, string> = { list: "agents_list", info: "agent_info", peek: "agent_peek", stop: "agent_stop", update: "agent_update", wait: "wait", all: "fork_all", patches: "apply_patches" };
function agentForm(s: string, r: string[]): string[] {
  const sub = AGENT_SUBS[s]; if (!sub) return ["delegate", "--role", s, ...r];
  if (["info", "peek", "stop", "update"].includes(s) && r[0] && !r[0].startsWith("--")) return [sub, "--agent", r[0], ...r.slice(1)];
  if (s === "wait" && r[0] && !r[0].startsWith("--")) return [sub, "--agents", r[0], ...r.slice(1)];
  return [sub, ...r];
}
export function normalize(argv: string[]): string[] {
  const [c, s, ...r] = argv;
  if (c === "port_forward_url") return ["get_public_url", ...(s !== undefined ? [s] : []), ...r];
  if (c === "agent" && s && !s.startsWith("--")) return agentForm(s, r);
  if (c === "bug") return s !== undefined && !s.startsWith("--") ? ["report_bug", "--text", s, ...r] : ["report_bug", ...(s !== undefined ? [s] : []), ...r];
  if (c === "bugs") return ["admin_issues", ...(s !== undefined ? [s] : []), ...r];
  if ((c === "ref" || c === "site" || c === "plan" || c === "phase" || c === "proc") && s && !s.startsWith("--")) return [`${c}_${s}`, ...r];
  if (c === "bg" && s && !s.startsWith("--")) return [s === "url" ? "get_public_url" : `bg_${s}`, ...r];
  if (c === "browser" && s) {
    if (["status", "connect", "launch", "toggle", "disconnect"].includes(s)) return [`browser_${s}`, ...r];
    if (["shot", "look", "page", "ss"].includes(s)) return ["browse", ...r];
    if (["tab", "tabs"].includes(s)) return ["tab", ...r];
    if (s === "rec" || s === "record") return ["tab", "rec", ...(!r[0] || ["list", "start", "stop", "wait", "rename"].includes(r[0]) || r[0].startsWith("--") ? r : ["list"])];
  }
  if (c === "proto" && s && !s.startsWith("--")) return [`${c}_${s}`, ...r];
  return argv;
}
const GROUP_OF = (c: string) => (c === "bg" || c.startsWith("bg_") || c === "get_public_url" || c === "port_forward_url" ? "bg" : c === "browser" || c.startsWith("browser_") || c === "browse" || c === "tab" ? "browser" : c === "proto" || c.startsWith("proto_") ? "proto" : c === "ref" || c === "site" || c.startsWith("ref_") || c.startsWith("site_") ? "ref" : undefined);

/** BROWSER cheat sheets: short, by task (what an agent needs when it types `team browser --help`, `browser tab --help`, `browser rec --help`). The one-line-per-command form is kept in LINES for the old names. */
const TOPICS: Record<string, string> = {
  browser: [
    "browser = a real Chrome. Pick the job:",
    "  browser shot --url <u> [--mobile] [--scheme dark] [--steps '[...]']   ONE look: a picture + the page outline, no tab kept (also --file run_test/<p>/index.html)",
    "  browser tab open --url <u>                  your OWN tab, kept open (you may skip this: `tab do --url <u>` opens it)",
    "  browser tab do --steps '[...]'              run a whole script of steps on it (click, fill, scroll, shot ...)  -> browser tab --help",
    "  browser rec start|stop|list|wait|rename     RECORD: named video clips of what the tab does  -> browser rec --help",
    "  browser tab status | tab close              where is my tab / finish (close is optional)",
    "  browser status|connect|launch|toggle        the person's visible Chrome (logins carry over); off by default",
    "Rules: one script per flow (not one call per click); a failed step stops the script but KEEPS the tab and the page: fix and send the rest.",
  ].join("\n"),
  tab: [
    "browser tab open --url <u>  |  tab do [--url <u>] --steps '<JSON list>' [--background] [--keep-going] [--tab <name>]  |  tab status  |  tab result  |  tab close",
    "STEPS (one object each, run in order; give a step a \"name\" and it is numbered, gets a picture and a time in the video):",
    "  {\"goto\":\"<url>\"} {\"click\":\"#id | button text | @e5\"} {\"fill\":{\"#email\":\"a@b.c\"}} {\"type\":\"#box\",\"text\":\"hi\"} {\"key\":\"Enter\"}",
    "  {\"scroll\":900} {\"wait\":1500} {\"waitfor\":\"#id\"} {\"eval\":\"js\"} {\"viewport\":\"390x844\"} {\"hover\":\"#id\"} {\"seed\":1}",
    "  {\"name\":\"after login\",\"shot\":true}            a picture, named by the tool (never choose file names)",
    "  {\"rec\":\"login\"} ... {\"rec\":\"stop\"}            record a clip around some steps  -> browser rec --help",
    "EVERY reply ends with a SNAPSHOT of the page (things you can press, with refs like @e5): write the next script from it.",
    "A click waits up to 4 s for its target. The FIRST failed step stops the script: the reply says which, why, how many did not run, and gives snapshot + FAIL_nn.png; the tab stays as it is: send only the REST.",
    "--background queues the script and returns at once (they run in order); read it with `tab result`. --tab admin = a second tab of yours (own cookies/page).",
    "Evidence goes to the session's store/qa/<you>/ (index.html report with the video and a thumbnail per step); the tool prints every full path.",
  ].join("\n"),
  rec: [
    "RECORDING = named clips, <name>.webm in your evidence folder. The recorder runs only while a script runs (thinking time is not in the video).",
    "  in a script:  {\"rec\":\"login\"} starts a clip, {\"rec\":\"stop\"} ends it. Several clips in ONE script = several short videos. A clip left on carries on in your NEXT script (auto resume).",
    "  --video on `tab do` = one clip called \"session\".   Pictures taken while a clip runs come from the same frames (nothing extra to wait for).",
    "  browser rec list                        your clips (size) and which one is recording now",
    "  browser rec start --name <n> | stop     switch recording on for the next script / off (no script needed)",
    "  browser rec wait                        wait until the encoder has written every clip (tab close does it too)",
    "  browser rec rename --from <a> --to <b>  rename a clip (e.g. old_login before recording it again)",
    "Say a video exists only when `tab close` or `rec list` names the file. Poor clip? rename it to old_<name> and record again.",
  ].join("\n"),
  agent: [
    "agent = call and manage your sub-agents (the ones you may call are listed in your prompt):",
    "  agent <name> --objective \"<what>\" --output \"<format>\" --boundaries \"<limits>\" [--writes a,b] [--async] [--session new|<agent_id>|fork:<agent_id>] [--model haiku] [--title \"<what for>\"] [--mode ask]",
    "        starts one sub-agent by its name (agent builder ..., agent researcher ...); --session <agent_id> continues the one that worked before and remembers",
    "  agent all --from <agent_id> --role <name> --tasks '[{\"title\":\"..\",\"writes\":[\"run_test/p/a.js\"],\"objective\":\"..\"},{...}]'   N tasks at once (no --async needed), then ONE agent wait",
    "  agent wait <id>,<id> [--any] [--timeout 300]     after --async calls: waits for them and returns their answers",
    "  agent list                                      the agents you may call, and the ones running",
    "  agent info <id> | peek <id> [--n 8] | stop <id> | update <id> --title \"..\" --description \"..\"",
    "  agent patches                                   apply the patches of parallel builders",
    "Old names (delegate, fork_all, wait, agents_list, agent_info, agent_peek, agent_stop, agent_update, apply_patches) still work.",
  ].join("\n"),
  shot: "browser shot --url <https://..> | --file run_test/<p>/index.html [--route /blog] [--scheme dark] [--mobile] [--shots <prefix>] [--steps '[...]']\nONE look in a fresh browser: pictures (open them with Read) + the page outline with real computed styles. For a flow with clicks use `browser tab` instead.",
  connect: "browser status | connect [--url http://127.0.0.1:9222] | launch [--port 9222] | toggle [--on|--off] | disconnect\nThe person's own visible Chrome (their logins). When connected, shot/tab use it; otherwise a private headless Chrome is used.",
};
/** which cheat sheet answers this question: `browser` -> overview, `tab`/`browser tab` -> tab, `rec`/`tab rec`/`browser record` -> rec ... */
function topicOf(words: string[]): string | undefined {
  const [a, b, c] = words;
  if (a === "browser") return !b ? "browser" : ["tab", "tabs"].includes(b) ? (c === "rec" ? "rec" : "tab") : ["rec", "record"].includes(b) ? "rec" : ["shot", "look", "page", "ss"].includes(b) ? "shot" : "connect";
  if (a === "agent") return "agent";
  if (a === "tab") return b === "rec" ? "rec" : "tab";
  if (a === "browse") return "shot";
  if (a?.startsWith("browser_")) return "connect";
  return undefined;
}
/** the help text for `team <argv>` when it carries --help / help: one command's line when the sub-command is known, else the whole group */
export function helpFor(argv: string[]): string | undefined {
  const a = argv.filter((x) => x !== "--help" && x !== "-h"), asked = argv.length !== a.length || a[0] === "help"; if (!asked) return undefined;
  const words = a[0] === "help" ? a.slice(1) : a, tp = topicOf(words); if (tp) return TOPICS[tp];
  const n = normalize(words), g = GROUP_OF(n[0] ?? words[0] ?? ""), all = g ? LINES[g]! : undefined;
  const fam = ["plan", "phase", "agent", "proc"].includes(words[0] ?? "") ? words[0]! : undefined;
  if (fam && !all) return `${fam}: ${Object.keys(ROUTE).filter((c) => c.startsWith(fam + "_") || (fam === "agent" && c === "agents_list")).map((c) => (c === "agents_list" ? "list" : c.slice(fam.length + 1))).join(" | ")}   (team ${fam} <sub> [--flags]; the lead chapters say when to use them; flags: the command prints its own usage when called without them)`;
  if (!all) return "GROUPS (syntax: `team <group> --help`, one command: `team <group> <sub> --help`): bg (list start log use stop restart url), browser (tab shot rec status connect launch toggle), plan / phase / agent / proc (sub-commands: `team plan --help`), proto (init check), ref / site (the website-clone pipeline: ref capture|compare, site build|audit).\nALL COMMANDS by the file that runs them (harness/tools/):\n" + groupsListing();
  const isGroup = ["bg", "browser", "proto", "ref", "site"].includes(words[0] ?? ""), one = isGroup && words.length < 2 ? undefined : all.find((l) => l.split(/[\s|]/)[0] === n[0]);
  return (one ? [one] : all).join("\n");
}
/** the prompt lists a group line when the agent may use any of its commands (agent.json team_commands lists group names: browser, bg, proto, ref; single command names also work) */
export const groupsOf = (only: string[]): Set<string> => new Set(only.map((t) => GROUP_OF(t)).filter((x): x is string => !!x));
