// COMMANDS: ref capture / ref compare (study a reference site, compare a clone with it), site audit, proto init, proto check: the website-clone and prototype pipeline.
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { cmd, cwd, file, flag, inWs, out, projPath } from "./ctx.ts";
import { mediaOut } from "./media.ts";

export const COMMANDS = ["ref_capture", "site_audit", "ref_compare", "proto_init", "proto_check"];
export async function run(): Promise<void> {
if (cmd === "ref_capture") {   // REAL reference of a website (raw html + css tokens + screenshots, no model call) for a "ditto" clone, or a screenshot of a local preview to compare: --url <https://..> --name <short-name>
  const url = flag("url") ?? "", nm = (flag("name") ?? new URL(url || "http://x").hostname).replace(/[^\w.-]+/g, "-");
  if (!/^https?:\/\//.test(url)) out({ ok: false, reason: "--url must start with http:// or https://" });
  else {
    const { refCapture } = await import("../core/ref_capture.ts"), { par } = await import("../core/browse.ts");
    const more = (flag("more") ?? "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const [u, n] = x.split("="); return { url: u!, name: (n ?? new URL(u!).pathname.replace(/\W+/g, "-").replace(/^-|-$/g, "") ?? "page").replace(/[^\w.-]+/g, "-") || "page" }; });   // --more "https://x.io=home,https://x.io/blog/post=article": several pages captured AT THE SAME TIME
    const jobs = [{ url, name: nm }, ...more].map((j) => () => refCapture({ url: j.url, name: j.name, dir: join(cwd, "run_test", "_ref", j.name) }));
    const res = await par(jobs); out(res.length === 1 ? res[0] : { ok: res.every((r) => (r as { ok?: boolean }).ok), captured: res });
  }
}
if (cmd === "site_audit") {   // the real browser checks OUR OWN site (a project folder or a url) and lists what to improve: --dir run_test/<p> | --url <https://..> [--name <n>]
  const { siteAudit, projectRoutes } = await import("../core/site_audit.ts"), u = flag("url"), proj = u ? "" : projPath(flag("dir") ?? ".");
  if (!u && (!inWs(proj) || !existsSync(join(proj, "index.html")))) out({ ok: false, reason: "give --dir run_test/<project> (with index.html) or --url https://.." });
  else { const nm = (flag("name") ?? (u ? new URL(u).hostname : proj.split("/").pop()!)).replace(/[^\w.-]+/g, "-"); out(await siteAudit({ base: u ?? "file://" + join(proj, "index.html"), routes: u ? [] : projectRoutes(proj), outDir: join(cwd, "run_test", "_audit", nm), name: nm })); }
}
if (cmd === "ref_compare") {   // does the clone match the reference captured by ref_capture? --ref <name> --dir run_test/<project> [--route "/"]
  const nm = flag("ref") ?? "", proj = projPath(flag("dir") ?? "."), dirRel = proj.slice(resolve(cwd).length + 1), idx = join(proj, "index.html");
  if (!nm || !inWs(proj) || !existsSync(idx)) out({ ok: false, reason: "--ref <name used in ref capture> and --dir run_test/<project> (with index.html) are required" });
  else { const { refCompare } = await import("../core/ref_compare.ts"); out(await refCompare({ refDir: join(cwd, "run_test", "_ref", nm), url: "file://" + idx + "#" + (flag("route") ?? "/"), outDir: mediaOut("ref_compare") ?? join(cwd, "run_test", "_shots") })); }
}
if (cmd === "proto_init") {   // the STARTER of a no-build prototype, made by the harness (no model call): design kit + shell + one stub screen per nav item + PROTO.md. Builders then only write screens.
  const rel = (flag("dir") ?? "").replace(/^run_test[\\/]?/, ""), d = resolve(cwd, "run_test", rel);
  if (!rel || rel.includes("..") || !d.startsWith(resolve(cwd, "run_test") + "/")) out({ ok: false, reason: "--dir must be run_test/<project>" });
  else { const { protoInit, parseNav } = await import("../core/proto_init.ts"); out(protoInit(d, { title: flag("title") ?? rel, nav: parseNav(flag("nav") ?? ""), user: flag("user"), org: flag("org"), rel: "run_test/" + rel, kind: flag("kind") === "site" ? "site" : "app", extra: flag("extra") ? parseNav(flag("extra")!) : undefined, accent: flag("accent"), font: flag("font"), bgDark: flag("bg-dark"), tagline: flag("tagline") })); }
}
if (cmd === "proto_check") {   // a NO-BUILD prototype (index.html + plain scripts + Vue from a CDN): files exist, scripts parse, every screen / component used is defined. No install, no server: under a second.
  const d = projPath(flag("dir") ?? "."); if (!inWs(d)) { out({ ok: false, error: "the folder must be inside the workspace" }); } else { const { protoCheck } = await import("../core/proto_check.ts"); out(protoCheck(d)); }
}
}
