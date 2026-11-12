# Runs INSIDE the container (sh /qa/dev_qa.sh): the loopferry way. Start the app's OWN web dev server, wait until it answers, record a video of it with Playwright, stop it.
# No export, no minified copy: what is recorded is what a developer sees. Prepare steps are shared with the export (prepare.sh).
. /qa/prepare.sh
cd $APP
PORT=${QA_PORT:-8081}; START=${QA_START:-corepack pnpm exec expo start --web --port $PORT}   # declared by the case (qa spec); default: Expo web dev server
sh -c "$START" > /tmp/dev.log 2>&1 &
DEV=$!
PORT=$PORT node -e 'const t0=Date.now();(async()=>{while(Date.now()-t0<90000){try{const r=await fetch("http://127.0.0.1:"+process.env.PORT+"/");if(r.status<500)process.exit(0)}catch{}await new Promise(r=>setTimeout(r,1000))}process.exit(1)})()' || { echo "dev server did not answer in 90 s"; tail -40 /tmp/dev.log; cp /tmp/dev.log /out/dev.log; kill $DEV 2>/dev/null; exit 1; }
lap "dev server up"
mkdir -p /tmp/rec && cp /qa/record.mjs /tmp/rec/record.mjs && ln -sf /app/node_modules /tmp/rec/node_modules
RC=0; QA_URL=http://127.0.0.1:$PORT/ QA_RENDER_TIMEOUT=${QA_RENDER_TIMEOUT:-90000} node /tmp/rec/record.mjs || RC=$?
kill $DEV 2>/dev/null || true; cp /tmp/dev.log /out/dev.log 2>/dev/null || true; lap "recorded"
exit $RC
