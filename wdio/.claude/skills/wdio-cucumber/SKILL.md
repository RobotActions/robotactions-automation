---
name: wdio-cucumber
description: WebdriverIO v9 + Cucumber (TypeScript) expertise — feature file → step definitions → page objects, grid routing via path-prefix /t/<token>, parallel `maxInstances`, $-chained locator strategies. Load before adding/changing scenarios or steps in `testgen/wdio/`.
---

# WebdriverIO + Cucumber (TypeScript)

The primary BDD pattern: `.feature` → `@wdio/cucumber-framework` decorators → WDIO runner. WDIO speaks W3C WebDriver directly (it's NOT a Selenium binding); the same grid endpoint serves both because the proxy at port 4444 forwards W3C commands transparently.

## File layout

```
features/                       — Gherkin specs (.feature)
step-definitions/               — step implementations
  robotactions-load.steps.ts    — Given/When/Then for the load feature
pageobjects/                    — Page Object Model
  base.page.ts                  — base class with retry / wait helpers
  robotactions.home.page.ts     — page-specific actions/locators
wdio.conf.ts                    — runner config (BDD; primary)
wdio.mocha.conf.ts              — Mocha runner (secondary)
```

## Grid routing

`wdio.conf.ts` reads `.env` and constructs the connection. The proxy's path-prefix auth fits WDIO better than headers because the `webdriver` package historically rejected custom Authorization on the WS upgrade — set the token in the `path` field:

```ts
const authToken = process.env.AUTH_TOKEN || '';
export const config = {
  protocol: 'http',
  hostname: (process.env.GRID_HOST || 'localhost').split(':')[0],
  port: parseInt((process.env.GRID_HOST || '').split(':')[1] || '4444', 10),
  path: authToken ? `/t/${authToken}` : '/',
  // ...
};
```

This template ships with the Bearer-header variant. Path-prefix is the recommended swap if you hit `401` on the WS upgrade.

## Adding a step for an existing feature

```ts
import { Given, When, Then } from '@wdio/cucumber-framework';
import { browser, $, $$ } from '@wdio/globals';

When(/^I click the "(.+)" nav link$/, async (label: string) => {
  await $(`nav a*=${label}`).click();
});

Then(/^the URL fragment should be "(.+)"$/, async (fragment: string) => {
  await browser.waitUntil(
    async () => (await browser.getUrl()).endsWith(fragment),
    { timeout: 5_000, timeoutMsg: `URL never matched ${fragment}` },
  );
});
```

WDIO step decorators take a regex (raw RegExp) or Cucumber expressions (`{string}`, `{int}`); regex is more flexible but ugly. Pick one and stay consistent across step files.

## Locator priority (WDIO)

WDIO has `$` and `$$` selector helpers + a few specialized selectors:

1. **`$('=text')`** — exact visible text (anchors, buttons) — closest to `getByText({exact:true})`
2. **`$('*=text')`** — partial visible text
3. **`$('//*[@aria-label="..."]')`** — XPath for aria attributes
4. **`$('[data-testid="..."]')`** — test-id when present
5. **`$('css.selector.path')`** — last resort

```ts
await $('=Sign in / Sign up').click();   // exact match
await $('*=Free Trial').click();          // contains
```

All `$(...)` selectors auto-wait for existence by default (`waitforTimeout: 10000` in config). For visibility add `await $('...').waitForDisplayed()`.

## Hydration check

```ts
Given('I wait for the SPA to hydrate', async () => {
  await $('main').waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => (await browser.execute(() => document.readyState)) === 'complete',
    { timeout: 5_000 },
  );
});
```

## Console-error assertion

WDIO exposes Chrome console logs via `browser.getLogs('browser')`. Set the cap once in `wdio.conf.ts`:

```ts
capabilities: [{
  browserName: 'chrome',
  'goog:loggingPrefs': { browser: 'ALL' },
  'goog:chromeOptions': { args: process.env.CI ? ['--headless'] : [] },
}],
```

Then in the step:

```ts
Then('no console errors should have been logged', async () => {
  const logs = await browser.getLogs('browser');
  const errors = logs.filter((l) => l.level === 'SEVERE');
  expect(errors).toEqual([]);
});
```

## Parallel workers — how the load runner uses them

```bash
./load.sh 10 3 @load   # maxInstances=10 × CUCUMBER_REPEAT=3
```

`wdio.conf.ts` reads `WDIO_MAX_INSTANCES` env var (with the literal as fallback) and `CUCUMBER_REPEAT` for per-scenario repeats. WDIO spawns N child processes; each gets its own browser session via the grid. Independent W3C WebDriver sessions — no cross-talk.

At N=10:
- 10 concurrent `POST /session` against the proxy
- Each child runs scenarios in serial until the batch is done
- `CUCUMBER_REPEAT=3` repeats every scenario 3× per worker = ~75 sessions for the full robotactions-load feature with N=10

To force the queue waiter to kick in (test the `MAX_WS_CONNECTIONS` / per-IP cap), set N higher than `MAX_WS_CONNECTIONS` (default 10) in the grid's `.env`.

## WDIO v9 gotchas

- **`@wdio/globals`** — the `browser` / `$` / `$$` globals are NOT real Node globals; they come from this import. If TypeScript complains, the import is missing.
- **Async chains** — `await $('a').$('b')` is fine; don't `await $('a').$('b').waitForDisplayed()` without parens; wrap if linting flags it.
- **No raw `browser.url(url)` in steps for setup** — the page-object's `open()` method should encapsulate this so multiple steps don't re-navigate.
- **Reporter outputs** — `test-results/*.xml` (JUnit) and `reports/html/report.html` (wdio-html-nice-reporter) are written per-worker; aggregate them in CI via `xunit-viewer` or similar.
- **Tag expressions** — `--cucumberOpts.tagExpression="@load"` (single tag) or `"@load and not @wip"` for compound; quote the whole expression.
