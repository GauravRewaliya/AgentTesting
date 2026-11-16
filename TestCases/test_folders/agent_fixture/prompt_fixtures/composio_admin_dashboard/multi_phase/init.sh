#!/bin/sh
# one command: check + serve the prototype (run from the workspace root)
set -e
bun --smol "$TOOLS" proto_check --dir run_test/agentdeck
bun --smol "$TOOLS" preview --dir run_test/agentdeck
