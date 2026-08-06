# RobotActions Automation Templates

Ready-to-run test automation templates that execute against a **RobotActions grid** —
real Android and iOS devices plus elastic browser nodes behind a single WebDriver /
Playwright endpoint.

Each template is a complete project, not a snippet: page objects, BDD features, fixtures,
reporting, and a CI entry point that runs the same way on a laptop and in GitHub Actions.

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

| Variable | Meaning |
|---|---|
| `GRID_URL` / `GRID_HOST` | Your grid endpoint, `host:port`. Blank runs a **local** browser. |
| `AUTH_TOKEN` | Grid bearer token. Sent as `?token=` on WS upgrades and as a header elsewhere. |
| `BASE_URL` | The application under test. |
| `RA_TESTSUITE` | Suite label the grid stores against the session, so runs are identifiable in the dashboard. |

## CI

Workflows live in [`.github/workflows`](.github/workflows) and are **manual dispatch only** —
runs consume grid capacity, so nothing fires automatically. Each takes a suite and an
optional marker expression, uploads JUnit XML + HTML reports as artifacts, and fails the
run if zero tests matched.

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
