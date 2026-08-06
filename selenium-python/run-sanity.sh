#!/usr/bin/env bash
# Sanity profile — medium coverage, 3 workers in parallel.
#
# Per the tag convention in features/*.feature:
#   @sanity     = medium scope; one pass through each major surface
#                 (dropdowns, theme, language, sitemap routes)
#
# Goal: pre-release verification. ~3-5 minutes wall.
# Override: `WORKERS=N ./run-sanity.sh` to bump concurrency.
set -euo pipefail
cd "$(dirname "$0")"
exec ./load.sh "${WORKERS:-3}" "${REPEATS:-1}" sanity
