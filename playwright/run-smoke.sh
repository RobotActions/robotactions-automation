#!/usr/bin/env bash
# Smoke profile — single-worker fast pass.
#
# Per the tag convention in features/*.feature:
#   @smoke      = fast, single critical-path check per concern
#
# Goal: prove the site + grid plumbing work. ~1-2 minutes wall.
# Override: `WORKERS=N ./run-smoke.sh` to bump concurrency.
set -euo pipefail
cd "$(dirname "$0")"
exec ./load.sh "${WORKERS:-1}" "${REPEATS:-1}" "@smoke"
