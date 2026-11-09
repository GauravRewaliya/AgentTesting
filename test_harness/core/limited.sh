#!/bin/sh
# Run any test command under a hard ceiling, so a test run cannot take the machine down.
#   ./limited.sh bun test/multi.ts --real
# 4 GB of memory (no swap), 300% CPU (of 4 cores), 300 tasks, low priority; everything it started (even detached helpers) is stopped when it ends,
# and the peak memory of the whole run is printed. Override: LF_MEM=2G LF_CPU=200% HARNESS_MAX_PROCS=2
MEM=${LF_MEM:-4G}; CPU=${LF_CPU:-300%}; UNIT=lf-run-$$; PEAKF=/tmp/$UNIT.peak
export HARNESS_MAX_PROCS=${HARNESS_MAX_PROCS:-3}
if systemd-run --user --scope --quiet true >/dev/null 2>&1; then
  ( cg=""; max=0
    while :; do
      [ -z "$cg" ] && cg=$(systemctl --user show $UNIT.scope -p ControlGroup --value 2>/dev/null)
      if [ -n "$cg" ] && [ -r /sys/fs/cgroup$cg/memory.current ]; then cur=$(cat /sys/fs/cgroup$cg/memory.current); [ "$cur" -gt "$max" ] && max=$cur && echo $max > $PEAKF; fi
      sleep 0.4
    done ) &
  SAMPLER=$!
  systemd-run --user --scope --quiet --unit=$UNIT -p MemoryMax=$MEM -p MemorySwapMax=0 -p CPUQuota=$CPU -p TasksMax=300 nice -n 10 "$@"
  rc=$?
  kill $SAMPLER 2>/dev/null
  [ -r $PEAKF ] && echo "limited.sh: peak memory of the whole run: $(( $(cat $PEAKF) / 1048576 )) MB (ceiling $MEM)" >&2
  rm -f $PEAKF
  systemctl --user stop $UNIT.scope >/dev/null 2>&1   # stop strays (detached callees, orphaned claude)
  exit $rc
fi
echo "limited.sh: systemd-run not available, running with nice and the process cap only" >&2
exec nice -n 10 "$@"
