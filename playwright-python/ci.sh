#!/usr/bin/env bash
# CI entry point for the playwright-python template.
#
# The same script runs locally and in GitHub Actions, so a green CI run is
# reproducible with one command on a laptop:
#
#   ./ci.sh                      # BDD suite (tests/step_defs), all markers
#   ./ci.sh regular              # non-BDD tests
#   ./ci.sh bdd smoke            # BDD suite, -m smoke
#   ALLOW_LOCAL=1 ./ci.sh        # permit a LOCAL browser when no grid is set
#
# Env (or .env): GRID_URL/GRID_HOST, AUTH_TOKEN, BASE_URL, RA_TESTSUITE.
# Exit codes: 0 pass · 1 test failure · 2 misconfiguration · 3 zero tests ran.
set -euo pipefail
cd "$(dirname "$0")"

SUITE="${1:-bdd}"
MARKERS="${2:-${MARKERS:-}}"

# Parse .env rather than sourcing it. `set -a; . ./.env` executes the file, so
# an unquoted value containing a space — `RA_TESTSUITE=Playwright Python`, which
# is what this template ships — assigns the first word and then runs the second
# as a command ("Python: command not found"). Reading key/value keeps values
# with spaces intact and stops .env content from being executed at all.
if [ -f .env ]; then
  while IFS='=' read -r key value; do
    case "$key" in ''|\#*) continue ;; esac
    value="${value%$'\r'}"                       # tolerate CRLF checkouts
    case "$value" in                             # strip matched surrounding quotes
      \"*\") value="${value#\"}"; value="${value%\"}" ;;
      \'*\') value="${value#\'}"; value="${value%\'}" ;;
    esac
    # Never override what the caller already exported — CI passes GRID_URL /
    # AUTH_TOKEN / BASE_URL as env, and a checked-in .env pointing at a dev
    # grid must not silently win over them. Matches python-dotenv's
    # load_dotenv() default, which config.py relies on.
    # `+x` tests whether the caller SET the variable, not whether it is
    # non-empty: the workflow passes an empty GRID_HOST when the operator wants
    # a local run, and that explicit empty must beat a checked-in .env rather
    # than being quietly refilled from it.
    [ -n "${!key+x}" ] && continue
    export "$key=$value"
  done < .env
fi

PY="python3"
[ -x ".venv/bin/python" ] && PY=".venv/bin/python"

# ── Guard: a missing grid silently falls back to a LOCAL browser ─────────────
# config.grid_ws_endpoint() returns None without GRID_URL/GRID_HOST and the
# suite then launches a local Chromium — it goes green while proving nothing
# about the grid. CI must fail on that rather than report a false pass.
GRID="${GRID_URL:-${GRID_HOST:-}}"
if [ -z "$GRID" ] && [ "${ALLOW_LOCAL:-0}" != "1" ]; then
  echo "::error::No GRID_URL/GRID_HOST set — the suite would run a LOCAL browser and prove nothing about the grid. Set one, or re-run with ALLOW_LOCAL=1 if that is genuinely what you want." >&2
  exit 2
fi

case "$SUITE" in
  bdd)     ARGS=(tests/step_defs/) ;;
  regular) ARGS=(tests/ --ignore=tests/step_defs) ;;
  all)     ARGS=(tests/) ;;
  *) echo "::error::unknown suite '$SUITE' (expected: bdd | regular | all)" >&2; exit 2 ;;
esac

# ── Playwright version parity ────────────────────────────────────────────────
# The client and the browser server MUST be the same version. A mismatch does
# not say so: connect() fails with "Object with guid browser@... was not bound
# in the connection", or the client hangs with no error at all and the run
# looks stalled. On 2026-08-05 that cost an afternoon, so the mismatch is
# surfaced up front instead of being diagnosed from a hang.
CLIENT_PW="$($PY -c 'import importlib.metadata as m; print(m.version("playwright"))' 2>/dev/null || echo unknown)"
echo "[ci] playwright client : $CLIENT_PW"
echo "[ci] suite             : $SUITE"
echo "[ci] markers           : ${MARKERS:-<all>}"
echo "[ci] grid              : ${GRID:-<LOCAL browser>}"
echo "[ci] base url          : ${BASE_URL:-<config default>}"

# Best-effort: ask the grid which server versions it can serve and compare
# minors. Auth-gated and optional — never fail the run on a probe problem.
if [ -n "$GRID" ] && [ -n "${AUTH_TOKEN:-}" ]; then
  probe_host="${GRID#*://}"; probe_host="${probe_host%%/*}"
  scheme=https; case "$probe_host" in *:443) : ;; localhost*|127.0.0.1*|0.0.0.0*) scheme=http ;; esac
  server_pw="$(curl -fsS -m 8 -H "Authorization: Bearer ${AUTH_TOKEN}" \
    "${scheme}://${probe_host}/api/playwright/versions" 2>/dev/null \
    | $PY -c 'import json,sys; d=json.load(sys.stdin); v=d if isinstance(d,list) else d.get("versions",d.get("playwright",[])); print(" ".join(str(x.get("version",x)) for x in v)[:120])' 2>/dev/null || true)"
  if [ -n "$server_pw" ]; then
    echo "[ci] grid offers       : $server_pw"
    case "$server_pw" in
      *"${CLIENT_PW%.*}"*) : ;;
      *) echo "::warning::grid does not advertise a ${CLIENT_PW%.*}.x server — connect may fail with a guid/binding error or hang. Pin requirements.txt to a version the grid serves." ;;
    esac
  fi
fi

mkdir -p reports
ARGS+=(-v --junitxml=reports/junit.xml --html=reports/report.html --self-contained-html)
[ -n "$MARKERS" ] && ARGS+=(-m "$MARKERS")

set +e
$PY -m pytest "${ARGS[@]}"
status=$?
set -e

# ── Guard: a marker typo exits 5 ("no tests collected") ──────────────────────
# Treating that as anything but a failure lets a filter mistake look like a
# pass, so assert the JUnit XML actually contains results.
if [ ! -s reports/junit.xml ]; then
  echo "::error::reports/junit.xml missing or empty — no test produced a result." >&2
  exit 3
fi
total="$($PY - <<'PY'
import sys
try:
    from defusedxml.ElementTree import parse   # XXE-safe; stdlib ET is not
except ImportError:
    from xml.etree.ElementTree import parse
root = parse("reports/junit.xml").getroot()
print(sum(int(s.get("tests", 0)) for s in root.iter("testsuite")))
PY
)"
echo "[ci] tests executed    : $total"
if [ "$total" -eq 0 ]; then
  echo "::error::0 tests matched markers '${MARKERS:-<all>}' — nothing ran." >&2
  exit 3
fi

[ $status -ne 0 ] && exit 1
echo "[ci] PASS"
