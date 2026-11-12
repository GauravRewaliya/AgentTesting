"""CLI over the case files.  python3 -I test_cases/run.py --list | --status | <case id> [<case id> ...] [--deps] [--fresh] [--keep]
Nothing runs unless you name it. A case that continues another needs that one's checkpoint (or --deps to run it first)."""
import glob, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib"))
import harness as h
a = sys.argv[1:]; ids = [x for x in a if not x.startswith("--")]
def info(f):
    ns = {}; src = open(f).read().split("if __name__")[0]; src = src.split("from harness import main")[-1]
    exec(src, ns); return ns["CASE"]
if "--list" in a or "--status" in a or not ids:
    print(f"{'case':38} {'after':22} agents / useless / skills / tools   checkpoint")
    for f in sorted(glob.glob(f"{h.TC}/main_*/*.py")):
        if os.path.basename(f).startswith("g0"): print(f"{os.path.basename(f)[:-3]:38} (free, offline: python3 -I {os.path.relpath(f, h.R)})"); continue
        c = info(f); ck = f"{h.STATE}/{c['id']}/ckpt.json"
        st = json.load(open(ck))["at"] if os.path.exists(ck) else "-"
        print(f"{c['id']:38} {str(c.get('after') or '-'):22} {c.get('agents', [])} / {c.get('distractors', [])} / {c.get('skills', [])} / {c.get('tools') or 'default'}   {st}")
    sys.exit(0)
ok = all([h.load_and_run(i, "--deps" in a, "--fresh" in a, "--keep" in a) for i in ids]); sys.exit(0 if ok else 1)
