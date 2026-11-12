# Shared by export.sh and dev_qa.sh (sourced INSIDE the container; pnpm via corepack, never npm). Copies the app into the volume, makes the web-only copy, installs from the saved lockfile
# when this app was built before, stubs missing binary assets. Leaves APP, LOCKD, HASH and the helper `lap` set.
set -e
T0=$(date +%s); lap() { echo "$1: $(( $(date +%s) - T0 )) s" | tee -a /out/timing.txt; }
export COREPACK_HOME=/pnpm/corepack COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1 EXPO_NO_TELEMETRY=1
export EXPO_ROUTER_IMPORT_MODE=sync   # NO lazy route chunks: chunk splitting duplicated shared modules (two drawer contexts, 'Couldn't find a drawer') or lost them ('Requiring unknown module'); a video wants one bundle
mkdir -p /pnpm/tmp; export TMPDIR=/pnpm/tmp   # Metro keeps its transform cache in TMPDIR: persisting it in the volume makes the second bundle much faster
HASH=$(sha1sum /src/package.json | cut -c1-16); LOCKD=/pnpm/locks/$HASH   # lockfile + final package.json (with added deps) of an earlier successful run of THIS app
APP=/pnpm/app-$(hostname); trap "cd /; rm -rf $APP" EXIT   # PER CONTAINER (hostname = container id): several jobs run in parallel on the same volume and must not delete each other's copy
: > /out/timing.txt; : > /out/added_deps.txt
rm -rf $APP && cp -r /src $APP && cd $APP && rm -rf node_modules dist
printf 'node-linker=hoisted\nauto-install-peers=true\nstrict-peer-dependencies=false\n' > .npmrc
if grep -q '"expo"' package.json; then node /qa/web_only.mjs $APP | tee -a /out/added_deps.txt; fi   # the Expo web-only copy rules only apply to Expo apps (a Vite/React/Vue app is built as it is)
if [ -f "$LOCKD/pnpm-lock.yaml" ]; then   # warm: no dependency resolution, no network, no add-and-retry
  cp "$LOCKD/pnpm-lock.yaml" "$LOCKD/package.json" $APP/ && echo "reusing saved lockfile $HASH" | tee -a /out/added_deps.txt
  corepack pnpm install --frozen-lockfile --offline --reporter=append-only || corepack pnpm install --no-frozen-lockfile --reporter=append-only; lap "install done (saved lockfile)"
else
  corepack pnpm install --no-frozen-lockfile --reporter=append-only; lap "install done (resolved)"
fi
node /qa/stub_assets.mjs $APP /out
