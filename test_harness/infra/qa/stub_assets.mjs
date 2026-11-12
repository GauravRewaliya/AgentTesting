// Runs INSIDE the export container, on the COPY of the app: creates the binary assets (fonts, images, sounds) that the code or app.json refers to but the fixture does not have
// (a fixture is a text patch: it carries no fonts or images, so Metro cannot bundle the app). Fonts: a real .ttf copied from node_modules (an empty font would leave the app waiting on its fonts);
// images: a valid 1x1 PNG; the rest: empty files. The list goes to stdout and /out/stubbed_assets.txt, so a video of such an app is never mistaken for the real thing.
//   node stub_assets.mjs <app dir> <out dir>
import fs from "node:fs";
import path from "node:path";

const [root, out] = process.argv.slice(2), SKIP = new Set(["node_modules", ".git", "dist"]);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const EXT = /\.(png|jpe?g|gif|webp|svg|ttf|otf|woff2?|mp3|wav|m4a|mp4)$/i;
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (SKIP.has(e.name)) continue; const p = path.join(d, e.name); e.isDirectory() ? walk(p, o) : o.push(p); } return o; };
let font = null; const findFont = (d) => { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { const r = findFont(p); if (r) return r; } else if (/\.ttf$/i.test(e.name) && fs.statSync(p).size > 1000) return p; } } catch { /* ignore */ } return null; };
const created = [];
function ensure(p) {
  if (fs.existsSync(p)) return;
  const e = path.extname(p).toLowerCase(); fs.mkdirSync(path.dirname(p), { recursive: true });
  if (e === ".png") fs.writeFileSync(p, PNG);
  else if (e === ".svg") fs.writeFileSync(p, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  else if ([".ttf", ".otf", ".woff", ".woff2"].includes(e)) { font ??= findFont(path.join(root, "node_modules", "@expo")) ?? findFont(path.join(root, "node_modules")); font ? fs.copyFileSync(font, p) : fs.writeFileSync(p, ""); }
  else fs.writeFileSync(p, "");
  created.push(path.relative(root, p));
}
const ref = /(?:require\(\s*|from\s+|import\s+|import\(\s*)["'](\.{1,2}\/[^"']+)["']/g;
for (const f of walk(root).filter((f) => /\.(tsx?|jsx?|mjs)$/.test(f))) { const src = fs.readFileSync(f, "utf8"); for (const m of src.matchAll(ref)) if (EXT.test(m[1])) ensure(path.resolve(path.dirname(f), m[1])); }
for (const j of ["app.json", "app.config.json"]) { const p = path.join(root, j); if (!fs.existsSync(p)) continue; const strs = []; JSON.stringify(JSON.parse(fs.readFileSync(p, "utf8")), (k, v) => { if (typeof v === "string" && /^\.\/.+\.(png|jpe?g|svg|webp)$/i.test(v)) strs.push(v); return v; }); for (const s of strs) ensure(path.resolve(root, s)); }
const text = created.length ? `stubbed ${created.length} missing asset file(s) (the fixture has no binary assets):\n${created.join("\n")}\n` : "no missing assets\n";
console.log(text); if (out) fs.writeFileSync(path.join(out, "stubbed_assets.txt"), text);
