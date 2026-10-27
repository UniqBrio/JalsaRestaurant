#!/usr/bin/env bash
# perf rig — the whole measurement for ONE build, identically every time.
#
#   scripts/perf/suite.sh <app-dir> <label> <out-dir> [snapshot.dump]
#
# Restores the rig database from the snapshot (so two builds are measured on the same data), starts
# the build in <app-dir> on :3400, runs journeys (n=20, local + india4g), the hydration gap, idle cost
# and the load test, then stops it. Needs the rig up (bootstrap.sql, PostgREST, gateway.mjs) and the
# build made with the rig's environment. Writes <out-dir>/<label>-*.
set -euo pipefail
APP_DIR=$1; LABEL=$2; OUT=$3; SNAP=${4:-}
HERE=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=rig.env
source "$HERE/rig.env"
mkdir -p "$OUT"
if [ -n "$SNAP" ]; then
  docker exec -i jalsa-pg pg_restore -U postgres -d postgres --clean --if-exists --single-transaction < "$SNAP"
  docker exec jalsa-pg psql -U postgres -qc "notify pgrst, 'reload schema'"
  sleep 2
fi
# Journeys a change could move; the client-only section switches are represented by Menu.
ONLY=${JOURNEYS:-owner-signin,owner-reload,owner-nav-menu,owner-nav-reports,owner-reports-range,owner-nav-expenses,owner-nav-uplift,staff-signin,staff-reload,guest-scan,guest-scan-open-bill}
curl -s "http://127.0.0.1:54321/__rig/reset?fixed=20&serial=20" >/dev/null
stop_app() {
  # `fuser`, not `lsof`: in this container lsof cannot see the listener, and a stop that found nothing
  # once let the PREVIOUS build keep serving while the next suite measured it (26-Oct, see the tests doc).
  fuser -k 3400/tcp >/dev/null 2>&1 || true
  while fuser 3400/tcp >/dev/null 2>&1; do sleep 0.5; done
}
stop_app
(cd "$APP_DIR" && nohup npx next start -p 3400 > "$OUT/$LABEL-server.log" 2>&1 &)
until curl -s -o /dev/null http://localhost:3400/offline; do
  if grep -q "EADDRINUSE\|Failed to start" "$OUT/$LABEL-server.log" 2>/dev/null; then
    echo "suite $LABEL: the server did not start - another process holds :3400" >&2
    exit 1
  fi
  sleep 1
done
# The server answering must be THIS build: its process must run from APP_DIR.
pid=$(fuser 3400/tcp 2>/dev/null | tr -s ' ' '\n' | grep -m1 '[0-9]')
cwd=$(readlink "/proc/$pid/cwd")
if [ "$cwd" != "$(cd "$APP_DIR" && pwd)" ]; then
  echo "suite $LABEL: :3400 is served from $cwd, not $APP_DIR" >&2
  exit 1
fi
sleep 2
node "$HERE/journeys.mjs" --n 20 --profile both --only "$ONLY" --out "$OUT/$LABEL-journeys.json" > "$OUT/$LABEL-journeys.log" 2>&1
for p in local india4g; do node "$HERE/hydration.mjs" $p 10 >> "$OUT/$LABEL-hydration.log" 2>&1; done
sleep 8
node "$HERE/idle.mjs" --seconds 60 > "$OUT/$LABEL-idle.log" 2>&1
sleep 8
node "$HERE/concurrency.mjs" --seconds 90 > "$OUT/$LABEL-concurrency.json" 2>&1
# Stopped by PORT, never by a name pattern: a pattern also matches any shell whose command line
# happens to contain it, including the one running this script.
stop_app
echo "suite $LABEL done"
