#!/usr/bin/env bash
# Parallel load runner for the wdio (WebdriverIO + Cucumber) template.
#
# Usage:
#   ./load.sh [N] [M] [TAG]
#     N    concurrent workers (default 5; WDIO's `maxInstances`)
#     M    repeats per worker (default 1; --cucumberOpts.repeat)
#     TAG  Gherkin tag expression (default @load)
#
# Total sessions fired against the grid = N × M × scenarios-matching-TAG.
# WDIO drives Selenium Grid via plain W3C WebDriver, auth via path-prefix
# `/t/<token>` set in wdio.conf.ts when AUTH_TOKEN is present.
#
# Reports → reports/load-<ts>/

set -euo pipefail
N="${1:-5}"
M="${2:-1}"
TAG="${3:-@load}"

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

ts="$(date +%Y%m%d-%H%M%S)"
out="reports/load-${ts}"
mkdir -p "$out"

echo "[load] N=$N M=$M tag=$TAG target=${BASE_URL:-?} grid=${GRID_HOST:-?}"

t0=$(date +%s)
# WDIO_MAX_INSTANCES overrides the config's maxInstances (the conf reads
# process.env.WDIO_MAX_INSTANCES with the literal as fallback).
# CUCUMBER_REPEAT controls per-scenario repeats.
WDIO_MAX_INSTANCES="$N" CUCUMBER_REPEAT="$M" \
  npx wdio run wdio.conf.ts --cucumberOpts.tagExpression="$TAG" \
  2>&1 | tee "$out/run.log" || true
elapsed=$(( $(date +%s) - t0 ))

passed=$(grep -cE "^.+passing" "$out/run.log" || echo 0)
failed=$(grep -cE "^.+failing" "$out/run.log" || echo 0)
rate_limited=$(grep -cE "429|RATE_LIMIT_EXCEEDED|session not created" "$out/run.log" || echo 0)
timeouts=$(grep -cE "timeout|Timeout" "$out/run.log" || echo 0)

{
  echo "wall_time_s=$elapsed"
  echo "passed=$passed"
  echo "failed=$failed"
  echo "rate_limited_responses=$rate_limited"
  echo "timeouts=$timeouts"
} | tee "$out/summary.txt"

# Pull XML reports out for CI parsing.
if [ -d test-results ]; then
  cp test-results/*.xml "$out/" 2>/dev/null || true
fi

echo "[load] done. log: $out/run.log"
