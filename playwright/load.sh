#!/usr/bin/env bash
# Parallel load runner for the playwright-bdd template.
#
# Usage:
#   ./load.sh [N] [M] [GREP]
#     N    concurrent workers (default 5)
#     M    repeats per worker  (default 1)
#     GREP optional pytest-style grep for scenario names (default @load)
#
# Total sessions fired against the grid = N × M.
# Routes through .env's GRID_HOST + AUTH_TOKEN via SELENIUM_REMOTE_URL +
# SELENIUM_REMOTE_HEADERS which playwright reads natively.
#
# Reports wall time + per-test JSON summary to test-results/load-summary-$(date).json
# so you can plot success-rate vs concurrency without parsing the spec reporter.

set -euo pipefail
N="${1:-5}"
M="${2:-1}"
GREP="${3:-@load}"

cd "$(dirname "$0")"

# Load .env into the current shell so playwright.config.ts sees the right
# SELENIUM_REMOTE_URL / SELENIUM_REMOTE_HEADERS values.
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

ts="$(date +%Y%m%d-%H%M%S)"
out="test-results/load-${ts}"
mkdir -p "$out"

echo "[load] N=$N M=$M grep=$GREP target=${BASE_URL:-?} grid=${GRID_HOST:-?}"
echo "[load] generated $(($N * $M)) total sessions; output → $out"

# bddgen generates spec files from .feature; only needs to run once before the
# parallel pass.
npx bddgen

t0=$(date +%s)
# --workers controls concurrency; --repeat-each multiplies every test by M.
# --grep filters on tag set in the .feature.
npx playwright test \
  --workers="$N" \
  --repeat-each="$M" \
  --grep="$GREP" \
  --reporter="list,json" \
  --output="$out" \
  2>&1 | tee "$out/run.log" || true
elapsed=$(( $(date +%s) - t0 ))

# Drag results.json out where the spec reporter wrote it.
if [ -f test-results/results.json ]; then
  cp test-results/results.json "$out/results.json"
fi

# Summary: jq if available, else awk-grep on the log.
echo "[load] wall time: ${elapsed}s"
if command -v jq >/dev/null 2>&1 && [ -f "$out/results.json" ]; then
  jq -r '
    .stats as $s |
    "passed:  \($s.expected // 0)\nfailed:  \($s.unexpected // 0)\nflaky:   \($s.flaky // 0)\nskipped: \($s.skipped // 0)"
  ' "$out/results.json"
else
  grep -E '^\s+[0-9]+ (passed|failed|flaky|skipped)' "$out/run.log" | tail -4 || true
fi

echo "[load] done. log: $out/run.log"
