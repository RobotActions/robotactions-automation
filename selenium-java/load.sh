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

# Load .env WITHOUT clobbering variables the caller already set.
#
# `set -a; . ./.env` exports every assignment in the file, overwriting anything
# passed on the command line. So `PLATFORM=mobileweb ./load.sh` silently ran as
# PLATFORM=web (the value in .env) — three "mobile" lanes all executed desktop
# Chrome, the grid never received a single Android/iOS session, and the
# mobile-only scenarios failed looking for a hamburger menu that does not exist
# at 1920px. The run reported failures that had nothing to do with what it
# claimed to be testing.
#
# dotenv's own rule is "never override an already-set variable"; this matches
# it. Caller env wins, .env fills the gaps.
# Sources are tried in order; the FIRST definition of a key wins, and the
# caller's environment beats all of them. .properties is supported because the
# Java/TestNG templates in this repo use it — same KEY=VALUE grammar, so one
# loader serves both and a team can standardise on either.
_ra_load_config() {
  [ -f "$1" ] || return 0
  while IFS= read -r _line || [ -n "$_line" ]; do
    case "$_line" in
      ''|'#'*|'!'*) continue ;;                 # blank / comment (! is .properties)
    esac
    case "$_line" in
      *=*) : ;;
      *) continue ;;                            # no '=' — not an assignment
    esac
    _key=${_line%%=*}
    _key=${_key%"${_key##*[![:space:]]}"}       # trim trailing space (properties style)
    _key=${_key#"${_key%%[![:space:]]*}"}       # trim leading space
    case "$_key" in
      *[!A-Za-z0-9_]*|'') continue ;;           # not a usable shell name
    esac
    if [ -z "${!_key+x}" ]; then                # only when unset — caller wins
      _val=${_line#*=}
      _val=${_val#"${_val%%[![:space:]]*}"}     # trim leading space
      _val=${_val%\"}; _val=${_val#\"}          # strip surrounding quotes
      _val=${_val%\'}; _val=${_val#\'}
      export "$_key=$_val"
    fi
  done < "$1"
  unset _line _key _val
}

# RA_ENV_FILE pins one explicitly; otherwise the usual names, first hit wins.
for _f in ${RA_ENV_FILE:-} .env .properties test.properties config.properties; do
  _ra_load_config "$_f"
done
unset _f

ts="$(date +%Y%m%d-%H%M%S)"
out="reports/load-${ts}"
mkdir -p "$out"

echo "[load] N=$N M=$M tag=$TAG target=${BASE_URL:-?} grid=${GRID_HOST:-?}"

t0=$(date +%s)
set +e  # keep the runner's exit status; `|| true` threw it away
mvn -q test \
  -Dtest=RunCucumberTest \
  -DforkCount="$N" \
  -DreuseForks=true \
  -Dcucumber.filter.tags="$TAG" \
  -Dcucumber.execution.parallel.enabled=true \
  -Dcucumber.execution.parallel.config.strategy=fixed \
  -Dcucumber.execution.parallel.config.fixed.parallelism="$N" \
  -Dload.repeats="$M" \
  2>&1 | tee "$out/run.log"
status=${PIPESTATUS[0]}
set -e
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
exit "$status"
