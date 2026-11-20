// Free check of approach a3 (the mod): bun self_test/approach_a3.ts   (no model call; `claude plugin validate` reads the mod the way the engine will)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadAgents } from "../harness/core/base.ts";
import { buildLeadMod } from "../approaches/a3_native_mod/adapter.ts";
import { currentApproach } from "../approaches/index.ts";
import { results, setSuite, t } from "./lib.ts";

setSuite("approach a3_native_mod");
const dir = buildLeadMod();
t("a3.1", "the lead's plugin folder is built in core/.build with the mod, its generated config and the shared guard", dir.includes("/core/.build/") && ["hooks/hooks.json", "hooks/register.ts", "hooks/config.ts", "hooks/guard.ts", "hooks/team_tools.ts", "hooks/delegate.ts", "hooks/team.ts", "hooks/context.ts", "hooks/wake.ts", "hooks/compose.ts", "hooks/cli.ts", ".claude-plugin/plugin.json"].every((f) => existsSync(join(dir, f))), dir);
t("a3.2", "the same content builds the same folder (nothing is rebuilt)", buildLeadMod() === dir && buildLeadMod("x") !== dir);
t("a3.3", "config.ts names the real tools.ts; the guard copy is the shared file", existsSync(JSON.parse(readFileSync(join(dir, "hooks/config.ts"), "utf8").replace(/^export const CFG = /, "").replace(/ as const\s*$/, "")).tools) && readFileSync(join(dir, "hooks/guard.ts"), "utf8") === readFileSync(join(import.meta.dir, "../harness/leadkit/guard.ts"), "utf8"));
const v = spawnSync("claude", ["plugin", "validate", dir], { encoding: "utf8", timeout: 90_000 }), out = (v.stdout ?? "") + (v.stderr ?? "");
t("a3.4", "claude plugin validate: the module loads, hooks Agent, SendMessage and the four guarded tools, no type error, the Agent hooks have a .catch", /tool\.call\{tool=Agent\}/.test(out) && /tool\.call\{tool=SendMessage\}/.test(out) && /Read\|Glob\|Grep\|Bash/.test(out) && !/error TS/.test(out) && !/gating hook without \.catch/.test(out), out.split("\n").filter((l) => /error TS|without \.catch/.test(l)).join(" | "));
const L = await currentApproach("a3_native_mod").describeLaunch(loadAgents(), { maxDepth: 2 }), a = L.extra({}), st = JSON.parse(a[a.indexOf("--settings") + 1]!).hooks, built = a[a.indexOf("--plugin-dir") + 1]!;
t("a3.5", "launch: --plugin-dir a built folder whose config carries the agent list (a prompt section, not in the prompt file), --agents declared, hooks only the shared activity hook, the lead has NO Bash, the typed tools and Agent / SendMessage are allowed",
  existsSync(join(built, "hooks/register.ts")) && /Agent types you may call/.test(readFileSync(join(built, "hooks/config.ts"), "utf8")) && !/Agent types you may call/.test(L.text) && a.includes("--agents") && Object.keys(st).join() === "PostToolUse"
  && !L.allow.some((x) => /^Bash/.test(x)) && L.allow.includes("mcp__team") && L.allow.includes("Agent") && L.allow.includes("SendMessage") && !L.tools.some((x) => x.startsWith("mcp__")) && /typed tools/.test(L.text), L.allow.join(","));
const tt = spawnSync("claude", ["plugin", "test", built], { encoding: "utf8", timeout: 120_000 }), tout = (tt.stdout ?? "") + (tt.stderr ?? "");
t("a3.6", "claude plugin test (no model call): the mod's guard refuses a secret and a shell `team agent <role>`, lets a normal file through", /2 pass/.test(tout) && /0 fail/.test(tout), tout.split("\n").slice(-6).join(" | "));
const { listed, toArgv } = await import("../harness/leadkit/team_tools.ts");
t("a3.7", "typed tools: the registered set is the core list, every tool maps to a CLI argv, delegate and internals are refused", listed().length >= 10 && listed().every((x) => !("error" in (toArgv(x.name, x.name === "team_tool" ? { command: "cost" } : {}) as object))) && "error" in (toArgv("team_tool", { command: "delegate" }) as object) && "error" in (toArgv("team_tool", { command: "_run" }) as object));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`); process.exit(results.some((r) => !r.ok) ? 1 : 0);
