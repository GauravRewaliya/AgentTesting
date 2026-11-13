// Runs INSIDE the export container, on the COPY of the app. Makes the app buildable for the BROWSER ONLY (a video needs a web page, not a native build):
//   1. app.json web.output = "single": a single-page app rendered in the browser (no server-side render in Node, where native-only modules crash)
//   2. ONE instance of each package that holds a React context (default ^@react-navigation/): the app imports it as an ES module, expo-router requires it as CommonJS; Metro then bundles BOTH builds and a hook
//      from one cannot see the context of the other ("Couldn't find a drawer", proven by two copies of the hook in the bundle). On web every importer is resolved from the project root with the same conditions. Add regexes with QA_SINGLE_COPY="re1,re2"
//   3. native-only modules (iOS/Android UI such as @expo/ui/swift-ui) are replaced, ON WEB ONLY, by an empty stub (every export is a component that renders nothing)
//      default list: ^@expo/ui/(swift-ui|jetpack-compose); add more regexes with QA_NATIVE_ONLY="re1,re2"
// An existing metro.config.js is kept (renamed metro.config.orig.js) and wrapped. Prints what it changed (it goes to /out/added_deps.txt next to the other notes).
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2], notes = [], single = ["^@react-navigation/", ...(process.env.QA_SINGLE_COPY ?? "").split(",").filter(Boolean)], list = ["^@expo/ui/(swift-ui|jetpack-compose)", ...(process.env.QA_NATIVE_ONLY ?? "").split(",").filter(Boolean)];
const aj = path.join(root, "app.json");
if (fs.existsSync(aj)) { const j = JSON.parse(fs.readFileSync(aj, "utf8")); j.expo ??= {}; j.expo.web = { ...(j.expo.web ?? {}), output: "single" }; // 3. no lazy route chunks: Expo splits each route into an async chunk, and a module shared between chunks can end up bundled twice (two React contexts) or lost: expo-router plugin option asyncRoutes=false
  j.expo.plugins = (j.expo.plugins ?? []).map((p) => { const [name, opts] = Array.isArray(p) ? p : [p, {}]; return name === "expo-router" ? [name, { ...opts, asyncRoutes: false }] : p; });
  fs.writeFileSync(aj, JSON.stringify(j, null, 2)); notes.push("web-only copy: app.json web.output=single, expo-router asyncRoutes=false"); }
fs.writeFileSync(path.join(root, "__web_stub.js"), 'const C = () => null;\nmodule.exports = new Proxy({}, { get: (_, k) => (k === "__esModule" ? true : C) });\n');
const mc = path.join(root, "metro.config.js"); let base = 'require("expo/metro-config").getDefaultConfig(__dirname)';
if (fs.existsSync(mc)) { fs.renameSync(mc, path.join(root, "metro.config.orig.js")); base = 'require("./metro.config.orig.js")'; }
fs.writeFileSync(mc, `const config = ${base};
const NATIVE_ONLY = ${JSON.stringify(list)}.map((s) => new RegExp(s));
const SINGLE_COPY = ${JSON.stringify(single)}.map((s) => new RegExp(s));
const upstream = config.resolver.resolveRequest, hits = { single: 0, stub: 0, web: 0, other: 0 };
process.on("exit", () => { console.error("[web_only] rule hits:", JSON.stringify(hits)); for (const k of global.__seen ?? []) console.error("[web_only] resolved:", k); for (const k of global.__stubbed ?? []) console.error("[web_only] STUBBED (unresolved):", k); });
config.resolver.resolveRequest = (ctx, name, platform) => {
  hits[platform === "web" ? "web" : "other"]++;
  if (platform === "web" && NATIVE_ONLY.some((r) => r.test(name))) { hits.stub++; return { type: "sourceFile", filePath: require("path").join(__dirname, "__web_stub.js") }; }
  if (platform === "web" && SINGLE_COPY.some((r) => r.test(name))) { hits.single++; let r; try { r = ctx.resolveRequest({ ...ctx, originModulePath: require("path").join(__dirname, "package.json"), unstable_conditionNames: ["react-native", "browser", "require", "default"] }, name, platform); } catch (e) { r = (upstream ?? ctx.resolveRequest)(ctx, name, platform); }   /* not resolvable from the app root (a transitive package the app does not declare): resolve it normally */ if (/drawer/.test(name)) { const k = String(ctx.originModulePath).split("node_modules/").pop().slice(0, 60) + "  ->  " + name + "  =>  " + String(r.filePath).split("node_modules/").pop().slice(0, 90); (global.__seen = global.__seen || new Set()).add(k); } return r; }   // one copy AND one BUILD: an app import (ESM build) and an expo-router require (CJS build) otherwise load the package twice and each gets its own React context
  if (platform === "web" && process.env.QA_STUB_UNRESOLVED === "1") {   // OPT-IN (case qa spec: stub_unresolved): a big collection repo has optional/native packages nobody installs for web; an unresolved bare package becomes an empty stub instead of stopping the bundle
    try { return (upstream ?? ctx.resolveRequest)(ctx, name, platform); }
    catch (e) { if (/^[@a-z]/i.test(name) && !name.startsWith(".")) { hits.stub++; (global.__stubbed = global.__stubbed || new Set()).add(name); return { type: "sourceFile", filePath: require("path").join(__dirname, "__web_stub.js") }; } throw e; }
  }
  return (upstream ?? ctx.resolveRequest)(ctx, name, platform);
};
module.exports = config;
`);
notes.push(`web-only copy: native-only modules stubbed on web: ${list.join(" , ")}; single copy forced for: ${single.join(" , ")}`);
console.log(notes.join("\n"));
