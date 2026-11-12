#!/usr/bin/env bash
# usage: fetch.sh <name> <dest> [phase n]
#   no n : the pinned final state (sources.json .sha; examples are just copied from ./examples)
#   n    : the state BEFORE phase n = phases.json[name][n-1].from (phase 1: the parent of its commit; later: the previous replayed commit). Empty dir if the path did not exist yet.
# The real change of phase n is patches/<name>/NN_<sha>.patch (never hand that to the agent).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); name=${1:?name}; dest=${2:?dest}; n=${3:-}
j() { jq -r ".\"$name\".$1 // empty" "$here/sources.json"; }
mkdir -p "$dest"
if [ -z "$n" ] && [ -n "$(j committed)" ]; then cp -r "$here/$(j committed)/." "$dest/"; exit 0; fi
if [ -n "$n" ]; then sha=$(jq -r ".\"$name\"[$((n-1))].from" "$here/phases.json"); else sha=$(j sha); [ -n "$sha" ] || sha=$(j base_sha); fi
path=$(j path); tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q && git -C "$tmp" remote add origin "$(j repo)"
git -C "$tmp" fetch -q --depth 1 origin "$sha" && git -C "$tmp" checkout -q FETCH_HEAD 2>/dev/null || { echo "(no such commit: empty start)"; exit 0; }
src="$tmp/${path:-.}"; [ -d "$src" ] || { echo "(path '$path' did not exist yet: empty start)"; exit 0; }
cp -r "$src/." "$dest/"; rm -rf "$dest/.git"
