// `proto_init`: the STARTER of a no-build prototype, made by the harness in milliseconds (no model call): the corporate design kit (kits/proto), the app shell with the sidebar built from the
// person's screens, one stub screen per nav item, one screens file per group (the unit a parallel builder owns), an empty css/pages-<group>.css each, `proto.json` and a `PROTO.md` contract.
// Builders then only write SCREENS (js/screens/<file>.js) and their own page css: no tokens, no shell, no router to invent, so a prototype is up in minutes and looks the same everywhere.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface NavItem { id: string; label: string; icon?: string; group?: string; file?: string }
const KIT = join(import.meta.dir, "..", "kits", "proto");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const pascal = (s: string) => s.replace(/(^|[-_ ])(\w)/g, (_, _a, c) => c.toUpperCase());
const ICONS = ["home", "grid", "list", "users", "key", "settings", "chart", "bell", "mail", "play", "link", "shield", "file", "box", "code", "card"];
const guessIcon = (l: string) => /overview|home|dashboard/i.test(l) ? "home" : /user|member|team|account|people|customer/i.test(l) ? "users" : /key|token|secret/i.test(l) ? "key" : /setting|org|config|prefer/i.test(l) ? "settings" : /log|audit|event|activity|history/i.test(l) ? "list" : /chart|analytic|report|metric|usage|billing/i.test(l) ? "chart" : /notif|alert/i.test(l) ? "bell" : /mail|message|inbox|chat/i.test(l) ? "mail" : /play|run|test|sandbox/i.test(l) ? "play" : /webhook|integr|connect|link/i.test(l) ? "link" : /secur|auth|permission|role/i.test(l) ? "shield" : /doc|file|page|content/i.test(l) ? "file" : /code|api|develop/i.test(l) ? "code" : /pay|card|invoice/i.test(l) ? "card" : /app|product|catalog|inventory|item|project/i.test(l) ? "grid" : "box";

/** `nav` is a JSON array (of strings or {id,label,icon,group,file}) or text: "Overview, Apps, Build>Logs, Build>Playground" ("Group>Label"). */
export function parseNav(raw: string): NavItem[] {
  let arr: unknown[];
  try { const j = JSON.parse(raw); arr = Array.isArray(j) ? j : []; } catch { arr = raw.split(/[,\n;|]/).map((s) => s.trim()).filter(Boolean); }
  const items: NavItem[] = arr.map((a): NavItem => {
    if (typeof a === "string") { const [g, l] = a.includes(">") ? a.split(">").map((x) => x.trim()) : ["", a.trim()]; return { id: slug(l!), label: l!, group: g || undefined }; }
    const o = a as Partial<NavItem>; const label = String(o.label ?? o.id ?? ""); return { id: slug(String(o.id ?? label)), label, icon: o.icon, group: o.group, file: o.file };
  }).filter((i) => i.label);
  const seen = new Set<string>(); const uniq = items.filter((i) => !seen.has(i.id) && seen.add(i.id));
  const grouped = uniq.some((i) => i.group || i.file);
  uniq.forEach((i, n) => { i.icon = ICONS.includes(i.icon ?? "") ? i.icon : guessIcon(i.label); i.file = slug(i.file ?? (grouped ? i.group || "main" : uniq.length > 4 ? `part-${Math.floor(n / 4) + 1}` : "main")); });
  return uniq;
}

