// Which package manager THIS project uses inside the QA container (run by prepare.sh on the container's copy of the project, never on the project itself).
//   1. the project's own `packageManager` wins when it is pnpm (corepack then runs exactly that version: the container serves many repos, each with its own);
//   2. anything else (nothing, npm, yarn, bun) becomes pnpm at the container's DEFAULT version (PNPM_DEFAULT_VERSION, set by the image), because we always install with pnpm;
//   3. PNPM_VERSION in the environment forces one version for a run (an escape hatch; nothing sets it by default).
//   4. the project's OWN install hooks (preinstall / install / postinstall / prepare / prepublish*) are dropped in this copy: QA only needs the app to start, and those hooks break in a throwaway container (Cypress `prepare: cypress install` downloads a binary and failed the whole QA install; husky needs a .git). Dependencies' own build scripts still run.
// Why a default at all: without a pin corepack downloads the NEWEST pnpm, which drifted (12.18, then 12.21) and brought a lockfile supply-chain check the builders' pnpm 10 does not have.
import fs from "node:fs";
const file = process.argv[2] ?? "package.json", dflt = process.argv[3] || process.env.PNPM_DEFAULT_VERSION || "10.28.0";
const j = JSON.parse(fs.readFileSync(file, "utf8")), own = String(j.packageManager ?? ""), forced = process.env.PNPM_VERSION;
const keep = !forced && /^pnpm@\d+\.\d+\.\d+/.test(own);
const HOOKS = ["preinstall", "install", "postinstall", "prepare", "prepublish", "prepublishOnly"], dropped = HOOKS.filter((h) => j.scripts && h in j.scripts);
for (const h of dropped) delete j.scripts[h];
if (!keep) j.packageManager = "pnpm@" + (forced || dflt);
if (!keep || dropped.length) fs.writeFileSync(file, JSON.stringify(j, null, 2));
if (dropped.length) console.log(`install hooks of the project dropped for QA: ${dropped.join(", ")}`);
console.log(keep ? `package manager: the project pins ${own.split("+")[0]}` : `package manager: ${forced ? "forced" : own ? `the project said ${own.split("@")[0]}, we use pnpm` : "the project pins none"}, using pnpm@${forced || dflt}`);
