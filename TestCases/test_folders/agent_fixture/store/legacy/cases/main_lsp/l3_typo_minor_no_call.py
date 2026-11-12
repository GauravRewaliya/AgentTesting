import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

CASE = dict(
    id="l3_typo_minor_no_call", title="Tiny edit: no sub-agent, and no need for LSP", after="t3_build", inherit="workspace", external=True, setup=["lsp_trap"],
    agents=["package-researcher"], distractors=["poet"], tools=["Agent", "Read", "Edit", "Grep", "Glob", "LSP"], lead="lead_dev", lsp=True,
    turns=[dict(
        user="In test_run/notes-app/cart.js change the word 'Unrelated' to 'Independent' in the first comment line. Nothing else.", allowed=[],
        expect=dict(calls=[], tools=dict(Agent=dict(max=0), Edit=dict(min=1)), files_contain={"test_run/notes-app/cart.js": "Independent"},
                    files_unchanged=["test_run/notes-app/store.js", "test_run/notes-app/ZustandDemo.js"]),
        soft=dict(tools=dict(LSP=dict(max=0))))])

if __name__ == "__main__": main(CASE)
