import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

# Is the LSP tool usable at all in this setup? (the installed typescript-lsp plugin needs a typescript-language-server binary that is not on PATH;
# this case wires the locally installed one: test_cases/_tools)
CASE = dict(
    id="l0_lsp_probe", title="LSP probe: does a hover / definition call return real data?", after="t3_build", inherit="workspace", external=True, setup=["lsp_trap"],
    agents=["package-researcher"], distractors=["poet"], tools=["Agent", "Read", "Edit", "Grep", "Glob", "LSP"], lead="lead_dev", lsp=True,
    turns=[dict(
        user="Use the LSP tool (not grep) to find where useReset is defined in test_run/notes-app and tell me file and line. If the LSP tool errors, quote the error.",
        allowed=[],
        expect=dict(calls=[], lsp_ok=True, tools=dict(LSP=dict(min=1)), reply_contains=["store.js"]))])

if __name__ == "__main__": main(CASE)
