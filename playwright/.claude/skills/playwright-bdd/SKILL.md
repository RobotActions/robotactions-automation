---
name: playwright-bdd
description: Playwright + playwright-bdd (TypeScript) expertise — feature file → step defs → page objects → fixtures, grid routing via SELENIUM_REMOTE_URL/HEADERS, parallel workers, locator strategies. Load before adding/changing scenarios or steps in `testgen/playwright/`.
---

# playwright-bdd (TypeScript)

The primary BDD pattern in this template: `.feature` → `playwright-bdd` codegen → standard `@playwright/test` runner. `bddgen` generates spec files into `.features-gen/` from the Gherkin; the runner picks them up like any other `*.spec.ts`.

## File layout

```
features/                — Gherkin specs (.feature)
steps/                   — step definitions + fixtures
  fixtures.ts            — `test` fixture extended with page objects
  *.steps.ts             — Given/When/Then implementations
pages/                   — Page Object Model
  BasePage.ts            — base class with retry / wait helpers
  RobotActionsHomePage.ts — page-specific actions/locators
playwright.config.ts     — BDD config (primary)
playwright.regular.config.ts — non-BDD pytest-style runner (secondary)
```

## Grid routing

`playwright.config.ts` already wires the grid via Playwright's built-in Selenium support:

```ts
process.env.SELENIUM_REMOTE_URL = process.env.SELENIUM_REMOTE_URL || `http://${gridHost}`;
if (authToken) {
  process.env.SELENIUM_REMOTE_HEADERS = JSON.stringify({ Authorization: `Bearer ${authToken}` });
}
```

`.env` provides `GRID_HOST=localhost:5555` + `AUTH_TOKEN=<jwt>`. No code changes needed to switch grids.

## Adding a step for an existing feature

1. Find the unimplemented step in the runner's failure output (`Step "..." has no matching definition`).
2. Add to the appropriate `*.steps.ts` (group by feature file).
3. Use the fixture-bound `page` + page object:

```ts
import { Given, When, Then } from 'playwright-bdd/decorators';
import { test } from './fixtures';

When('I click the {string} nav link', async ({ page }, label: string) => {
  await page.getByRole('link', { name: label }).click();
});

Then('the URL fragment should be {string}', async ({ page }, fragment: string) => {
  await expect(page).toHaveURL(new RegExp(fragment.replace('#', '#')));
});
```

## Locator priority (in order)

1. `getByRole(role, { name })` — accessibility-grounded, survives most refactors
2. `getByText(text, { exact: true })` — for visible-text elements without a role
3. `getByLabel(text)` — form labels
4. `getByTestId('id')` — only when the team adds `data-testid` (most marketing sites don't)
5. CSS / XPath — last resort; brittle

Never use `page.waitForTimeout(N)` for state — only for fixed transitions you can't observe (e.g. CSS animations with no completion event). Use `expect(...).toBeVisible()` with auto-wait instead.

## Hydration check (SPA-specific)

robotactions.com is React; clicks should `await Promise.race([networkidle, visible-content-check])`. The `Given I wait for the SPA to hydrate` step in this template polls for the React mount marker:

```ts
Given('I wait for the SPA to hydrate', async ({ page }) => {
  // Wait for a known root-mounted element + 1 paint.
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForFunction(() => document.readyState === 'complete');
});
```

## Console-error assertion

Wire a `console` listener in the fixture, accumulate into a request-scoped array, assert empty at the end:

```ts
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await use(errors);
  },
});

Then('no console errors should have been logged', async ({ consoleErrors }) => {
  expect(consoleErrors).toEqual([]);
});
```

## Parallel workers — how the load runner uses them

```bash
./load.sh 10 3 @load   # 10 workers × 3 repeats per scenario
```

Translates to `npx playwright test --workers=10 --repeat-each=3 --grep=@load`. Each worker spins its own browser context (grid-side: separate WebDriver session). At N=10 against the local grid, expect:
- 10 concurrent `POST /session` against port 5555
- 10 active sessions on the dashboard's Running Sessions panel
- Container spawn pace bounded by `MAX_SESSIONS_PER_IDENTITY` (default 5) — over-budget requests 503 with a `Retry-After` header
- `--repeat-each` runs each scenario N times sequentially per worker, so total sessions = workers × repeats × matching-scenarios

To exceed the per-identity cap on purpose (load-test the gate), set `MAX_SESSIONS_PER_IDENTITY` higher in the grid's `.env` for the run. Don't increase the JWT-derived identity count — the gate keys on `email` from the token.

## Anti-patterns specific to this template

- **Don't** put step implementations in the `tests/` regular-test folder. `bddgen` won't see them and the BDD runner will fail.
- **Don't** use `test.beforeAll` for browser launch — playwright-bdd needs per-scenario page contexts to map cleanly to scenario lifecycle.
- **Don't** call `page.goto(baseURL)` in steps — the fixture already navigates in `Given I open the RobotActions home page`. Re-navigating breaks the URL-fragment assertions later in the scenario.

## When you need raw Playwright APIs

`playwright-bdd` exposes the unmodified Playwright `Page` object. Anything that works in vanilla Playwright works here — including `page.tracing.start()`, `page.coverage.startJSCoverage()`, network interception, etc. Useful for debugging step failures under load.
