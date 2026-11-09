import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

# The positive counterpart: a question that local files and LSP cannot answer (external package version behaviour) -> the researcher IS called.
CASE = dict(
    id="l4_package_syntax_needs_subagent", title="External package knowledge needed: package-researcher must be called (once)", after="t3_build", inherit="workspace", external=True, setup=["lsp_trap"],
    agents=["package-researcher"], distractors=["poet"], tools=["Agent", "Read", "Edit", "Grep", "Glob", "LSP"], lead="lead_dev", lsp=True,
    turns=[dict(
        user="Will 'import shallow from \"zustand/shallow\"' in test_run/notes-app/ZustandDemo.js still work if we upgrade zustand to the latest major? Check the real syntax; do not change files.",
        allowed=["package-researcher"],
        expect=dict(calls=["package-researcher"], files_unchanged=["test_run/notes-app/ZustandDemo.js", "test_run/notes-app/store.js"]))])

if __name__ == "__main__": main(CASE)
