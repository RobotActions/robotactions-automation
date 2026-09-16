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
| `npm run bddgen` / `npm run bddgen:watch` | Regenerate `.features-gen` once / on every change (VS Code Testing view) |

## VS Code

**Before the editor is useful, run `npm install` in this folder.** Node globals
(`process`, `require`) come from `@types/node`, a devDependency pinned in
`package-lock.json`. Until it is on disk TypeScript reports *"Cannot find name
'process'. Do you need to install type definitions for node?"* on every config and
step file, and the Testing view stays empty because the extensions cannot load the
run configs either.

Open this folder directly (not the repository root) so the extensions below bind to this
project's `node_modules` and configs. VS Code offers the recommended extensions on first
open — `.vscode/extensions.json` lists them:

| Extension | What it gives you |
|-----------|-------------------|
| `ms-playwright.playwright` | Scenarios in the Testing view; run/debug a single scenario; breakpoints in steps |
| `CucumberOpen.cucumber-official` | Step autocomplete and go-to-definition inside `.feature` files |

The Testing view lists what `playwright.config.ts` points at, and for playwright-bdd that
is the **generated** `.features-gen/` directory — not `features/`. So the generated specs
have to exist and stay current:

- `.vscode/tasks.json` starts `bddgen: watch` when the folder opens (VS Code asks once to
  allow automatic tasks — answer **Allow**). It regenerates on every save under
  `features/` or `steps/`, so the Testing view tracks what you just typed.
- Run it by hand any time with `npm run bddgen:watch`, or regenerate once with
  Cmd/Ctrl+Shift+B (the default build task) or `npm run bddgen`.
- If a new scenario does not appear, hit **Refresh Tests** in the Testing view.

Grid target and auth are not duplicated in the editor config: the extension runs Playwright
with this folder as the working directory, and `config.ts` loads `.env` (`GRID_HOST`,
`AUTH_TOKEN`, `BASE_URL`). Per-machine overrides go in `playwright.env` in your own
settings. `F5` runs the whole suite under the debugger — see `.vscode/launch.json`.

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
