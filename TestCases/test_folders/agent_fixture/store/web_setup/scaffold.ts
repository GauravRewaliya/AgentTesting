// The work of the web-setup fixtures (results/test_web_setup/*.ts): NOT a copied project. The fixture runs the REAL generator command (`bun create vue@latest ...`, `bun create vite@latest ...`) in a throwaway Docker container
// (image with Bun built in, 2 GB / 1 CPU, caps dropped, only run_test/ mounted, shared volume for Bun's cache), exactly what a real sub-agent would type. It reads the project name and the options from the hand-over, and,
// like the real agent, answers NEEDS_PARENT when the name or the options are missing, so a master that did not ask the person first gets a question back.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Req } from "@core/types.ts";

const IMAGE = "agent-testing-claude:1", rep = (o: object) => `REPORT: ${JSON.stringify(o)}`;
const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)]));
const has = (t: string, re: RegExp) => re.test(t);

/** The project name: `run_test/<name>` first, then "named / called / name: <name>". */
export const nameOf = (task: string): string | undefined => (task.match(/run_test\/([A-Za-z0-9][A-Za-z0-9._-]*)/)?.[1] ?? task.match(/\b(?:named|called|name(?: it)?(?: is)?[:=]?)\s+["'`]?([a-z][a-z0-9._-]{1,40})/i)?.[1])?.replace(/[._-]+$/, "");   // "in run_test/dash-ui.": the full stop ends the sentence, it is not part of the name
/** A word that is chosen, not NEGATED: "no JSX", "without ESLint", "do not add Prettier", "skip tests" do not count. */
const chosen = (t: string, word: string) => new RegExp(`(?<!\\b(?:no|not|without|skip|exclude|excluding|never|don't|dont)\\s(?:[\\w-]+\\s){0,3})\\b(?:${word})\\b`, "i").test(t);
/** create-vue feature flags from the words of the hand-over. [] + no "default/nothing else" = the options were never given. */
export function vueFlags(t: string): string[] {
  const f: string[] = [];
  if (chosen(t, "typescript|ts")) f.push("--ts"); if (chosen(t, "jsx")) f.push("--jsx"); if (chosen(t, "router")) f.push("--router"); if (chosen(t, "pinia")) f.push("--pinia");
  if (chosen(t, "vitest")) f.push("--vitest"); if (chosen(t, "cypress")) f.push("--cypress"); if (chosen(t, "playwright")) f.push("--playwright"); if (chosen(t, "eslint")) f.push("--eslint"); if (chosen(t, "prettier")) f.push("--prettier"); if (chosen(t, "bare")) f.push("--bare");
  return f.length ? f : has(t, /\b(default|nothing else|no (other |additional )?(extras|features)|plain|minimal|javascript)\b/i) ? ["--default"] : [];
}

export function scaffold(req: Req, kind: "vue" | "react"): string {
  const name = nameOf(req.task);
  if (!name) return `NEEDS_PARENT: which project name should I use (the folder is created in run_test/<name>)?`;
  let args: string[], flags: string[];
  if (kind === "vue") {
    flags = vueFlags(req.task);
    if (!flags.length) return `NEEDS_PARENT: which options for the Vue project "${name}": TypeScript? Vue Router? Pinia? Vitest? ESLint / Prettier? Or the default setup?`;
    args = ["create", "vue@latest", name, ...flags];
  } else {
    const ts = chosen(req.task, "typescript|ts"), js = chosen(req.task, "javascript");
    if (!ts && !js) return `NEEDS_PARENT: TypeScript or JavaScript for the React project "${name}" (and ESLint or not)?`;
    flags = ["--template", ts ? "react-ts" : "react", "--no-interactive", "--no-immediate", ...(chosen(req.task, "eslint") ? ["--eslint"] : [])];
    args = ["create", "vite@latest", name, ...flags];
  }
  mkdirSync(req.ws, { recursive: true });
  if (existsSync(join(req.ws, name))) return `ERROR: run_test/${name} already exists (the generator does not overwrite it)`;
  const uid = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`, command = `bun ${args.join(" ")}`;
  const r = spawnSync("docker", ["run", "--rm", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--memory", "2g", "--cpus", "1", "--pids-limit", "512", "--user", uid, "-e", "HOME=/tmp", "-e", "CI=1", "-e", "BUN_INSTALL_CACHE_DIR=/pnpm/bun-cache",
    "-v", "agent-testing-pnpm-store:/pnpm", "-v", `${req.ws}:${req.ws}`, "-w", req.ws, "--entrypoint", "bun", IMAGE, ...args], { encoding: "utf8", timeout: 180_000 });
  if (r.status !== 0 || !existsSync(join(req.ws, name))) return `ERROR: \`${command}\` failed: ${(r.stderr || r.stdout).split("\n").filter(Boolean).slice(-4).join(" | ").slice(0, 300)}`;
  const all = files(join(req.ws, name)), top = readdirSync(join(req.ws, name)).filter((n) => !n.startsWith(".")).join(", ");
  return `Ran in run_test (inside the sandbox container): \`${command}\`\nCreated run_test/${name}: ${all.length} files (top level: ${top}). Dependencies are NOT installed: install with \`pnpm install\`, then \`pnpm dev\`.\n` + rep({ stage: "setup", command, dir: `run_test/${name}`, flags, files: all.length });
}
