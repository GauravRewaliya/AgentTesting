// Zero-dependency static file server for a prototype folder (index.html + js/css): `bun static_server.ts <port> [dir]`. Used by `preview` for a folder without package.json: nothing is installed, nothing is built.
import { existsSync, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
const port = Number(process.argv[2] ?? 8080), root = resolve(process.argv[3] ?? ".");
Bun.serve({
  port, hostname: process.env.PREVIEW_BIND ?? "0.0.0.0",
  fetch(req) {
    const p = normalize(decodeURIComponent(new URL(req.url).pathname)).replace(/^(\.\.[/\\])+/, "");
    let f = join(root, p); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!f.startsWith(root) || !existsSync(f)) f = join(root, "index.html");   // unknown path = the app (hash routes keep working, a refresh does not 404)
    return new Response(Bun.file(f), { headers: { "cache-control": "no-store" } });
  },
});
console.log(`static prototype on http://0.0.0.0:${port}  (${root})`);