export function protoInit(dir: string, o: { title: string; nav: NavItem[]; user?: string; org?: string; rel?: string }): { ok: true; files: string[]; screens_files: Record<string, string[]>; next: string } | { ok: false; reason: string } {
  if (!o.nav.length) return { ok: false, reason: "--nav needs at least one screen, for example --nav \"Overview, Apps, Logs\"" };
  if (existsSync(join(dir, "proto.json"))) return { ok: false, reason: `${dir} is already a prototype (proto.json exists): change its screens with a builder, do not start it again` };
  for (const d of ["css", "js/screens"]) mkdirSync(join(dir, d), { recursive: true });
  copyFileSync(join(KIT, "kit.css"), join(dir, "css", "kit.css")); copyFileSync(join(KIT, "kit.js"), join(dir, "js", "kit.js"));
  const byFile: Record<string, NavItem[]> = {}; for (const i of o.nav) (byFile[i.file!] ??= []).push(i);
  const written = ["css/kit.css", "js/kit.js"];
  for (const [f, items] of Object.entries(byFile)) {
    writeFileSync(join(dir, "css", `pages-${f}.css`), `/* classes only the screens of js/screens/${f}.js need (the kit has the rest) */\n`);
    writeFileSync(join(dir, "js", "screens", `${f}.js`), items.map((i) => `// TODO: replace this stub (route #/${i.id})\nScreens.${pascal(i.id)} = {\n  template: \`<div><div class="page-header"><div><h1>${i.label}</h1></div></div><div class="card"><ui-empty title="${i.label}" text="TODO: not built yet"></ui-empty></div></div>\`\n};\n`).join("\n"));
    written.push(`css/pages-${f}.css`, `js/screens/${f}.js`);
  }
  const files = Object.keys(byFile), title = o.title.replace(/["<>]/g, "");
  writeFileSync(join(dir, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link rel="stylesheet" href="css/kit.css">
${files.map((f) => `<link rel="stylesheet" href="css/pages-${f}.css">`).join("\n")}
</head><body><div id="app"></div>
<script src="https://unpkg.com/vue@3.5.13/dist/vue.global.prod.js"></script>
<script>window.Screens = {}; window.Components = {};</script>
<script src="js/kit.js"></script>
${files.map((f) => `<script src="js/screens/${f}.js"></script>`).join("\n")}
<script>Kit.mount({ title: ${JSON.stringify(title)}, user: ${JSON.stringify(o.user ?? "Alex Morgan")}, org: ${JSON.stringify(o.org ?? "Acme Inc.")}, home: ${JSON.stringify(o.nav[0]!.id)}, nav: ${JSON.stringify(o.nav.map(({ id, label, icon, group }) => ({ id, label, icon, group })))} });</script>
</body></html>
`);
  writeFileSync(join(dir, "proto.json"), JSON.stringify({ kit: 1, title, routes: o.nav.map((i) => ({ id: i.id, label: i.label, file: i.file })) }, null, 1));
  writeFileSync(join(dir, "PROTO.md"), `# ${title}: prototype contract
No build, no npm. Vue 3 from a CDN. \`index.html\` is DONE: do not edit it, \`css/kit.css\` or \`js/kit.js\`.

## Screens (one file each; the owner edits ONLY its file and its \`css/pages-<file>.css\`)
| route | screen | file | owner |
|---|---|---|---|
${o.nav.map((i) => `| #/${i.id} | Screens.${pascal(i.id)} | js/screens/${i.file}.js | ${i.file} |`).join("\n")}

Replace every stub (it says "TODO"). Detail views live in the SAME screen: route \`#/apps/42\` shows \`Screens.Apps\` with \`this.$route.parts = ['apps','42']\`; branch on it in the template (\`v-if="$route.parts[1]"\`). Link with \`<a href="#/apps/42">\` or \`$go('/apps/42')\`; \`$toast('Saved')\` shows a toast.

## Rules for every screen (a corporate, finished look)
- A screen: \`Screens.Name = { template: \`...\`, data() { return {...} }, computed, methods }\`. Mock data goes INSIDE your file (believable names, numbers, dates, statuses; 8-15 rows; never lorem ipsum, never "TODO" or "coming soon").
- Start with \`<div class="page-header"><div><h1>Title</h1><p>One line of purpose</p></div><div class="page-actions">buttons</div></div>\`. Then a \`.toolbar\` (search, filters), then the content. Every list: a search or filter that really filters, an empty state, a row that opens the detail view. Every button does something (opens \`ui-modal\`/\`ui-drawer\`, toasts, navigates). Forms validate (\`.field-error\`).
- Only kit classes below; no inline \`style=\`; a class you need beyond the kit goes in YOUR \`css/pages-<file>.css\`. \`proto_check\` lists classes defined nowhere.

## Design kit (classes)
layout \`.page-header .page-actions .toolbar .filter-bar .spacer .stack .row .right .grid-2 .grid-3 .grid-4 .card-grid .divider\` · surfaces \`.card .card-header .card-body .card-footer .stat(.label .value .delta.up|.down)\` · table \`.table-wrap > table.table\` (\`th.num td.num\`, \`tr.row-link\`) \`.pagination\` · buttons \`.btn .btn-primary .btn-ghost .btn-danger .btn-sm\` · forms \`.form .form-field(label, .input|.select|.textarea) .form-hint .field-error .form-actions .switch\` · \`.badge .badge-success|warning|danger|info|neutral\` · \`.tabs > button.tab(.active)\` · \`.kv\` (dl: dt/dd) · \`.code\` · \`.chip\` · \`.bars > i\` (set \`:style="{height: n+'%'}"\`, the only inline style allowed) · \`.steps > .step(.active|.done)\` · \`.skeleton\` · \`.muted .mono .num\`.
Components: \`<ui-badge status="Active">\` (colour from the word), \`<ui-modal title="..." @close="open=false">body<template #footer>buttons</template></ui-modal>\`, \`<ui-drawer ...>\` (same), \`<ui-empty title text><button class="btn">Action</button></ui-empty>\`, \`<ui-icon name="plus">\` (home grid list users key settings chart bell mail play link shield file plus search box code card x check).
Example table: \`<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Status</th><th class="num">Calls</th></tr></thead><tbody><tr v-for="r in rows" :key="r.id" class="row-link" @click="$go('/apps/'+r.id)"><td>{{ r.name }}</td><td><ui-badge :status="r.status"></ui-badge></td><td class="num">{{ r.calls }}</td></tr></tbody></table></div>\`
`);
  written.push("index.html", "proto.json", "PROTO.md");
  return { ok: true, files: written, screens_files: Object.fromEntries(Object.entries(byFile).map(([f, i]) => [`js/screens/${f}.js`, i.map((x) => x.label)])),
    next: `The shell already runs. Now ONE builder per screens file, all at once: fork_all (no --from) with one task per file, writes ["${o.rel ?? dir}/js/screens/<file>.js","${o.rel ?? dir}/css/pages-<file>.css"]; then wait, proto_check, preview. (Up to ~4 screens: ONE builder owning all files is enough.)` };
}
