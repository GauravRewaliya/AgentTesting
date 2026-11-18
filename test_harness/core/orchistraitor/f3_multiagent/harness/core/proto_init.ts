// `proto_init`: the STARTER of a no-build prototype, made by the harness in milliseconds (no model call): the corporate design kit (kits/proto), the app shell with the sidebar built from the
// person's screens, one stub screen per nav item, one screens file per group (the unit a parallel builder owns), an empty css/pages-<group>.css each, `proto.json` and a `PROTO.md` contract.
// Builders then only write SCREENS (js/screens/<file>.js) and their own page css: no tokens, no shell, no router to invent, so a prototype is up in minutes and looks the same everywhere.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface NavItem { id: string; label: string; icon?: string; group?: string; file?: string; hidden?: boolean }
const KIT = join(import.meta.dir, "..", "kits", "proto");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const pascal = (s: string) => s.replace(/(^|[-_ ])(\w)/g, (_, _a, c) => c.toUpperCase());
const ICONS = ["home", "grid", "list", "users", "key", "settings", "chart", "bell", "mail", "play", "link", "shield", "file", "box", "code", "card"];
const guessIcon = (l: string) => /overview|home|dashboard/i.test(l) ? "home" : /connected|account|integration|link|webhook/i.test(l) ? "link" : /user|member|team|people|customer/i.test(l) ? "users" : /key|token|secret/i.test(l) ? "key" : /setting|org|config|prefer/i.test(l) ? "settings" : /log|audit|event|activity|history/i.test(l) ? "list" : /chart|analytic|report|metric|usage|billing/i.test(l) ? "chart" : /notif|alert/i.test(l) ? "bell" : /mail|message|inbox|chat/i.test(l) ? "mail" : /play|run|test|sandbox/i.test(l) ? "play" : /secur|auth|permission|role/i.test(l) ? "shield" : /doc|file|page|content/i.test(l) ? "file" : /code|api|develop/i.test(l) ? "code" : /pay|card|invoice/i.test(l) ? "card" : /app|product|catalog|inventory|item|project/i.test(l) ? "grid" : "box";

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

export function protoInit(dir: string, o: { title: string; nav: NavItem[]; user?: string; org?: string; rel?: string; kind?: "app" | "site"; extra?: NavItem[]; accent?: string; font?: string; bgDark?: string; tagline?: string }): { ok: true; files: string[]; screens_files: Record<string, string[]>; next: string } | { ok: false; reason: string } {
  if (o.kind === "site") return siteInit(dir, o);
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
layout \`.page-header .page-actions .toolbar .filter-bar .spacer .stack .row .right .grid-2 .grid-3 .grid-4 .card-grid .divider\` · surfaces \`.card .card-header .card-body .card-footer .stat(.label .value .delta.up|.down) (a complete card by itself: never wrap it in .card)\` · table \`.table-wrap > table.table\` (\`th.num td.num\`, \`tr.row-link\`) \`.pagination\` · buttons \`.btn .btn-primary .btn-ghost .btn-danger .btn-sm\` · forms \`.form .form-field(label, .input|.select|.textarea) .form-hint .field-error .form-actions .switch\` · \`.badge .badge-success|warning|danger|info|neutral\` · \`.tabs > button.tab(.active)\` · \`.kv\` (dl: dt/dd) · \`.code\` · \`.chip\` · \`.bars > i\` (set \`:style="{height: n+'%'}"\`, the only inline style allowed) · \`.steps > .step(.active|.done)\` · \`.skeleton\` · \`.muted .mono .num\`.
Components: \`<ui-badge status="Active">\` (colour from the word), \`<ui-modal title="..." @close="open=false">body<template #footer>buttons</template></ui-modal>\`, \`<ui-drawer ...>\` (same), \`<ui-empty title text><button class="btn">Action</button></ui-empty>\`, \`<ui-icon name="plus">\` (home grid list users key settings chart bell mail play link shield file plus search box code card x check).
Example table: \`<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Status</th><th class="num">Calls</th></tr></thead><tbody><tr v-for="r in rows" :key="r.id" class="row-link" @click="$go('/apps/'+r.id)"><td>{{ r.name }}</td><td><ui-badge :status="r.status"></ui-badge></td><td class="num">{{ r.calls }}</td></tr></tbody></table></div>\`
`);
  appendKitReference(dir);
  written.push("index.html", "proto.json", "PROTO.md");
  return { ok: true, files: written, screens_files: Object.fromEntries(Object.entries(byFile).map(([f, i]) => [`js/screens/${f}.js`, i.map((x) => x.label)])),
    next: `The shell already runs. Now ONE builder per screens file, all at once: fork_all (no --from) with one task per file, writes ["${o.rel ?? dir}/js/screens/<file>.js","${o.rel ?? dir}/css/pages-<file>.css"]; then wait, proto_check, preview. (Up to ~4 screens: ONE builder owning all files is enough.)` };
}

