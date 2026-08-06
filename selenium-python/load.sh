#!/usr/bin/env bash
# Parallel load runner for the selenium-python (pytest-bdd) template.
#
# Usage:
#   ./load.sh [N] [M] [TAG]
#     N    concurrent workers (default 5)
#     M    repeats per worker (default 1)
#     TAG  pytest marker (Gherkin tag without `@`) — default `load`
#
# Total sessions fired against the grid = N × M × scenarios-matching-TAG.
# Needs `pytest-xdist` (parallelism) + `pytest-repeat` (repeats). They're
# in requirements.txt — `make load` will install them if missing.
#
# Reports wall time + pass/fail/skip + 429/503/timeout counters from the
# pytest log into reports/load-summary-$(date).txt for cross-run comparison.

set -euo pipefail
N="${1:-5}"
M="${2:-1}"
TAG="${3:-load}"

# Accept both `smoke` and `@smoke` — strip a leading `@` so pytest -m
# accepts the marker name without the Gherkin prefix.
TAG="${TAG#@}"

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

ts="$(date +%Y%m%d-%H%M%S)"
out="reports/load-${ts}"
mkdir -p "$out"

echo "[load] N=$N M=$M marker=$TAG target=${BASE_URL:-?} grid=${GRID_HOST:-?}"

# Prefer venv's pytest if available, fall back to global; install deps
# quietly so a fresh checkout self-bootstraps. The --break-system-packages
# branch is harmless on Linux/CI and required on Homebrew Python 3.12+.
PYTEST="python3 -m pytest"
if [ -x ".venv/bin/pytest" ]; then PYTEST=".venv/bin/python -m pytest"; fi

t0=$(date +%s)
$PYTEST tests/step_defs/ \
  -v \
  -n "$N" \
  --count "$M" \
  -m "$TAG" \
  --junitxml="$out/junit.xml" \
  --html="$out/report.html" \
  --self-contained-html \
  2>&1 | tee "$out/run.log" || true
elapsed=$(( $(date +%s) - t0 ))

# Counters from pytest output. pytest-bdd emits PASS/FAIL via the test
# collector; rate-limit + timeout hits surface as exceptions in the log.
passed=$(grep -c "PASSED" "$out/run.log" || echo 0)
failed=$(grep -c "FAILED" "$out/run.log" || echo 0)
errored=$(grep -c "ERROR" "$out/run.log" || echo 0)
rate_limited=$(grep -cE "429|RATE_LIMIT_EXCEEDED|session not created" "$out/run.log" || echo 0)
timeouts=$(grep -cE "Timeout|TimeoutException|did not respond" "$out/run.log" || echo 0)

{
  echo "wall_time_s=$elapsed"
  echo "passed=$passed"
  echo "failed=$failed"
  echo "errored=$errored"
  echo "rate_limited_responses=$rate_limited"
  echo "timeouts=$timeouts"
} | tee "$out/summary.txt"

echo "[load] done. log: $out/run.log  junit: $out/junit.xml  html: $out/report.html"
