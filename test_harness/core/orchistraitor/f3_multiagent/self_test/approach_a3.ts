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
t("a3.1", "the lead's plugin folder is built in core/.build with the mod, its generated config and the shared guard", dir.includes("/core/.build/") && ["hooks/hooks.json", "hooks/register.ts", "hooks/config.ts", "hooks/guard.ts", ".claude-plugin/plugin.json"].every((f) => existsSync(join(dir, f))), dir);
t("a3.2", "the same content builds the same folder (nothing is rebuilt)", buildLeadMod() === dir);
t("a3.3", "config.ts names the real tools.ts; the guard copy is the shared file", existsSync(JSON.parse(readFileSync(join(dir, "hooks/config.ts"), "utf8").replace(/^export const CFG = /, "").replace(/ as const\s*$/, "")).tools) && readFileSync(join(dir, "hooks/guard.ts"), "utf8") === readFileSync(join(import.meta.dir, "../harness/leadkit/guard.ts"), "utf8"));
const v = spawnSync("claude", ["plugin", "validate", dir], { encoding: "utf8", timeout: 90_000 }), out = (v.stdout ?? "") + (v.stderr ?? "");
t("a3.4", "claude plugin validate: the module loads, hooks Agent, SendMessage and the four guarded tools, no type error, the Agent hooks have a .catch", /tool\.call\{tool=Agent\}/.test(out) && /tool\.call\{tool=SendMessage\}/.test(out) && /Read\|Glob\|Grep\|Bash/.test(out) && !/error TS/.test(out) && !/gating hook without \.catch/.test(out), out.split("\n").filter((l) => /error TS|without \.catch/.test(l)).join(" | "));
const L = await currentApproach("a3_native_mod").describeLaunch(loadAgents(), { maxDepth: 2 }), a = L.extra({}), st = JSON.parse(a[a.indexOf("--settings") + 1]!).hooks;
t("a3.5", "launch: --plugin-dir the built folder, --agents declared, hooks are only the shared activity hook (the mod does the rest), Agent + SendMessage allowed", a[a.indexOf("--plugin-dir") + 1] === dir && a.includes("--agents") && Object.keys(st).join() === "PostToolUse" && L.allow.includes("Agent") && L.allow.includes("SendMessage") && /hand-back/.test(L.text));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`); process.exit(results.some((r) => !r.ok) ? 1 : 0);
