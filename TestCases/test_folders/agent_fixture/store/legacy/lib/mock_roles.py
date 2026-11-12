"""Mock roles: no model. They copy/generate files into test_run/notes-app from the REAL expo/examples files in
fixtures/expo_examples (partial code on the fly) and print the sub-agent's reply."""
import json, os, re, shutil, sys
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); EX = f"{R}/test_cases/_fixtures/expo_examples"; WSD = os.environ.get("TEST_WS", f"{R}/test_run"); APP = f"{WSD}/notes-app"
role = sys.argv[1]; prompt = sys.stdin.read()
os.makedirs(f"{R}/trace", exist_ok=True); open(f"{R}/trace/handover_{role}.md", "w").write(prompt)
rd = lambda p: open(p).read(); rel = lambda p: os.path.relpath(p, os.path.dirname(WSD))
def wr(p, s): os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(s)
deps = lambda d: json.loads(rd(f"{EX}/{d}/package.json")).get("dependencies", {})

if role == "planner":
    wr(f"{APP}/plan.md", f"""# Plan: notes-app (Expo Go)
Task size: long
Goal: a small Expo app with drawer navigation whose screens share one list through a zustand store.
Sources (github.com/expo/examples): with-drawer-navigation (App.js, package.json), with-zustand (App.js, store.js, package.json)
Expo SDK in the drawer example: {deps('with-drawer-navigation').get('expo')}
Steps: 1 ux-designer writes the wireframe at the real paths. 2 builder replaces it with the original example code. 3 qa-reviewer checks.
Files: notes-app/App.js, notes-app/store.js, notes-app/package.json
Risks: the two examples were written for different dependency sets; merge package.json deps.
""")
    print(f"PLAN READY\npath: {rel(APP)}/plan.md\nTask size: long\nsources: with-drawer-navigation, with-zustand\nsteps: wireframe -> build (replace with original code) -> QA\nneeds approval before the wireframe")
elif role == "ux-designer":
    if not os.path.exists(f"{APP}/plan.md"): print("ERROR: plan.md not found, planner has not run"); sys.exit(0)
    head = "\n".join(rd(f"{EX}/with-drawer-navigation/App.js").splitlines()[:2])
    app = f"""// WIREFRAME (pseudo code) - the builder replaces this file with the original example code
{head}
// import store (zustand)            <- from with-zustand/store.js
Screen Home:          [Button "Open navigation drawer"] [List: store.items] [Button "Add Item" -> store.addItem]
Screen Notifications: [Button "Open navigation drawer"] [Button "Go back home"]
Drawer.Navigator initialRouteName="Home"  ->  Home, Notifications
"""
    store = """// WIREFRAME (pseudo code) - replaced by the builder
store: items[] ; addItem(text) ; reset()
"""
    wr(f"{APP}/App.js", app); wr(f"{APP}/store.js", store)
    wr(f"{APP}/wireframe.md", "```\n+-------------------+\n| =  Home           |\n| item #0           |\n| item #1           |\n| [Add Item][reset] |\n+-------------------+\n```\nDrawer: Home | Notifications\n")
    print(f"WIREFRAME READY\npaths: {rel(APP)}/App.js, {rel(APP)}/store.js, {rel(APP)}/wireframe.md\n--- App.js (wireframe) ---\n{app}--- store.js (wireframe) ---\n{store}")
elif role == "builder":
    if "WIREFRAME" not in (rd(f"{APP}/App.js") if os.path.exists(f"{APP}/App.js") else ""): print("ERROR: no wireframe to replace"); sys.exit(0)
    before = len(rd(f"{APP}/App.js").splitlines())
    shutil.copy(f"{EX}/with-drawer-navigation/App.js", f"{APP}/App.js"); shutil.copy(f"{EX}/with-zustand/store.js", f"{APP}/store.js")
    d = dict(deps("with-drawer-navigation")); d.update({k: v for k, v in deps("with-zustand").items()})
    wr(f"{APP}/package.json", json.dumps({"name": "notes-app", "main": "node_modules/expo/AppEntry.js", "dependencies": dict(sorted(d.items()))}, indent=2) + "\n")
    print(f"BUILD DONE\nreplaced {rel(APP)}/App.js ({before} -> {len(rd(f'{APP}/App.js').splitlines())} lines) with with-drawer-navigation/App.js\nreplaced {rel(APP)}/store.js with with-zustand/store.js\nwrote package.json ({len(d)} dependencies)\nnote: originals copied verbatim; HomeScreen is not wired to the store yet")
elif role == "qa-reviewer":
    c = []; ok = lambda n, b: c.append(f"{'PASS' if b else 'FAIL'} {n}")
    for f in ("App.js", "store.js", "package.json", "plan.md"): ok(f"{f} exists", os.path.exists(f"{APP}/{f}"))
    a = rd(f"{APP}/App.js") if os.path.exists(f"{APP}/App.js") else ""
    ok("no WIREFRAME marker left", "WIREFRAME" not in a); ok("App.js has createDrawerNavigator", "createDrawerNavigator" in a)
    p = rd(f"{APP}/package.json") if os.path.exists(f"{APP}/package.json") else ""
    ok("package.json has @react-navigation/drawer", "@react-navigation/drawer" in p); ok("App.js uses the store", "useStore" in a)
    print("QA RESULT\n" + "\n".join(c))
elif role == "package-researcher":
    low = prompt.lower()
    if "zustand" not in low: print("ERROR: mock knows only the package 'zustand'"); sys.exit(0)
    pj = f"{APP}/package.json"; rng = json.loads(rd(pj))["dependencies"].get("zustand", "?") if os.path.exists(pj) else deps("with-zustand").get("zustand", "?")
    code = rd(f"{APP}/store.js") if os.path.exists(f"{APP}/store.js") else ""
    chk = []
    if code:
        d = re.search(r'^import create from "zustand";?$', code, re.M)
        chk.append(f"store.js line {code[:d.start()].count(chr(10)) + 1}: `import create from \"zustand\"` -> OK for {rng} (v3 default export); breaks on zustand v5 (default export removed)" if d else "store.js: no default `create` import found")
        chk.append("store.js: `create((set, get) => ...)` with Object.assign(initialState, {...}) -> valid; plain object spread would be the usual style")
    else: chk.append("store.js not found at the given path")
    print(f"""RESEARCH: zustand (range in test_run/notes-app/package.json: {rng})
Syntax:
- create a store (v3): import create from "zustand"; const useStore = create((set, get) => ({{ items: [], addItem(text) {{ set(...) }} }}))
- shallow (v3): import shallow from "zustand/shallow"; useStore(selector, shallow)
- v4+/v5: import {{ create }} from "zustand"; import {{ shallow }} from "zustand/shallow" (v5 drops the default exports)
Checked code:
""" + "\n".join("- " + c for c in chk) + "\nConfidence: package knowledge written into this mock, not fetched from npm (unverified).")
elif role == "poet": print("POEM: roses are red, code is blue")
elif role == "release-notes-writer": print("NOTES: v1.0.0 - things changed")
else: print("ERROR: unknown role")
