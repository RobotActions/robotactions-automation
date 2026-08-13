<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/robot-actions-logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/robot-actions-logo-light.svg">
  <img src="docs/assets/robot-actions-logo-light.svg" alt="Robot Actions" width="420">
</picture>

# Automation Templates

Ready-to-run test automation templates that execute against a **RobotActions grid** —
real Android and iOS devices plus elastic browser nodes behind a single WebDriver /
Playwright endpoint.

Each template is a complete project, not a snippet: page objects, BDD features, fixtures,
reporting, and a CI entry point that runs the same way on a laptop and in GitHub Actions.

**Already have a test suite?** You don't need a template — [**Connecting to the
grid**](docs/connecting-to-the-grid.md) has the connection recipe for each framework,
plus how to report pass/fail back to the dashboard and what the common failure modes
actually mean.

## Beyond the templates

These templates are the hand-written path. The same grid also drives the rest of the
RobotActions toolchain:

| | |
|---|---|
| [**MCP server**](https://robotactions.com/#mcp) | Point Claude, Cursor, or any MCP host at real devices — install an app, drive its UI, read logs and network traffic, assert on what is actually on screen. |
| [**Skills**](https://robotactions.com/skills) | Packaged expertise for coding agents: recording and replaying flows, mobile and web app testing, grid setup. |
| [**AI test agent**](https://robotactions.com/#ai-test-agent) | Describe a scenario in plain language and have it explored, executed, and turned into a regression test on real hardware. |

| Template | Stack | Runs against |
|---|---|---|
| [`playwright-python`](playwright-python) | Playwright + pytest-bdd | Grid browsers (Playwright direct-WS) |
| [`playwright`](playwright) | Playwright + TypeScript | Grid browsers |
| [`selenium-python`](selenium-python) | Selenium + pytest-bdd | Grid browsers, mobile web, real devices |
| [`wdio`](wdio) | WebdriverIO + TypeScript | Grid browsers, mobile web, real devices |
| [`appium-js`](appium-js) | Appium + WebdriverIO | Real Android / iOS devices |

## Quick start

Every template reads its configuration from the environment, with a local `.env` as the
fallback. Nothing about a specific grid is committed to this repo.

```bash
cd playwright-python
cp .env.example .env          # then fill in the values below
pip install -r requirements.txt
./ci.sh                       # or: pytest
```

The shipped example suites drive the RobotActions marketing site, so a fresh clone is
green immediately and you can see a real run in the dashboard before writing anything.
Point `BASE_URL` at your own application and replace the page objects and features — that
is what the templates are for.

| Variable | Meaning |
|---|---|
| `GRID_URL` / `GRID_HOST` | Your grid endpoint, `host:port`. Blank runs a **local** browser. Point this at the **auth/capture proxy** (`:5555` locally), not the Selenium hub — see below. |
| `AUTH_TOKEN` | Grid bearer token. Rides the URL path (`/t/<token>/…`) for Selenium/Appium and `?token=` on Playwright's WS upgrade — the templates handle this for you. |
| `BASE_URL` | The application under test. |
| `RA_TESTSUITE` | Suite label the grid stores against the session, so runs are identifiable in the dashboard. |

### Point at the proxy, not the hub

A RobotActions grid exposes two ports, and only one of them is meant for tests:

| Port | What it is |
|---|---|
| `5555` | **The auth/capture proxy — connect here.** Enforces the token, records commands, and rewrites the live-view / CDP URLs handed back to your client. |
| `4444` | The raw Selenium hub. Internal. |

Connecting to `4444` **does not fail** — sessions start and tests go green. You simply
lose the auth gate, command capture, video, and live view, and the dashboard has no record
of what ran. If a suite passes but the session is missing or blank in the dashboard, this
is almost always why. (Earlier grid versions had these two ports the other way around; if
you are carrying an old `.env`, check it.)

## CI

Day to day these templates run **locally** — `./ci.sh` or the framework's own runner.
GitHub Actions is here for the occasional sanity run you kick off deliberately.

Workflows live in [`.github/workflows`](.github/workflows) and are **manual dispatch
only** (`on: workflow_dispatch`): nothing fires on push, on PR, or on a schedule, because
runs consume grid capacity. Each takes a suite and an optional marker expression, uploads
JUnit XML + HTML reports as artifacts, and fails the run if zero tests matched.

If you fork this and *do* want automatic runs, add the trigger yourself — and size your
grid for it first.

Configure these once in **Settings → Secrets and variables → Actions**:

| Name | Kind | Purpose |
|---|---|---|
| `RA_GRID_HOST` | secret | Grid `host:port`. A secret rather than a variable so it is masked in run logs. |
| `RA_AUTH_TOKEN` | secret | Grid bearer token. |
| `BASE_URL` | variable | Application under test. |

A workflow's `grid_host` / `grid_url` input overrides the secret for a single run; left
blank, the secret is used.

### Two failure modes CI refuses to pass silently

- **No grid configured.** Without a host, a suite launches a local browser and goes green
  while proving nothing about the grid. The run fails instead.
- **A marker that matches nothing.** pytest exits `5` on "no tests collected", which reads
  like a pass, so the reports are checked for actual results.

## Playwright version parity

For the Playwright templates, the client and the grid's browser server **must be the same
version**. A mismatch does not announce itself — `browserType.connect` fails with
`Object with guid browser@… was not bound in the connection`, or the client hangs with no
error at all. Both Playwright templates pin their client version for this reason; bump it
in lockstep with the grid, not ahead of it.

## Contributing

Templates are meant to be forked and edited — that is their purpose. If you improve one in
a way that generalises, PRs are welcome. Keep configuration in the environment: no grid
hostnames, tokens, or account-specific URLs in committed files.

## License

MIT — see [LICENSE](LICENSE).
