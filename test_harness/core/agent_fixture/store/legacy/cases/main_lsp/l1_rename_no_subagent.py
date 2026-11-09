import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

CASE = dict(
    id="l1_rename_no_subagent", title="Rename a function across files by itself: no sub-agent; the unrelated cart.addItem must stay; is LSP used?",
    after="t3_build", inherit="workspace", external=True, setup=["lsp_trap"],
    agents=["package-researcher"], distractors=["poet"], tools=["Agent", "Read", "Edit", "Grep", "Glob", "LSP"], lead="lead_dev", lsp=True,
    turns=[dict(
        user="In test_run/notes-app rename the store method addItem to appendItem and update every place that uses it.",
        allowed=[],
        expect=dict(calls=[], tools=dict(Agent=dict(max=0), Edit=dict(min=1)),
                    files_contain={"test_run/notes-app/store.js": "appendItem", "test_run/notes-app/ZustandDemo.js": "appendItem"},
                    files_absent_text={"test_run/notes-app/store.js": "addItem", "test_run/notes-app/ZustandDemo.js": "addItem"},
                    files_unchanged=["test_run/notes-app/cart.js"]),
        soft=dict(tools=dict(LSP=dict(min=1)), lsp_ok=True))])

if __name__ == "__main__": main(CASE)
