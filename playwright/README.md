# Playwright + playwright-bdd Template

BDD test automation with [playwright-bdd](https://github.com/vitalets/playwright-bdd) and [Playwright Test](https://playwright.dev/).

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
npm install
npx playwright install chromium
npm test
```

## Project Structure

```
├── features/          # Gherkin feature files (.feature)
├── steps/             # BDD step definitions + fixtures
├── pages/             # Page Object Model classes
├── tests/             # Regular (non-BDD) Playwright tests
├── playwright.config.ts         # BDD config (primary)
└── playwright.regular.config.ts # Regular test config (secondary)
```

## Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run BDD tests (feature files) |
| `npm run test:regular` | Run regular Playwright tests |
| `npm run test:headed` | Run BDD tests in headed browser |
| `npm run test:debug` | Run BDD tests with Playwright Inspector |
| `npm run report` | Open HTML test report |

## Remote Grid Execution

Set environment variables to run against a Selenium Grid:

```bash
SELENIUM_REMOTE_URL=http://grid:5555 \
SELENIUM_REMOTE_HEADERS='{"Authorization":"Bearer <token>"}' \
npm test
```

## Placeholders

Replace these before running:
- `{{PROJECT_NAME}}` — Your project name
- `{{BASE_URL}}` — Application URL under test
