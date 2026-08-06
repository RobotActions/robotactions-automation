#!/usr/bin/env bash
# Regression profile — deep coverage, 5 workers in parallel.
#
# Per the tag convention in features/*.feature:
#   @regression = deep / parametrised; every Examples row exercised
#
# Goal: full regression sweep (nightly + load profile). ~10-15 minutes wall.
# Override: `WORKERS=N ./run-regression.sh` to bump or drop concurrency.
set -euo pipefail
cd "$(dirname "$0")"
exec ./load.sh "${WORKERS:-5}" "${REPEATS:-1}" "@regression"
