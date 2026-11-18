// Small helpers shared by the harness (what is left of the old "preview"): where the host's public address is (for links to a background task's port) and `smokeRoutes` (site_audit).
// Starting an app is NOT done here any more: an agent starts anything with `bg_start` (a plain background task: description, status, log file) and looks at it with `browse`.
import { SOFT_GL } from "./chrome_flags.ts";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";

const REPO_ENV = join(import.meta.dir, "..", "..", "..", "..", "..", "..", ".env");
const fileEnv = (): Record<string, string> => { try { return Object.fromEntries(readFileSync(REPO_ENV, "utf8").split("\n").map((l) => l.match(/^\s*(PREVIEW_\w+)\s*=\s*(.*?)\s*$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1]!, m[2]!.replace(/^['"]|['"]$/g, "")])); } catch { return {}; } };
export const cfg = (key: string, dflt = ""): string => process.env[key] || fileEnv()[key] || dflt;

/** The host name a BROWSER should use. `localhost` fails from another machine / through a tunnel: PREVIEW_PUBLIC_HOST, else this machine's first LAN IPv4 (not docker/loopback), else 127.0.0.1. */
export function publicHost(): string {
  if (cfg("PREVIEW_PUBLIC_HOST")) return cfg("PREVIEW_PUBLIC_HOST");
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (/^(docker|br-|veth|lo)/.test(name)) continue;
    const a = (list ?? []).find((x) => x.family === "IPv4" && !x.internal); if (a) return a.address;
  }
  return "127.0.0.1";
}
/** A prototype made by `proto_init` has proto.json: open EVERY route in headless Chrome (all at once) and report what looks unfinished: a TODO / coming soon stub, lorem ipsum, undefined / NaN / [object Object] in the text,
 *  a table with no rows, a "screen not found", a JavaScript error, or almost no content. One line per bad route, so the lead hands exactly that to the builder that owns the screen. Takes ~10 s for any number of routes. */
export async function smokeRoutes(baseUrl: string, routes: { id: string; label?: string; file?: string }[], budgetMs = 6_000, allIds?: string[]): Promise<{ route: string; problems: string[] }[]> {
  const chrome = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].find((c) => spawnSync("which", [c]).status === 0); if (!chrome) return [];
  const ids = new Set((allIds ?? routes.map((r) => r.id)).map((x) => x.split("/")[0]!)), subs = new Set<string>();   // allIds: when only SOME pages are checked (one builder finished), links to the other pages are still valid
  const one = (r: { id: string; label?: string; file?: string }) => new Promise<{ route: string; problems: string[] }>((done) => {
    const dir = mkdtempSync(join(tmpdir(), "pvsmoke-")); let out = "", err = "";
    const p = spawn(chrome, ["--headless=new", "--no-sandbox", ...SOFT_GL, `--user-data-dir=${dir}`, "--enable-logging=stderr", "--v=0", `--virtual-time-budget=${budgetMs}`, "--dump-dom", /\.html$/.test(baseUrl) ? `${baseUrl}#/${r.id}` : `${baseUrl}/#/${r.id}`]);
    p.stdout.on("data", (b) => { out += b; }); p.stderr.on("data", (b) => { err += b; });
    const finish = () => {
      rmSync(dir, { recursive: true, force: true });
      const main = (out.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? out), text = main.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), problems: string[] = [];
      const errors = [...new Set([...err.matchAll(/CONSOLE[^"]*"((?:Uncaught|TypeError|ReferenceError|Error|\[Vue warn\])[^"]{0,200})/g)].map((m) => m[1]!))].slice(0, 2);
      if (errors.length) problems.push("JavaScript error: " + errors.join(" | "));
      if (/TODO|coming soon|not built yet/i.test(text)) problems.push("still a stub (TODO / coming soon)");
      if (/lorem ipsum/i.test(text)) problems.push("lorem ipsum text");
      if (/\bundefined\b|\bNaN\b|\[object Object\]|\{\{/.test(text)) problems.push("shows undefined / NaN / [object Object] / a raw {{ }}");
      if (/Screen not found/.test(text)) problems.push(`no Screens.${r.id} is defined`);
      if (/Page not found|Article not found|not found|no such (page|article|post)|404/i.test(text) && r.id.includes("/")) problems.push("a link leads here but the page says not found");
      const hrefs = [...out.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]!), dead = hrefs.filter((h) => h === "#" || h === "" || /^javascript:/i.test(h)).length;
      if (dead) problems.push(`${dead} dead link(s) (href="#" or empty): every link must go to a page`);
      const unknown = [...new Set(hrefs.filter((h) => /^#\//.test(h)).map((h) => h.slice(2).split("?")[0]!).filter((h) => h && !ids.has(h.split("/")[0]!)))]; if (unknown.length) problems.push(`links to pages that do not exist: ${unknown.slice(0, 4).map((x) => "#/" + x).join(", ")}`);
      for (const h of hrefs) if (/^#\/[^/]+\/[^/?]+/.test(h)) subs.add(h.slice(2).split("?")[0]!);
      if (/<table/.test(main) && !/<td/.test(main)) problems.push("a table with no rows");
      if (text.length < 60 && !/TODO|not found/i.test(text)) problems.push("almost empty (" + text.length + " characters)");
      done({ route: `#/${r.id}${r.file ? ` (js/screens/${r.file}.js)` : ""}`, problems });
    };
    const t = setTimeout(() => { p.kill("SIGKILL"); }, budgetMs + 25_000); p.on("close", () => { clearTimeout(t); finish(); });
  });
  const first = await Promise.all(routes.map(one)), seen = new Set(routes.map((r) => r.id));
  const sub = [...subs].filter((x) => !seen.has(x)).slice(0, 12);   // detail links found on the pages (an article of the blog ...): each must open a real page
  const second = sub.length ? await Promise.all(sub.map((id) => one({ id }))) : [];
  return [...first, ...second].filter((x) => x.problems.length);
}
