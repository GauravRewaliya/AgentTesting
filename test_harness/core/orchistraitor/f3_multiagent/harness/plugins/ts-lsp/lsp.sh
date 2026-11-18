#!/bin/sh
# Starts the TypeScript language server for the LSP tool. Host install if present, else the sandbox image (nothing is installed on the host).
# initializationOptions.tsserver.path (.lsp.json) points at the image's global typescript 5.x (/opt/ts-lib = typescript/lib dir); a project's own typescript wins when it has one.
if command -v typescript-language-server >/dev/null 2>&1; then exec typescript-language-server --stdio; fi
exec docker run -i --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:$PWD" -w "$PWD" --entrypoint typescript-language-server agent-testing-claude:1 --stdio
