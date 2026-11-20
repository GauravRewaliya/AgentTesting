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
/** A word that is chosen, not NEGATED. Two kinds of negator:
 *  - "no / skip / without / exclude / never": covers the next words joined by a space, "or" / "and" or a SLASH ("no Playwright/Cypress/e2e": the master wrote exactly that and the first version lost track after the slash, so --cypress was added). A COMMA ends it: "no JSX, Pinia" still picks Pinia.
 *  - "not / don't" (the verb form, "Do NOT add JSX, ESLint or Prettier"): covers the whole comma list, until a positive word (add / use / include / with / plus / but / yes) or the end of the sentence. */
const NEG_PLAIN = String.raw`\b(?:no|skip|without|exclude|excluding|never)\s(?:[\w-]+[\s/]\s?){0,3}`;
const NEG_VERB = String.raw`\b(?:not|don't|dont)\s(?:(?:add|use|include|install)\s)?(?:(?!(?:add|use|include|with|plus|but|yes)\b)[\w-]+(?:,\s*|[\s/]\s?)){0,5}`;
/** Sentences that are NOT a choice, cut out before any word is looked for (found in a real run: "NOT wanted: JSX, E2E/Playwright/Cypress, ESLint, Prettier ..." was read as five chosen options):
 *  - a list that is negated as a whole: "NOT wanted: ...", "unwanted / excluded / not needed / don't want: ..." up to the end of the sentence;
 *  - an ACCEPTANCE section (checks to run afterwards, "No eslint, prettier, playwright in package.json": the a3 lead wrote it and --cypress --playwright --prettier were added), cut to the end of the text;
 *  - "none of eslint, prettier, playwright, cypress" (an ACCEPTANCE line of a hand-over: the a3 run read it as four chosen options, 2026-11-20);
 *  - a note about the PAST or a check, not an order: "You enabled jsx, cypress ...", "verify that no cypress, eslint ... remain". */
const NOT_A_CHOICE = /\bACCEPTANCE\b[\s\S]*|\b(?:(?:do(?:es)? not|don't|dont) want|not (?:wanted|needed|required)|unwanted|excluded?|skipped|none of)\b[^.\n]*|\b(?:you (?:enabled|added|turned on|used)|verify|check that|make sure|ensure)\b[^.\n]*/gi;
/** A word followed by its answer: "ESLint NO; Prettier NO" (the a3 lead wrote its options as a table, 2026-11-20), "eslint: no", "prettier=off". An upper-case NO right after a word only, so "with no JSX" still goes to NEG_PLAIN. */
const POSTFIX_NO = /\b[\w-]+\s*[:=]\s*(?:no|off|false)(?=\s*(?:[;,.)\n]|$))|\b[\w-]+\s+NO(?=\s*(?:[;,.)\n]|$))/g;   // the answer must END the clause: "ACCEPTANCE: no eslint/prettier" is a negator, not an answer
const chosen = (t: string, word: string) => new RegExp(`(?<!${NEG_PLAIN})(?<!${NEG_VERB})\\b(?:${word})\\b`, "i").test(t.replace(NOT_A_CHOICE, " ").replace(POSTFIX_NO, " "));
/** When the hand-over states the exact command (`create vue@latest shop-ui --ts --router`), those flags are the order: nothing is guessed from the words around it. */
const statedFlags = (t: string): string[] | undefined => { const m = t.match(/create\s+vue@latest\s+[\w.-]+((?:\s+--[a-z-]+)+)/i); return m ? m[1]!.trim().split(/\s+/) : undefined; };
/** create-vue feature flags from the words of the hand-over. [] + no "default/nothing else" = the options were never given. */
export function vueFlags(t: string): string[] {
  const given = statedFlags(t); if (given) return given;
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
  return `Ran in run_test (inside the sandbox container): \`${command}\`\nCreated run_test/${name}: ${all.length} files (top level: ${top}). Dependencies are NOT installed: install with \`pnpm install\`, then \`pnpm dev\`.${kind === "vue" ? "\nNote: create-vue always includes \`vite-plugin-vue-devtools\` (it has no flag to leave it out); every other feature is exactly the flags above." : ""}\n` + rep({ stage: "setup", command, dir: `run_test/${name}`, flags, files: all.length });
}
