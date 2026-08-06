# Selenium + Python + pytest-bdd Template

BDD test automation with [pytest-bdd](https://github.com/pytest-dev/pytest-bdd) and [Selenium WebDriver](https://www.selenium.dev/).

## Quick Start

```bash
pip install -r requirements.txt
pytest tests/step_defs/ -v
```

## Project Structure

```
├── features/              # Gherkin feature files (.feature)
├── tests/
│   ├── step_defs/         # BDD step definitions (primary)
│   └── test_*_regular.py  # Regular pytest tests (secondary)
├── pages/                 # Page Object Model classes
├── conftest.py            # WebDriver fixtures
├── pyproject.toml         # pytest configuration
└── requirements.txt       # Python dependencies
```

## Commands

| Command | Description |
|---------|-------------|
| `pytest tests/step_defs/ -v` | Run BDD tests |
| `pytest tests/ -v --ignore=tests/step_defs` | Run regular tests |
| `pytest -v --junitxml=reports/junit.xml` | Run all with JUnit XML report |
| `pytest -v --html=reports/report.html` | Run all with HTML report |

## Platforms

`PLATFORM` picks the driver; pair it with a marker so a web-only scenario never
runs against a mobile driver.

| `PLATFORM` | Driver | Typical command |
|---|---|---|
| `web` (default) | Chrome via the Grid | `PLATFORM=web pytest tests/step_defs/ -v -m web` |
| `mobileweb` | Chrome on a **real Android device** (Appium) | `PLATFORM=mobileweb pytest tests/step_defs/test_robotactions_mobileweb.py -m smoke` |
| `ios-mobileweb` | Safari on a **real iOS device** (Appium) | `PLATFORM=ios-mobileweb pytest tests/step_defs/test_robotactions_mobileweb.py -m smoke` |
| `android` / `ios` | Native app automation | `PLATFORM=android pytest tests/step_defs/mobile/ -v` |

Markers are additive tiers: `-m smoke` (critical path) ⊂ `-m sanity` ⊂ full run.

### Mobile web notes

- **The browser is requested as `appium:browserName`, not the W3C `browserName`.**
  Device slots advertise a native stereotype only (`platformName` + `appium:*`, no
  `browserName`), and Grid's matcher requires a `browserName` match whenever one is
  requested — the W3C form matches zero slots and the request queues until it times out.
- **No `appium:udid`** — the grid distributes each session to any free handset. Pinning one
  serialises the suite onto a single device and fails when it is busy.
- **Never use `By.ID` on a mobile driver.** `id` is not a W3C location strategy. The plain
  Selenium client silently rewrites it to a CSS selector; the **Appium** client passes it
  through and the driver rejects it with `InvalidArgumentException: invalid locator`. Use
  XPath or CSS.
- **Wait for the title after a deep link.** The site is an SPA — the client router sets the
  title after the navigation resolves, so a bare `driver.title` read can return the previous
  page's title.
- The same scenarios run on Android and iOS; only `PLATFORM` changes.
- Don't run two suites against the device pool at once: concurrent runs surface as
  `401 Auth service unavailable` at session creation, which looks like a code failure but is
  contention.

## GitHub Actions

A manual-dispatch workflow lives at [`.github/workflows/selenium-python.yml`](../.github/workflows/selenium-python.yml)
(repo root — GitHub only reads workflows from there). `workflow_dispatch` only: each run
consumes real devices, so it stays opt-in.

Inputs: `platform` (`mobileweb` / `ios-mobileweb` / `web` / `android` / `ios`), `test_path`,
`markers`, `grid_url` (defaults to the `RA_GRID_HOST` repository secret),
`browser_version`, and `chrome_args`. The last two map to `RA_BROWSER_VERSION` and
`RA_CHROME_ARGS`, both read by the Chrome fixtures — so a dispatch can vary browser flags
(`--lang=fr-FR`, a mobile-sized `--window-size`, …) without editing the template. The token
comes from `secrets.RA_AUTH_TOKEN`.

It also guards a trap worth knowing: **a marker expression that matches nothing collects 0
tests**, which is easy to mistake for a pass. The workflow parses `reports/junit.xml` and
fails when the test count is zero.

## Remote Grid Execution

Set environment variables:

```bash
GRID_URL=http://grid:4444 \
AUTH_TOKEN=your-bearer-token \
BASE_URL=https://app.example.com \
pytest tests/step_defs/ -v
```

The token is sent as a `/t/<token>` path prefix on the executor URL (`conftest._executor_url`).
Python's urllib3 speaks HTTP/1.1 and does not attempt an h2c upgrade, so the grid proxy's
path strip and auth middleware work as designed — this is the opposite of the Java client,
which needs header-based auth.

## Placeholders

Replace these before running:
- `{{PROJECT_NAME}}` — Your project name
- `{{BASE_URL}}` — Application URL under test
- `{{GRID_URL}}` — Selenium Grid URL
- `{{AUTH_TOKEN}}` — Bearer token for Grid auth
