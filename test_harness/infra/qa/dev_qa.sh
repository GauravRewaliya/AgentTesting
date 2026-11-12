# Runs INSIDE the container (sh /qa/dev_qa.sh): the loopferry way, but CHECKED BEFORE it costs time:
#   1. prepare (copy, pnpm install from the shared store)   2. TYPE CHECK (tsc --noEmit, if the project has a tsconfig and typescript)   3. start the app's OWN web dev server
#   4. SMOKE check in a browser (page error / error screen / blank: stops at the first problem)   5. only if healthy and QA_MODE is not "check": record the video.
# QA_TYPECHECK = strict (default: type errors stop here) | warn (reported, continue) | off.   QA_MODE=check = steps 1-4 only (no video): what `tools.ts qa_check` runs while the master is still developing.
. /qa/prepare.sh
cd $APP
fail() {   # $1 = stage, $2 = file whose last lines are the reasons: write a structured result and stop (the caller reads /out/qa.json)
  node -e 'const fs=require("fs");const [stage,file]=process.argv.slice(1);const l=fs.readFileSync(file,"utf8").split("\n").filter(Boolean);fs.writeFileSync("/out/qa.json",JSON.stringify({ok:false,stage,reasons:l.slice(0,15),page_errors:[],console_errors:[],texts:[],video:false},null,1))' "$1" "$2"
}
TC=${QA_TYPECHECK:-strict}
if [ "$TC" != off ] && [ -f tsconfig.json ] && [ -x node_modules/.bin/tsc ]; then
  RC_TC=0; timeout 120 corepack pnpm exec tsc --noEmit > /out/typecheck.txt 2>&1 || RC_TC=$?; lap "typecheck exit $RC_TC"
  # only REAL code errors stop here: TS5101 / TS5107 / TS5110 are compiler-OPTION deprecations ("baseUrl is deprecated ...") of the project's tsconfig: the app works, a developer sees a warning
  grep "error TS" /out/typecheck.txt | grep -vE "error TS(5101|5107|5110)" > /tmp/tc.txt || true
  if [ "$RC_TC" != 0 ] && [ "$RC_TC" != 124 ] && [ "$TC" = strict ] && [ -s /tmp/tc.txt ]; then fail typecheck /tmp/tc.txt; exit 1; fi
  [ "$RC_TC" != 0 ] && [ ! -s /tmp/tc.txt ] && echo "typecheck: only tsconfig option deprecations (ignored)" | tee -a /out/added_deps.txt
fi
PORT=${QA_PORT:-8081}; START=${QA_START:-corepack pnpm exec expo start --web --port $PORT}   # declared by the case (qa spec); default: Expo web dev server
sh -c "$START" > /tmp/dev.log 2>&1 &
DEV=$!
PORT=$PORT node -e 'const t0=Date.now();(async()=>{while(Date.now()-t0<90000){try{const r=await fetch("http://127.0.0.1:"+process.env.PORT+"/");if(r.status<500)process.exit(0)}catch{}await new Promise(r=>setTimeout(r,1000))}process.exit(1)})()' || { cp /tmp/dev.log /out/dev.log; fail server /tmp/dev.log; kill $DEV 2>/dev/null; exit 1; }
lap "dev server up"
mkdir -p /tmp/rec && cp /qa/record.mjs /tmp/rec/record.mjs && ln -sf /app/node_modules /tmp/rec/node_modules
RC=0; QA_URL=http://127.0.0.1:$PORT/ QA_RENDER_TIMEOUT=${QA_RENDER_TIMEOUT:-90000} node /tmp/rec/record.mjs || RC=$?
kill $DEV 2>/dev/null || true; cp /tmp/dev.log /out/dev.log 2>/dev/null || true; lap "checked"
exit $RC