// ---------------------------------------------------------------------------------------------------- SITE kind: a themeable marketing / blog WEBSITE (kits/site): header + footer + hash router built from the real route list, light/dark theme, scroll animations.
type Opts = Parameters<typeof protoInit>[1];
function siteInit(dir: string, o: Opts): ReturnType<typeof protoInit> {
  const SK = join(import.meta.dir, "..", "kits", "site");
  const pages = [...o.nav, ...(o.extra ?? []).filter((e) => !o.nav.some((n) => n.id === e.id))];
  if (!o.nav.length) return { ok: false, reason: "--nav needs at least one page, for example --nav \"Home, Features, Blog, About\"" };
  if (existsSync(join(dir, "proto.json"))) return { ok: false, reason: `${dir} is already a prototype (proto.json exists): change its pages with a builder, do not start it again` };
  for (const d of ["css", "js/screens"]) mkdirSync(join(dir, d), { recursive: true });
  copyFileSync(join(SK, "site.css"), join(dir, "css", "site.css")); copyFileSync(join(SK, "site.js"), join(dir, "js", "site.js"));
  const accent = /^#[0-9a-f]{3,8}$/i.test(o.accent ?? "") ? o.accent! : "#10b981", font = (o.font ?? "").replace(/[^\w \-]/g, "").trim();
  writeFileSync(join(dir, "css", "theme.css"), `/* BRAND TOKENS of this site (the kit reads them). Change colours / font / radius HERE, never in css/site.css. */\n:root{\n  --accent:${accent};\n${font ? `  --font:"${font}",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;\n` : ""}  --radius:14px;\n}\n${o.bgDark ? `:root[data-theme=dark]{\n  --bg:${o.bgDark};\n  --bg-soft:color-mix(in srgb,${o.bgDark} 95%,#fff);\n  --surface:color-mix(in srgb,${o.bgDark} 93%,#fff);\n  --header-bg:color-mix(in srgb,${o.bgDark} 78%,transparent);\n}\n` : ""}`);
  if (pages.every((p) => !p.group)) pages.forEach((p, n) => { p.file = pages.length > 2 ? `part-${Math.floor(n / 2) + 1}` : "main"; });   // balanced files: ~2 pages per builder (writing is generation time: more files = more builders in parallel)
  const byFile: Record<string, NavItem[]> = {}; for (const i of pages) (byFile[i.file!] ??= []).push(i);
  const written = ["css/site.css", "js/site.js", "css/theme.css"];
  for (const [f, items] of Object.entries(byFile)) {
    writeFileSync(join(dir, "css", `pages-${f}.css`), `/* classes only the pages of js/screens/${f}.js need (the kit has the rest) */\n`);
    writeFileSync(join(dir, "js", "screens", `${f}.js`), items.map((i) => `// TODO: replace this stub (route #/${i.id})\nScreens.${pascal(i.id)} = {\n  template: \`<section class="section"><div class="container center"><h1>${i.label}</h1><p class="muted">TODO: this page is not built yet</p></div></section>\`\n};\n`).join("\n"));
    written.push(`css/pages-${f}.css`, `js/screens/${f}.js`);
  }
  const files = Object.keys(byFile), title = o.title.replace(/["<>]/g, ""), ids = pages.map((p) => p.id), half = Math.ceil(pages.length / 2);
  const footer = [{ title: "Explore", links: pages.slice(0, half).map((p) => ({ label: p.label, to: p.id })) }, ...(pages.length > half ? [{ title: "More", links: pages.slice(half).map((p) => ({ label: p.label, to: p.id })) }] : [])];
  const cta = o.nav.length > 2 ? { label: o.nav[o.nav.length - 1]!.label, to: o.nav[o.nav.length - 1]!.id } : undefined;
  const headerNav = cta ? o.nav.slice(0, -1) : o.nav;
  writeFileSync(join(dir, "index.html"), `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
${font ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}:wght@400;500;600;700;800&display=swap">\n` : ""}<link rel="stylesheet" href="css/site.css">
<link rel="stylesheet" href="css/theme.css">
${files.map((f) => `<link rel="stylesheet" href="css/pages-${f}.css">`).join("\n")}
</head><body><div id="app"></div>
<script src="https://unpkg.com/vue@3.5.13/dist/vue.global.prod.js"></script>
<script>window.Screens = {}; window.Components = {};</script>
<script src="js/site.js"></script>
${files.map((f) => `<script src="js/screens/${f}.js"></script>`).join("\n")}
<script>Site.mount({ title: ${JSON.stringify(title)}, tagline: ${JSON.stringify(o.tagline ?? "Everything you need, nothing you don't.")}, home: ${JSON.stringify(o.nav[0]!.id)}, routes: ${JSON.stringify(ids)}, nav: ${JSON.stringify(headerNav.map(({ id, label }) => ({ id, label })))}, cta: ${JSON.stringify(cta)}, footer: ${JSON.stringify(footer)} });</script>
</body></html>
`);
  writeFileSync(join(dir, "proto.json"), JSON.stringify({ kit: "site", title, routes: pages.map((i) => ({ id: i.id, label: i.label, file: i.file })) }, null, 1));
  writeFileSync(join(dir, "PROTO.md"), `# ${title}: website contract
A real multi-page WEBSITE (sections, themes, motion), no build, Vue 3 from a CDN. \`index.html\`, \`css/site.css\`, \`js/site.js\` are DONE: do not edit them. Brand tokens (accent, font, dark background) live in \`css/theme.css\`.

## Pages (one file each group; the owner edits ONLY its file and its \`css/pages-<file>.css\`)
| route | page | file |
|---|---|---|
${pages.map((i) => `| #/${i.id} | Screens.${pascal(i.id)} | js/screens/${i.file}.js |`).join("\n")}

The header and footer already link to EVERY page above (the kit builds them from this list), the theme follows the system (light / dark) with a toggle, and \`.reveal\` content animates in on scroll. Replace every stub (it says TODO).

## Linking rules (a dead link is a defect)
- Every link is \`<a href="#/route">\` (a route above, or \`#/blog/<slug>\` for an article of the Blog page) or a full https URL. NEVER \`href="#"\`. A button goes somewhere (\`@click="$go('/features')"\`) or does something (\`$toast('Thanks')\`).
- Detail pages live in the SAME page: \`#/blog/my-post\` shows \`Screens.Blog\` with \`this.$route.parts = ['blog','my-post']\`; branch in the template (\`v-if="post"\` article, \`v-else\` the list; an unknown slug shows "Article not found"). EVERY card / title / "Read more" of a list links to its own detail view, and the article links back and to related articles.
- Sections of one page: they are stacked in the page itself; a nav item never needs an in-page anchor.

## Page recipe (a finished, professional look)
Each page = 3-6 \`<section class="section">\` (alternate \`.alt\`), each with \`.section-head\` (\`.eyebrow\`, h2, p) and real content: \`.hero\`, \`.grid-3 > .card.feature\` (\`.ico\` + h3 + p), \`.steps > .step\`, \`.stats > .stat\`, \`.logos > .logos-track\` (marquee, duplicate the items once), \`.grid-3 > .card.plan\` (\`.price\`, \`.checks\`), \`.card.quote\`, \`.faq > details > summary + p\`, \`.cta-band\`, \`.post-grid > a.card.post-card\` (\`.post-thumb-wrap > .post-thumb\`, \`.post-body\` with \`.post-meta\`, \`.post-title\`, \`.post-excerpt\`), \`.prose\` for article text, \`.form\` + \`.input\`. Add \`class="reveal"\` (and \`d1\`..\`d4\` for stagger) to cards and headings so they animate on scroll. Use \`.grad\` on one headline word. Icons: \`<ui-icon name="bolt">\` (arrow bell bolt chart check clock code cloud download file globe heart lock mail moon play search shield star sun users zap layers target).
Buttons \`.btn .btn-primary .btn-lg .btn-ghost\`, \`.pill\`, \`.chip\`, \`.tag\`, \`.muted\`, \`.center\`, \`.row\`, \`.stack\`, \`.container\`, \`.narrow\`. Mock content is original, believable, specific (never lorem ipsum, never TODO); 4-8 posts with dates, authors, categories.
`);
  appendKitReference(dir);
  written.push("index.html", "proto.json", "PROTO.md");
  return { ok: true, files: written, screens_files: Object.fromEntries(Object.entries(byFile).map(([f, i]) => [`js/screens/${f}.js`, i.map((x) => x.label)])),
    next: `The site shell already runs (header, footer, theme, router). Now ONE builder per pages file, ALL AT ONCE: fork_all with one task per file, writes ["${o.rel ?? dir}/js/screens/<file>.js","${o.rel ?? dir}/css/pages-<file>.css"] (the objective names the reference: run_test/_ref/<name>/REF.md and its section pictures); then wait, ref_compare, preview.` };
}

/** Append a generated KIT REFERENCE to PROTO.md: every CSS class, icon name and helper the kit offers. A builder used to find these with 3-5 grep calls (each one a model turn that re-reads the whole context); now one read of PROTO.md has them. Generated from the real files, so it cannot drift. */
function appendKitReference(dir: string): void {
  try {
    const rd = (f: string) => { try { return readFileSync(join(dir, f), "utf8"); } catch { return ""; } };
    const css = rd("css/site.css") || rd("css/kit.css"), js = rd("js/site.js") || rd("js/kit.js");
    const classes = [...new Set([...css.matchAll(/(?:^|[},\s])\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]!))].slice(0, 200);
    const icons = [...(/ICONS\s*=\s*\{([\s\S]*?)\};/.exec(js)?.[1] ?? "").matchAll(/(?:^|[,{\s])([a-z][\w-]*)\s*:\s*'/g)].map((m) => m[1]!);
    const helpers = [...new Set([...js.matchAll(/\$(?:go|toast|route|theme|nav)\b/g)].map((m) => m[0]))];
    const vars = [...new Set([...rd("css/theme.css").matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]!))];
    if (!classes.length && !icons.length) return;
    const md = `\n## Kit reference (generated from the real kit files: do NOT grep or read site.css / site.js to find these)\n`
      + (classes.length ? `- **CSS classes:** ${classes.map((c) => "." + c).join(" ")}\n` : "")
      + (icons.length ? `- **Icons** (\`<ui-icon name="...">\`): ${icons.join(", ")}\n` : "")
      + (helpers.length ? `- **Helpers in templates:** ${helpers.join(" ")} (\`$go('/route')\`, \`$toast('text')\`)\n` : "")
      + (vars.length ? `- **Theme variables** (css/theme.css): ${vars.join(" ")}\n` : "");
    writeFileSync(join(dir, "PROTO.md"), readFileSync(join(dir, "PROTO.md"), "utf8") + md);
  } catch { /* the reference is a help, never a failure */ }
}
