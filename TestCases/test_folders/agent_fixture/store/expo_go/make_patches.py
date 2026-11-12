#!/usr/bin/env python3
"""Regenerates phases.json + patches/ (+ the package.json of bases/) from the real git history.
usage: python3 -I make_patches.py <dir with the clones> <out dir (this folder)>
Clones needed (git clone --filter=blob:none --no-checkout): expo_examples, Solarin-Johnson_my-app, SchroederNathan_linear-tab-bar, enzomanuelmangano_demos.

Two kinds of project, because version history is noise (we always code against the NEWEST versions):
 * SNAPSHOT  (the two expo/examples we use, tailwindcss and storybook: their history is almost only SDK bumps): ONE phase, the patch builds the project from nothing to its latest state.
 * HISTORY   (demos with real feature commits): one phase per replayed commit. Phase n's patch is the NET diff from the previous replayed phase (phase 1: from the parent of its commit),
             so phases 1..n applied in order always apply cleanly; skipped commits that touched the folder are folded in (`folded`).
             If `modern` is set, package.json is NOT taken from history: its package names come from the commit, its VERSIONS from the repo's latest package.json
             (names the latest no longer has keep their old version and are listed in `legacy_pins`).
Lockfiles, images, fonts, audio, videos and READMEs are left out of every patch."""
import subprocess, json, os, sys, difflib
SC, OUT = sys.argv[1], sys.argv[2]
EMPTY = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"   # git's empty tree
SNAP = {  # name: (clone, pathspec, commit whose tree is the "latest")
 "with-tailwindcss": ("expo_examples", "with-tailwindcss", "2cc7a440b01eb30e326b91cf1f3aae41e749d128"),
 "with-storybook": ("expo_examples", "with-storybook", "2cc7a440b01eb30e326b91cf1f3aae41e749d128"),
}
HIST = {  # name: (clone, pathspec, [replayed commits, oldest first], modern package.json?)
 "solarin-my-app": ("Solarin-Johnson_my-app", ".", ["754eb25","7371b88","08b0cce"], True),
 "linear-tab-bar": ("SchroederNathan_linear-tab-bar", ".", ["4da28ef","4072c98","66e5453","0d61032","a044717","9e692f9","c5a53ac","8e22f6b","3c78584","655c4e0"], True),
 "enzo-clerk-toast": ("enzomanuelmangano_demos", "src/animations/clerk-toast", ["dc0dafa","917f84d","94b0327","881adc6","8c8c533","7aae7eb","aac472e","2837819","bb5aea4"], False),
}
EXC = [":(exclude)*lock*"] + [f":(exclude)*.{e}" for e in "png jpg jpeg gif mp4 mp3 wav otf ttf ico webp".split()] + [":(exclude)README.md", ":(exclude)*/README.md"]
G = lambda cl: (lambda *a: subprocess.run(["git", "-C", f"{SC}/{cl}", *a], capture_output=True, text=True).stdout)
SECTIONS = ("dependencies", "devDependencies", "peerDependencies")

def modern(old_txt, latest_txt):
    """names from the old package.json, versions from the latest one. Returns (text, [names kept at an old version])."""
    old, new = json.loads(old_txt), json.loads(latest_txt)
    latest = {k: v for s in SECTIONS for k, v in (new.get(s) or {}).items()}
    legacy = []
    for s in SECTIONS:
        if s in old:
            for k in list(old[s]):
                if k in latest: old[s][k] = latest[k]
                else: legacy.append(k)
            old[s] = dict(sorted(old[s].items()))
    return json.dumps(old, indent=2) + "\n", sorted(set(legacy))

def udiff(prev, cur, rel):
    a = "/dev/null" if prev is None else f"a/{rel}"
    d = "".join(difflib.unified_diff((prev or "").splitlines(True), cur.splitlines(True), a, f"b/{rel}"))
    return f"diff --git a/{rel} b/{rel}\n" + ("new file mode 100644\n" if prev is None else "") + d if d else ""

os.makedirs(f"{OUT}/patches", exist_ok=True)
ph = {}
for name, (cl, path, final) in SNAP.items():
    g = G(cl); d = f"{OUT}/patches/{name}"; os.makedirs(d, exist_ok=True)
    for f in os.listdir(d): os.remove(f"{d}/{f}")
    last = g("log", "-1", "--format=%H", final, "--", path).strip()
    p = g("diff", "--no-color", EMPTY, final, "--", path, *EXC)
    fn = f"01_{last[:7]}.patch"; open(f"{d}/{fn}", "w").write(p)
    ph[name] = [{"n": 1, "sha": last, "from": EMPTY, "folded": int(g("rev-list", "--count", final, "--", path).strip()) - 1, "snapshot": True,
                 "date": g("log", "-1", "--format=%ad", "--date=short", last).strip(),
                 "subject": f"{name} at the latest Expo SDK (state of {last[:7]}: {g('log','-1','--format=%s',last).strip()[:60]})",
                 "patch": f"patches/{name}/{fn}", "files": [l[6:] for l in p.splitlines() if l.startswith("+++ b/")], "patch_bytes": len(p)}]
for name, (cl, path, shas, mod) in HIST.items():
    g = G(cl); d = f"{OUT}/patches/{name}"; os.makedirs(d, exist_ok=True)
    for f in os.listdir(d): os.remove(f"{d}/{f}")
    latest_pkg = g("show", "origin/HEAD:package.json") if mod else None
    pj = "package.json" if path == "." else f"{path}/package.json"
    ph[name] = []; prev = None; prev_pkg = None
    for i, s in enumerate(shas, 1):
        full = g("rev-parse", s).strip(); frm = prev or g("rev-parse", s + "^").strip()
        folded = max(0, int(g("rev-list", "--count", f"{frm}..{full}", "--", path).strip() or 1) - 1)
        exc = EXC + ([f":(exclude){pj}"] if mod else [])
        p = g("diff", "--no-color", frm, full, "--", path, *exc); legacy = []
        if mod:
            if prev_pkg is None:   # the start state's package.json, modernised too (written into bases/ below)
                t0 = g("show", f"{frm}:{pj}")
                prev_pkg = modern(t0, latest_pkg)[0] if t0 else None
                if prev_pkg and os.path.isdir(f"{OUT}/bases/{name}"): open(f"{OUT}/bases/{name}/{pj}", "w").write(prev_pkg)
            cur_old = g("show", f"{full}:{pj}")
            cur, legacy = modern(cur_old, latest_pkg)
            p += udiff(prev_pkg, cur, pj); prev_pkg = cur
        fn = f"{i:02d}_{s}.patch"; open(f"{d}/{fn}", "w").write(p)
        row = {"n": i, "sha": full, "from": frm, "folded": folded, "date": g("log", "-1", "--format=%ad", "--date=short", s).strip(),
               "subject": g("log", "-1", "--format=%s", s).strip(), "patch": f"patches/{name}/{fn}",
               "files": [l[6:] for l in p.splitlines() if l.startswith("+++ b/")], "patch_bytes": len(p)}
        if legacy: row["legacy_pins"] = legacy
        ph[name].append(row); prev = full
json.dump(ph, open(f"{OUT}/phases.json", "w"), indent=1)
for n, l in ph.items():
    print(n); [print("  ", x["n"], x["sha"][:7], "folded", x["folded"], x["patch_bytes"], "B", len(x["files"]), "files", "legacy:" + ",".join(x.get("legacy_pins", [])) if x.get("legacy_pins") else "") for x in l]
