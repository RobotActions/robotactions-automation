#!/usr/bin/env bash
# Parallel load runner for the selenium-java (cucumber-jvm + Maven) template.
#
# Usage:
#   ./load.sh [N] [M] [TAG]
#     N    concurrent forks (default 5; Surefire forkCount)
#     M    repeats per scenario (default 1; cucumber.execution.parallel multiplier
#         is set via -Dcucumber.execution.parallel.config.fixed.parallelism=$N)
#     TAG  Cucumber tag (default "@load")
#
# Total sessions fired against the grid ≈ N × M × scenarios-matching-TAG.
# Surefire's forkCount=N spawns N JVM forks; each fork runs a slice of the
# scenario set. Cucumber-JVM parallel execution is set via JUnit Platform
# properties — see junit-platform.properties in src/test/resources.

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
mvn -q test \
  -Dtest=RunCucumberTest \
  -DforkCount="$N" \
  -DreuseForks=true \
  -Dcucumber.filter.tags="$TAG" \
  -Dcucumber.execution.parallel.enabled=true \
  -Dcucumber.execution.parallel.config.strategy=fixed \
  -Dcucumber.execution.parallel.config.fixed.parallelism="$N" \
  -Dload.repeats="$M" \
  2>&1 | tee "$out/run.log" || true
elapsed=$(( $(date +%s) - t0 ))

# Cucumber-JVM counters
passed=$(grep -cE "Scenarios:.*passed" "$out/run.log" || echo 0)
failed=$(grep -cE "Scenarios:.*failed" "$out/run.log" || echo 0)
rate_limited=$(grep -cE "429|RATE_LIMIT_EXCEEDED|session not created" "$out/run.log" || echo 0)
timeouts=$(grep -cE "TimeoutException|timed out" "$out/run.log" || echo 0)

{
  echo "wall_time_s=$elapsed"
  echo "passed=$passed"
  echo "failed=$failed"
  echo "rate_limited_responses=$rate_limited"
  echo "timeouts=$timeouts"
} | tee "$out/summary.txt"

# Surefire reports + cucumber report
if [ -d target/surefire-reports ]; then
  cp -r target/surefire-reports "$out/" 2>/dev/null || true
fi
if [ -f target/cucumber-report.html ]; then
  cp target/cucumber-report.html "$out/" 2>/dev/null || true
fi

echo "[load] done. log: $out/run.log"
