// `ref_assets`: pull the pictures a reference page uses (logo, hero / section images, icons, favicon, og:image, css backgrounds) into run_test/_ref/<name>/assets/ with a manifest (assets.json): where each came from, size,
// pixel size, and what it is for. Made by the harness (no model call), so the LOOKUP agent and the builders get real files to place instead of guessing. For LOCAL test clones only: licences stay with their owners.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const EXT: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg", "image/gif": ".gif", "image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico", "image/avif": ".avif" };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "img";
function pngSize(b: Uint8Array): [number, number] | undefined { return b.length > 24 && b[0] === 0x89 && b[1] === 0x50 ? [(b[16]! << 24) | (b[17]! << 16) | (b[18]! << 8) | b[19]!, (b[20]! << 24) | (b[21]! << 16) | (b[22]! << 8) | b[23]!] : undefined; }

export async function refAssets(o: { dir: string; url?: string; max?: number }): Promise<Record<string, unknown>> {
  const pageFile = existsSync(join(o.dir, "raw", "page.html")) ? join(o.dir, "raw", "page.html") : join(o.dir, "page.html"), cssFile = existsSync(join(o.dir, "raw", "styles.css")) ? join(o.dir, "raw", "styles.css") : join(o.dir, "styles.css");
  if (!existsSync(pageFile)) return { ok: false, reason: `no page.html in ${o.dir}: run ref capture first (it saves raw/page.html)` };
  const html = readFileSync(pageFile, "utf8"), css = existsSync(cssFile) ? readFileSync(cssFile, "utf8") : "";
  const base = new URL(o.url ?? (/<base[^>]+href=["']([^"']+)/i.exec(html)?.[1] ?? readUrl(o.dir) ?? "http://localhost/"));
  const found = new Map<string, { role: string; alt: string }>(), add = (u: string | undefined, role: string, alt = "") => { if (!u || u.startsWith("data:") || u.startsWith("#")) return; try { const a = new URL(u.trim(), base).href; if (!found.has(a)) found.set(a, { role, alt }); } catch { /* bad url */ } };
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) { const t = m[0], src = /\bsrc=["']([^"']+)/i.exec(t)?.[1] ?? /data-src=["']([^"']+)/i.exec(t)?.[1], alt = /\balt=["']([^"']*)/i.exec(t)?.[1] ?? "", cls = /\bclass=["']([^"']*)/i.exec(t)?.[1] ?? ""; add(src, /logo/i.test(alt + cls + (src ?? "")) ? "logo" : /avatar|author|team|user/i.test(alt + cls) ? "avatar" : "image", alt); }
  for (const m of html.matchAll(/<link\b[^>]*rel=["'][^"']*icon[^"']*["'][^>]*>/gi)) add(/href=["']([^"']+)/i.exec(m[0])?.[1], "favicon");
  for (const m of html.matchAll(/<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)/gi)) add(m[1], "social-preview");
  for (const m of html.matchAll(/<source\b[^>]*srcset=["']([^"']+)/gi)) add(m[1]!.split(",")[0]!.trim().split(" ")[0], "image");
  for (const m of (html + css).matchAll(/url\(\s*["']?([^"')]+\.(?:png|jpe?g|webp|svg|gif|avif)(?:\?[^"')]*)?)["']?\s*\)/gi)) add(m[1], "css-background");
  const FOLDER: Record<string, string> = { logo: "logo", favicon: "icons", avatar: "images", image: "images", "social-preview": "social", "css-background": "backgrounds" };
  mkdirSync(join(o.dir, "assets"), { recursive: true });
  const list: Record<string, unknown>[] = [], max = o.max ?? 30, skipped: string[] = [];
  for (const [url, meta] of [...found].slice(0, max + 20)) {
    if (list.length >= max) break;
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(12_000) }); if (!r.ok) { skipped.push(`${url} (${r.status})`); continue; }
      const type = (r.headers.get("content-type") ?? "").split(";")[0]!.trim(), ext = EXT[type] ?? (extname(new URL(url).pathname) || ".bin"), buf = new Uint8Array(await r.arrayBuffer());
      if (!/^image\//.test(type) && !/\.(png|jpe?g|webp|svg|gif|avif|ico)$/i.test(ext)) { skipped.push(`${url} (not an image)`); continue; }
      if (buf.length > 2_500_000) { skipped.push(`${url} (over 2.5 MB)`); continue; }
      const name = `${String(list.length + 1).padStart(2, "0")}-${slug(meta.alt || new URL(url).pathname.split("/").pop()!.replace(/\.[^.]+$/, ""))}${ext}`, px = pngSize(buf);
      const folder = FOLDER[meta.role] ?? "images"; mkdirSync(join(o.dir, "assets", folder), { recursive: true }); writeFileSync(join(o.dir, "assets", folder, name), buf);
      list.push({ file: `assets/${folder}/${name}`, role: meta.role, alt: meta.alt || undefined, source: url, bytes: buf.length, ...(px ? { width: px[0], height: px[1] } : {}) });
    } catch (e) { skipped.push(`${url} (${String((e as Error).message).slice(0, 30)})`); }
  }
  writeFileSync(join(o.dir, "assets.json"), JSON.stringify({ note: "Reference images for a LOCAL test clone; licences stay with their owners. Place them with <img src=\"../_ref/<name>/assets/<folder>/<file>\"> only in a local clone, or redraw as inline svg / css gradients.", assets: list, skipped }, null, 1));
  try { const { buildStore } = await import("./ref_store.ts"); buildStore(o.dir, o.dir.split("/").pop()!); } catch { /* the index is regenerated by ref store */ }
  return { ok: true, downloaded: list.length, assets: list.map((a) => `${a.file} (${a.role}${a.width ? ", " + a.width + "x" + a.height : ""})`), skipped: skipped.slice(0, 8), manifest: "assets.json" };
}
function readUrl(dir: string): string | undefined { try { return (JSON.parse(readFileSync(join(dir, "outline.json"), "utf8")) as { url?: string }).url; } catch { return undefined; } }
