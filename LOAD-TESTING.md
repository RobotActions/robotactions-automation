# Grid load testing — four-language workflow

Stack-agnostic load profile that exercises every nav item on robotactions.com through the appium-grid-service grid, across **four parallel framework stacks** so we can compare grid behaviour under concurrent pressure from real-world test client variety.

## Stacks

| Folder | Stack | Auth method | Parallel knob |
|---|---|---|---|
| `playwright/` | playwright-bdd (TS) | `SELENIUM_REMOTE_HEADERS` Bearer | `--workers` × `--repeat-each` |
| `selenium-python/` | pytest-bdd + Selenium | `/t/<token>` path-prefix on `command_executor` | `pytest-xdist -n` × `pytest-repeat --count` |
| `wdio/` | WebdriverIO v9 + Cucumber | `path: '/t/<token>'` on the WS endpoint | `maxInstances` × `CUCUMBER_REPEAT` |
| `selenium-java/` | Cucumber-JVM + Selenium 4 | `/t/<token>` path-prefix on `RemoteWebDriver` URL | Surefire `forkCount` × `-Dload.repeats` |

All four ship a `load.sh` with the same CLI shape:

```bash
./load.sh [N] [M] [TAG]
  N   concurrent workers (default 5)
  M   repeats per scenario (default 1)
  TAG Gherkin tag (default @load)
```

Each writes a `summary.txt` with `wall_time_s`, `passed`, `failed`, `rate_limited_responses`, `timeouts` for cross-run comparison.

## One-time setup

Drop a `.env` into each template directory:

```
GRID_HOST=localhost:5555
AUTH_TOKEN=<jwt>
BASE_URL=https://robotactions.com
PLATFORM=web    # only used by selenium-python / selenium-java
```

`.env` is gitignored in every template — never commit the token.

### Per-language install

```bash
# Playwright
cd playwright && npm install && npx playwright install chromium

# Selenium-Python  (load.sh installs xdist + repeat automatically)
cd selenium-python && pip install -r requirements.txt

# WebdriverIO
cd wdio && npm install

# Selenium-Java  (Maven downloads on first run; no extra step)
```

## The scenario set

The Gherkin lives in `<template>/features/robotactions-load.feature` (Java: `src/test/resources/features/`) — same spec across all four stacks. It expands to **25 scenarios per run**:

| Scenario family | Count | Stresses |
|---|---|---|
| Hero + primary CTAs | 1 | Basic page render |
| Top-level nav anchors (Outline) | 5 | Smooth-scroll + hash routing |
| Features dropdown visibility | 1 | Click-to-open state |
| Features dropdown items (Outline) | 7 | Real route navigation |
| Resources dropdown visibility | 1 | Click-to-open state |
| Resources dropdown items (Outline) | 6 | Real route navigation |
| Theme toggle + console-error check | 1 | DOM mutation + log capture |
| Language switcher | 1 | Menu rendering |
| Sign in / Sign up button | 1 | Static reachability |
| Full nav matrix cycle (@health) | 1 | Cross-cutting sanity |

So `./load.sh 10 3 @load` fires `10 × 3 × 25 = 750 grid sessions` (each scenario = one fresh WebDriver session).

## Recommended load profiles

| Goal | Command | Expected grid load |
|---|---|---|
| Smoke | `./load.sh 1 1 @smoke` | 1 session — proves wiring |
| Baseline | `./load.sh 5 1 @load` | ~125 sessions over ~5 min |
| Concurrency cap test | `./load.sh 20 1 @load` | Trips `MAX_SESSIONS_PER_IDENTITY` (default 5) — expect 503s |
| Sustained | `./load.sh 10 5 @load` | ~1250 sessions; observe idle-evict + warm-pool reuse |
| Spike | `./load.sh 50 1 @load` | Trips `MAX_WS_CONNECTIONS` (default 10) for PW path; observe queue waiter |

## What to watch during a run

Tail the grid logs:
```bash
pm2 logs appium-grid-service | grep -E "(Active sessions|ghost|RATE_LIMIT|slot granted|Container removed|session-evicted)"
```

Open the dashboard's Running Sessions tab — should track the test's worker count. History tab gets `sessionStarted`/`sessionStatusChanged` broadcasts in real time so the row count + status updates without refresh.

Key concerns to verify:
- **Ghost filter** — `gridStatus: filtered N ghost session(s)` should hit 0 once the run is warm. If it climbs, the DB-read snapshot bug from PR #162 has regressed.
- **Slot waiter** — `Playwright slot granted after queue wait` should fire when N exceeds `MAX_WS_CONNECTIONS`. The grid queues instead of 429ing.
- **Warm-pool hit rate** — `Reusing released chromium container` vs `Creating chromium container` ratio tells you the spawn cost.
- **Rate-limit hits** — 429s and 503s are EXPECTED when N exceeds budget; the runner counts them in `summary.txt`. A "passed: 100%, rate_limited: 30%" result is normal for a burst test — the load profile is doing its job.

## Skills (Claude Code)

Each template ships a `.claude/skills/<name>/SKILL.md` with framework-specific patterns (step decorators, locator priorities, console-log capture, parallel knob quirks). The top-level `.claude/skills/sdet-grid-load/SKILL.md` covers cross-cutting grid + auth + observability guidance.

Load the relevant skill before adding scenarios to that template — it keeps the patterns consistent across stacks.

## What's not covered yet

- **Mobile (Android + iOS)** — `appium-js/` and `appium-python` templates exist but aren't wired into this load profile. robotactions.com is browser-only; a parallel mobile load would need a different AUT.
- **PR-time CI** — the load runners are local-only. CI integration is a follow-up; the JUnit XML each runner emits is the input.
- **Cross-stack synchronised burst** — running all four stacks in parallel against the same grid would stress the auth path + WS multiplexing harder than any single stack. Easy to script (`./playwright/load.sh 5 1 & ./selenium-python/load.sh 5 1 & wait`) but no canonical runner ships yet.
