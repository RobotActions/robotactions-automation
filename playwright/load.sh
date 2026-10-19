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
# The json reporter prints to stdout unless told where to write. Without this
# the summary below read whatever results.json an EARLIER run left behind and
# reported its numbers instead of this run's.
set +e
PLAYWRIGHT_JSON_OUTPUT_NAME="$out/results.json" npx playwright test \
  --workers="$N" \
  --repeat-each="$M" \
  --grep="$GREP" \
  --reporter="list,json" \
  --output="$out" \
  2>&1 | tee "$out/run.log"
status=${PIPESTATUS[0]}
set -e
elapsed=$(( $(date +%s) - t0 ))

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
exit "$status"
