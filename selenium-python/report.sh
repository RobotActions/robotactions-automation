#!/usr/bin/env bash
# Helpers for the Allure report.
#   ./report.sh serve     -- open one-shot live report (random localhost port)
#   ./report.sh generate  -- write static HTML to reports/allure-html/
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-serve}" in
  serve)    exec allure serve reports/allure-results ;;
  generate) exec allure generate reports/allure-results -o reports/allure-html --clean ;;
  *)        echo "usage: $0 [serve|generate]"; exit 2 ;;
esac
