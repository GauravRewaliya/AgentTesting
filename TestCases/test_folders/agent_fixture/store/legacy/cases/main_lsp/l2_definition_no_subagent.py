import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

CASE = dict(
    id="l2_definition_no_subagent", title="Find a definition and explain it from the code: no sub-agent, no edits; LSP/Read/Grep are enough",
    after="t3_build", inherit="workspace", external=True, setup=["lsp_trap"],
    agents=["package-researcher"], distractors=["poet"], tools=["Agent", "Read", "Edit", "Grep", "Glob", "LSP"], lead="lead_dev", lsp=True,
    turns=[dict(
        user="Where is useReset defined in test_run/notes-app and what does it do? Answer from the code.", allowed=[],
        expect=dict(calls=[], tools=dict(Agent=dict(max=0), Edit=dict(max=0)), reply_contains=["store.js"],
                    files_unchanged=["test_run/notes-app/store.js", "test_run/notes-app/ZustandDemo.js", "test_run/notes-app/cart.js"]),
        soft=dict(tools=dict(LSP=dict(min=1))))])

if __name__ == "__main__": main(CASE)
