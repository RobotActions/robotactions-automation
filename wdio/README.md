# WebdriverIO + Cucumber Template

BDD test automation with [WebdriverIO v9](https://webdriver.io/) and [Cucumber](https://cucumber.io/).

## Quick Start

```bash
npm install
npm test
```

## Project Structure

```
├── features/          # Gherkin feature files (.feature)
├── step-definitions/  # Cucumber step definitions + hooks
├── pageobjects/       # Page Object Model classes
├── test/specs/        # Regular Mocha tests (secondary)
├── wdio.conf.ts       # Cucumber config (primary)
└── wdio.mocha.conf.ts # Mocha config (secondary)
```

## Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run BDD tests (Cucumber feature files) — desktop |
| `npm run test:regular` | Run regular Mocha tests (secondary entry) |
| `npm run test:debug` | Run BDD tests with inspector |
| `npx wdio run wdio.mobileweb.conf.ts` | Mobile web — Chrome on a **real Android device** |
| `npx wdio run wdio.ios-mobileweb.conf.ts` | Mobile web — Safari on a **real iOS device** |

Filter by tag with `--cucumberOpts.tagExpression='@smoke'` (quote the whole expression;
`'@smoke and not @wip'` also works).

## Mobile web

The same feature file runs on both platforms; only the config differs. Things that are easy
to get wrong here:

- **Request the browser as `appium:browserName`, not W3C `browserName`.** Device nodes
  advertise only a native stereotype (`platformName` + `appium:*`, no `browserName`), and
  Grid's slot matcher requires a `browserName` match whenever one is requested — so the W3C
  form matches zero slots and the hub queues the session until the client times out
  (`UND_ERR_HEADERS_TIMEOUT` on `POST /session`).
- **No `appium:udid`.** The grid distributes each session to any free handset; pinning
  serialises the suite onto one device and fails whenever it is busy.
- **Take the first *displayed* match.** Several controls (theme toggle, language switcher,
  sign-in CTA) render twice — a hidden desktop node and a visible mobile one — so `$(...)`,
  which returns the first match regardless of visibility, times out on them. The page object
  resolves through a `firstDisplayed` helper instead.
- **One session for the whole run.** Unlike the Cucumber-JVM and pytest templates (a fresh
  session per scenario), WDIO reuses a single session across every scenario in a spec file.
  Much faster, weaker isolation, and far less session pressure on the grid — worth knowing
  before comparing timings or using this suite as a load probe.

## Remote Grid Execution

Set environment variables:

```bash
GRID_HOST=grid.example.com \
GRID_PORT=4444 \
AUTH_TOKEN=your-bearer-token \
BASE_URL=https://app.example.com \
npm test
```

## GitHub Actions

A manual-dispatch workflow lives at [`.github/workflows/wdio.yml`](../.github/workflows/wdio.yml)
(repo root — GitHub only reads workflows from there). `workflow_dispatch` only: each mobile
run consumes a real device, so it stays opt-in. Inputs pick the config (desktop BDD, mobile
Android, mobile iOS, or the Mocha entry), the tag expression, the grid endpoint, and
`maxInstances`. The token comes from `secrets.RA_AUTH_TOKEN`.

## Placeholders

Replace these before running:
- `{{PROJECT_NAME}}` — Your project name
- `{{BASE_URL}}` — Application URL under test
