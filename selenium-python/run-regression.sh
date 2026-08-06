#!/usr/bin/env bash
# Regression profile — wide coverage, 5 workers in parallel.
#
# Per the tag convention in features/*.feature:
#   @regression = deep / parametrised. Every sitemap row exercised.
#
# Goal: full pass before promoting to main / release. ~5-10 minutes wall.
# Override: `WORKERS=N ./run-regression.sh` to bump concurrency.
set -euo pipefail
cd "$(dirname "$0")"
exec ./load.sh "${WORKERS:-5}" "${REPEATS:-1}" regression
