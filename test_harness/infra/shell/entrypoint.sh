#!/bin/sh
# Start of the Shell terminal. The home folder is a named volume (agent-testing-home) that survives every container, so a login is done ONCE.
# First start only: seed `gh` and git from the host (read-only mounts at /host), so you are logged in without doing anything.
H="${HOME:-/home/node}"; mkdir -p "$H/.config"
if [ ! -e "$H/.config/gh/hosts.yml" ] && [ -f /host/gh/hosts.yml ]; then mkdir -p "$H/.config/gh" && cp -r /host/gh/. "$H/.config/gh/" && echo "[shell] gh login copied from the host (once)"; fi
if [ ! -e "$H/.gitconfig" ] && [ -f /host/gitconfig ]; then cp /host/gitconfig "$H/.gitconfig"; fi
[ -e "$H/.bashrc" ] || cp /etc/skel/.bashrc "$H/.bashrc" 2>/dev/null || true
if command -v gh >/dev/null 2>&1; then gh auth status >/dev/null 2>&1 && echo "[shell] gh: $(gh auth status 2>&1 | grep -m1 'Logged in' | sed 's/^.*account //')" || echo "[shell] gh is not logged in: run  gh auth login"; fi
exec "$@"
