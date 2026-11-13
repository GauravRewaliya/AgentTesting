// SLIM RUNNER, built on the fly: a big collection repo (enzomanuelmangano/demos: one Expo app that registers hundreds of animations) cannot be bundled for the browser in a small container.
// This takes the repo that was just cloned (run_test/<cloneDir>) and makes a tiny Expo web app (run_test/<outDir>) with ONLY one demo folder (src/animations/<slug>) and the packages that folder imports
// (versions copied from the repo's package.json). The few things a demo takes from the app shell are replaced by shims. Nothing in the clone is changed. Returns notes about what it did.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const walk = (d: string, o: string[] = []): string[] => { for (const e of readdirSync(d)) { const p = join(d, e); statSync(p).isDirectory() ? walk(p, o) : /\.(ts|tsx|js|jsx)$/.test(e) && o.push(p); } return o; };
const pkgName = (s: string) => (s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0]!);
/** known app-shell modules a demo may import with a relative path (path ends with ...): the shim source written in their place */
const SHIMS: Record<string, string> = {
  "navigation/home/launch-transition": "export const isDemoClosing = () => false;\n",
};

export function buildSlim(o: { ws: string; cloneDir: string; slug: string; outDir: string }): { ok: boolean; notes: string[]; component?: string } {
  const notes: string[] = [], repo = join(o.ws, o.cloneDir), demo = join(repo, "src", "animations", o.slug), out = join(o.ws, o.outDir);
  if (!existsSync(demo)) return { ok: false, notes: [`demo folder src/animations/${o.slug} not found in the clone`] };
  const rp = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")), all: Record<string, string> = { ...rp.devDependencies, ...rp.dependencies };
  const files = walk(demo), bare = new Set<string>(), outside = new Set<string>();
  for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/(?:from\s+|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g)) {
    const s = m[1]!;
    if (!s.startsWith(".")) { if (/^[@a-z0-9]/i.test(s)) bare.add(pkgName(s)); } else { const t = resolve(dirname(f), s); if (!t.startsWith(demo)) outside.add(relative(join(repo, "src"), t)); }
  }
  const base = ["expo", "react", "react-dom", "react-native", "react-native-web", "@expo/metro-runtime"], deps: Record<string, string> = {};
  for (const n of [...base, ...bare]) if (all[n]) deps[n] = all[n]!; else if (n !== "react-native-web") notes.push(`package ${n} is not in the repo's package.json (left out)`);
  const dev: Record<string, string> = {}; for (const n of ["typescript", "@types/react"]) if (all[n]) dev[n] = all[n]!;
  const usesSkia = "react-native-skia" in deps;   // Skia on the WEB needs CanvasKit (wasm) loaded first: postinstall copies canvaskit.wasm to public/, App.tsx loads it with WithSkiaWeb
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "package.json"), JSON.stringify({ name: `${o.slug}-app`, version: "1.0.0", private: true, main: "index.js", scripts: { web: "expo start --web", ...(usesSkia ? { postinstall: "node node_modules/react-native-skia/scripts/setup-canvaskit.js" } : {}) }, dependencies: deps, devDependencies: dev }, null, 2) + "\n");
  writeFileSync(join(out, "app.json"), JSON.stringify({ expo: { name: o.slug, slug: o.slug, web: { bundler: "metro" }, newArchEnabled: true } }, null, 2) + "\n");
  writeFileSync(join(out, "tsconfig.json"), JSON.stringify({ extends: "expo/tsconfig.base", compilerOptions: { strict: false } }, null, 2) + "\n");
  // non-standard asset types the demo requires (e.g. .bin model/atlas files): Metro must treat them as assets
  const exts = new Set<string>(["bin"]); for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/(?:require\(\s*|from\s+)['"][^'"]+\.(bin|glb|gltf|obj|ktx|ktx2|wasm|mp3|wav|ttf|otf)['"]/g)) exts.add(m[1]!);
  writeFileSync(join(out, "metro.config.js"), `const { getDefaultConfig } = require('expo/metro-config');\nconst config = getDefaultConfig(__dirname);\nconfig.resolver.assetExts.push(${[...exts].map((e) => JSON.stringify(e)).join(", ")});\nmodule.exports = config;\n`);
  writeFileSync(join(out, "index.js"), "import { registerRootComponent } from 'expo';\nimport App from './App';\nregisterRootComponent(App);\n");
  cpSync(demo, join(out, "src", "animations", o.slug), { recursive: true });
  // the component: the registry of the repo says it (`'<slug>': Component,` and `import { Component } from './<folder>'`); fallback: the first named export of the demo's index
  const reg = existsSync(join(repo, "src", "animations", "registry.ts")) ? readFileSync(join(repo, "src", "animations", "registry.ts"), "utf8") : "";
  const idx = readFileSync(join(demo, existsSync(join(demo, "index.tsx")) ? "index.tsx" : "index.ts"), "utf8");
  const named = reg.match(new RegExp(`['"]${o.slug.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}['"]\\s*:\\s*(\\w+)`))?.[1] ?? idx.match(/export\s*\{\s*(\w+)(?:\s+as\s+\w+)?\s*[,}]/)?.[1] ?? idx.match(/export\s+(?:const|function)\s+(\w+)/)?.[1];
  const hasDefault = /export\s+default/.test(idx), comp = named ?? "Demo";
  writeFileSync(join(out, "App.tsx"), `import { View } from 'react-native';\nimport ${named ? `{ ${named} }` : "Demo"} from './src/animations/${o.slug}';\nexport default function App() {\n  return (\n    <View style={{ flex: 1, backgroundColor: '#000' }}>\n      <${comp} />\n    </View>\n  );\n}\n`);
  if (!named && !hasDefault) notes.push("no component export found for the demo (App.tsx may need a fix)");
  if (usesSkia && named) {
    writeFileSync(join(out, "App.tsx"), `import { View } from 'react-native';\n// Skia on web: CanvasKit (public/canvaskit.wasm, copied by the postinstall script) must be loaded BEFORE the demo module is evaluated, so the demo is imported dynamically afterwards\nconst { WithSkiaWeb } = require('react-native-skia/lib/module/web');\nexport default function App() {\n  return (\n    <View style={{ flex: 1, backgroundColor: '#000' }}>\n      <WithSkiaWeb opts={{ locateFile: (f: string) => '/' + f }} getComponent={() => import('./src/animations/${o.slug}').then((m) => ({ default: m.${named} }))} />\n    </View>\n  );\n}\n`);    notes.push("Skia web loader (WithSkiaWeb + canvaskit.wasm in public/)");
  }
  for (const t of outside) {
    const key = Object.keys(SHIMS).find((k) => t.startsWith(k));
    if (key) { const dst = join(out, "src", `${key}.tsx`); mkdirSync(dirname(dst), { recursive: true }); writeFileSync(dst, SHIMS[key]!); notes.push(`shim for ${t}`); } else notes.push(`UNSHIMMED import outside the demo: src/${t}`);
  }
  notes.push(`slim app run_test/${o.outDir}: ${Object.keys(deps).length} packages (${Object.keys(deps).join(", ")}), demo files: ${files.length}`);
  return { ok: true, notes, component: comp };
}
