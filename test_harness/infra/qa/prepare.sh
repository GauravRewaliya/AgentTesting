# Shared by export.sh and dev_qa.sh (sourced INSIDE the container; pnpm via corepack, never npm). Copies the app into the volume, makes the web-only copy, installs from the saved lockfile
# when this app was built before, stubs missing binary assets. Leaves APP, LOCKD, HASH and the helper `lap` set.
set -e
T0=$(date +%s); lap() { echo "$1: $(( $(date +%s) - T0 )) s" | tee -a /out/timing.txt; }
export npm_config_strict_dep_builds=false pnpm_config_strict_dep_builds=false COREPACK_HOME=/pnpm/corepack COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1 EXPO_NO_TELEMETRY=1
export EXPO_ROUTER_IMPORT_MODE=sync   # NO lazy route chunks: chunk splitting duplicated shared modules (two drawer contexts, 'Couldn't find a drawer') or lost them ('Requiring unknown module'); a video wants one bundle
mkdir -p /pnpm/tmp; export TMPDIR=/pnpm/tmp   # Metro keeps its transform cache in TMPDIR: persisting it in the volume makes the second bundle much faster
HASH=$(sha1sum /src/package.json | cut -c1-16); LOCKD=/pnpm/locks/$HASH   # lockfile + final package.json (with added deps) of an earlier successful run of THIS app
APP=/pnpm/app-$(hostname); cleanup() { RC_=$?; cd /; rm -rf $APP 2>/dev/null || { sleep 2; rm -rf $APP 2>/dev/null || true; }; exit $RC_; }; trap cleanup EXIT   # a dev server still writing into node_modules made `rm` fail ("Directory not empty") and turned a recorded, healthy run into a failure: cleanup never changes the exit code   # PER CONTAINER (hostname = container id): several jobs run in parallel on the same volume and must not delete each other's copy
: > /out/timing.txt; : > /out/added_deps.txt
rm -rf $APP && cp -r /src $APP && cd $APP && rm -rf node_modules dist
# The project's own pnpm version wins; a project that declares none gets the image's default (see pin_pm.mjs). Corepack otherwise fetches the NEWEST pnpm, which drifted and failed a lockfile the builders' pnpm accepted.
node /qa/pin_pm.mjs package.json | tee -a /out/added_deps.txt
printf 'node-linker=hoisted\nauto-install-peers=true\nstrict-peer-dependencies=false\nstrict-dep-builds=false\n' > .npmrc
if grep -q '"expo"' package.json; then node /qa/web_only.mjs $APP | tee -a /out/added_deps.txt; fi   # the Expo web-only copy rules only apply to Expo apps (a Vite/React/Vue app is built as it is)
if [ -f "$LOCKD/pnpm-lock.yaml" ]; then   # warm: no dependency resolution, no network, no add-and-retry
  cp "$LOCKD/pnpm-lock.yaml" "$LOCKD/package.json" $APP/ && echo "reusing saved lockfile $HASH" | tee -a /out/added_deps.txt
  corepack pnpm install --frozen-lockfile --offline --reporter=append-only || corepack pnpm install --no-frozen-lockfile --reporter=append-only; lap "install done (saved lockfile)"
else
  corepack pnpm install --no-frozen-lockfile --reporter=append-only; lap "install done (resolved)"
fi
node /qa/stub_assets.mjs $APP /out
# first install of this app: keep its lockfile so the NEXT run installs from it (no resolution, no network): atomic copy
if [ ! -f "$LOCKD/pnpm-lock.yaml" ] && [ -f "$APP/pnpm-lock.yaml" ]; then mkdir -p "$LOCKD" && for f in pnpm-lock.yaml package.json; do cp $APP/$f "$LOCKD/$f.$$" && mv -f "$LOCKD/$f.$$" "$LOCKD/$f"; done; fi
