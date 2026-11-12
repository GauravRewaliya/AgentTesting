# Runs INSIDE the export container (sh /qa/export.sh): prepare (see prepare.sh), then `expo export --platform web`; an undeclared import is added at the version the tree already uses, then retry. Target: under 4 minutes.
. /qa/prepare.sh
i=0
while [ "$i" -lt 4 ]; do
  if corepack pnpm exec expo export --platform web --output-dir /out/dist ${QA_EXPORT_DEBUG:+--dev --no-minify} > /tmp/export.out 2>&1; then cat /tmp/export.out; lap "export done"
  # save the lockfile + final package.json ATOMICALLY (copy, then rename): a parallel job never reads a half-written file
  mkdir -p "$LOCKD" && for f in pnpm-lock.yaml package.json; do cp $APP/$f "$LOCKD/$f.$$" && mv -f "$LOCKD/$f.$$" "$LOCKD/$f"; done; exit 0; fi
  cat /tmp/export.out
  pkg=$(grep -o 'Unable to resolve "[^"./][^"]*"' /tmp/export.out | head -1 | sed 's/Unable to resolve "//; s/"$//')
  [ -z "$pkg" ] && exit 1
  base=$(echo "$pkg" | awk -F/ '{ if (substr($1,1,1)=="@") print $1"/"$2; else print $1 }')
  # the version the tree ALREADY uses (e.g. the one @react-navigation/drawer depends on): "latest" would make a second copy and break shared context ("Couldn't find a drawer")
  ver=$(find node_modules -path "*/node_modules/$base/package.json" 2>/dev/null | head -1 | xargs -r -I{} node -p 'require(require("path").resolve("{}")).version')
  echo "undeclared dependency: adding $base${ver:+@$ver}" | tee -a /out/added_deps.txt
  corepack pnpm add "$base${ver:+@$ver}" --reporter=append-only
  i=$((i+1))
done
exit 1
