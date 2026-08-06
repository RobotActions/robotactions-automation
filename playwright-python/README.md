# Playwright + Python + pytest-bdd Template

BDD test automation with [pytest-bdd](https://github.com/pytest-dev/pytest-bdd) and [Playwright for Python](https://playwright.dev/python/).

> **Running this against a RobotActions grid?** You need two things from your account: the
> **grid URL** and an **auth token**. Put them in `.env` (see `.env.example`) — never in a
> committed file. Connection details, auth, reporting results back to the dashboard and a
> troubleshooting table live in
> [**docs/connecting-to-the-grid.md**](../docs/connecting-to-the-grid.md).
>
> With no grid configured these tests run against a **local** browser instead, which is
> fine for development but proves nothing about the grid.


## Quick Start

```bash
pip install -r requirements.txt
python -m playwright install chromium
pytest
```

## Project Structure

```
├── features/              # Gherkin feature files (.feature)
├── tests/
│   ├── step_defs/         # BDD step definitions (primary)
│   └── test_*_regular.py  # Regular pytest tests (secondary)
├── pages/                 # Page Object Model classes
├── conftest.py            # Playwright browser/context/page fixtures
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
| `pytest -m smoke -v` | Run smoke tests only |

## CI

`./ci.sh` is the single entry point — GitHub Actions
(`.github/workflows/playwright-python.yml`) calls exactly this script, so a CI
failure reproduces locally with one command:

```bash
./ci.sh                 # BDD suite (tests/step_defs), all markers
./ci.sh regular         # non-BDD tests
./ci.sh bdd smoke       # BDD suite, -m smoke
./ci.sh all regression  # everything, -m regression
```

It reads `GRID_URL`/`GRID_HOST`, `AUTH_TOKEN`, `BASE_URL` and `RA_TESTSUITE`
from the environment, falling back to `.env` — values already exported win, so
CI secrets are never overridden by a checked-in `.env`.

Exit codes: `0` pass · `1` test failure · `2` misconfiguration · `3` zero tests ran.

Two failure modes it refuses to let pass silently:

- **No grid configured.** Without `GRID_URL`/`GRID_HOST` the suite launches a
  LOCAL browser and goes green while proving nothing about the grid, so the
  script exits `2`. Pass `ALLOW_LOCAL=1` when a local run is genuinely intended.
- **A marker that matches nothing.** pytest exits `5` on "no tests collected",
  which is easy to read as a pass; the script asserts the JUnit XML actually
  contains results and exits `3` otherwise.

It also prints the Playwright client version and, when the grid is reachable,
the versions the grid can serve. **The client and the browser server must be the
same version** — a mismatch does not announce itself, it surfaces as
`Object with guid browser@... was not bound in the connection` or a client that
hangs with no error at all. That is why `requirements.txt` pins `playwright`;
bump it in lockstep with the grid image, not ahead of it.

## Remote Browser Connection

Set environment variables to connect to a remote Playwright Grid endpoint:

```bash
GRID_URL=ws://grid:3000 \
BASE_URL=https://app.example.com \
pytest tests/step_defs/ -v
```

## Headless Mode

Headless is enabled automatically when the `CI` environment variable is set:

```bash
CI=true pytest -v
```

## Placeholders

Replace these before running:
- `{{PROJECT_NAME}}` — Your project name in `pyproject.toml`
- `{{BASE_URL}}` — Application URL under test (or set `BASE_URL` env var)
- `{{GRID_URL}}` — Remote Playwright browser endpoint (or set `GRID_URL` env var)
