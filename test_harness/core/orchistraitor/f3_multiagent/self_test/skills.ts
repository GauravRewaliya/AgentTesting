// Free check of the skill mounter (no model call):  bun self_test/skills.ts
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAgents } from "../harness/core/base.ts";
import { loadMounts, skillArgs, skillLibrary, skillProblems, skillsFor } from "../harness/core/skills.ts";
import { dockerArgs } from "../harness/core/base/docker_runner.ts";
import { results, setSuite, t } from "./lib.ts";

setSuite("skills mounted per agent (agents/skills.json)");
const defs = loadAgents(), lib = skillLibrary(), mounts = loadMounts();
t("sk.1", "skills.json has no problem (agents exist, patterns match skills)", skillProblems([...defs.keys()], mounts, lib).length === 0, JSON.stringify(skillProblems([...defs.keys()], mounts, lib)));
const expo = skillsFor("builder", "Build an Expo app with a spring card", mounts, lib);
t("sk.2", "builder + an Expo hand-over gets the expo-* skills", expo.includes("expo-go") && expo.includes("expo-router") && expo.every((n) => n.startsWith("expo-")), expo.join(","));
t("sk.3", "builder + a plain web hand-over gets NO skill (small context)", skillsFor("builder", "Make a landing page in plain HTML", mounts, lib).length === 0);
t("sk.4", "an agent that is not listed gets no skill, even for Expo", skillsFor("researcher", "Expo react native", mounts, lib).length === 0 && skillsFor("lead", "expo", mounts, lib).length === 0);
const a = skillArgs("builder", "an expo app");
t("sk.5", "the call gets --plugin-dir with a plugin.json and a copy of exactly those skills", a.args[0] === "--plugin-dir" && existsSync(join(a.args[1]!, ".claude-plugin", "plugin.json")) && readdirSync(join(a.args[1]!, "skills")).sort().join() === a.names.join() && existsSync(join(a.args[1]!, "hooks", "guard.ts")) && existsSync(join(a.args[1]!, "skills", "expo-go", "SKILL.md")));
const g = skillArgs("builder", "plain html"); t("sk.6", "no skill matches: the plugin is the guard alone (every sub-agent gets it)", g.names.length === 0 && g.args[0] === "--plugin-dir" && existsSync(join(g.args[1]!, "hooks", "register.ts")) && !existsSync(join(g.args[1]!, "skills")));
const c = { agent: defs.get("researcher")!, extraArgs: ["--plugin-dir", "/tmp/x"], cwd: "/w", env: {} } as never;
t("sk.7", "docker mounts a --plugin-dir read-only", dockerArgs(c, "n", [], "1:1").join(" ").includes("-v /tmp/x:/tmp/x:ro"));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`); process.exit(results.some((r) => !r.ok) ? 1 : 0);
