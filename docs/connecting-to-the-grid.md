# Connecting to the grid

Everything you need to point an existing test suite at a RobotActions grid. The templates
in this repo are these recipes already wired up — start from one if you're starting fresh,
or lift the relevant snippet into a suite you already have.

Throughout, replace:

| Placeholder | What it is | Where to get it |
|---|---|---|
| `{{GRID_URL}}` | Your grid's base URL, e.g. `https://grid.example.com` | Your RobotActions account |
| `{{GRID_HOST}}` | The same without a scheme, e.g. `grid.example.com:443` | — |
| `{{AUTH_TOKEN}}` | Your grid bearer token | Dashboard → account |

**Never commit either value.** Locally they belong in `.env` (gitignored in every
template); in CI they belong in repository secrets — see the [CI section of the root
README](../README.md#ci).

## Auth in one line

Embed the token in the **URL path**: `{{GRID_URL}}/t/{{AUTH_TOKEN}}/…`

That's the whole story for Selenium, Appium and the native runner. It exists because
several clients — notably Appium Inspector and WebdriverIO — cannot attach an
`Authorization` header to a WebDriver connection, so the path prefix is the only auth that
works everywhere. Playwright is the exception, covered below.

---

## Selenium — browsers

**Python**

```python
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

driver = webdriver.Remote(
    command_executor="{{GRID_URL}}/t/{{AUTH_TOKEN}}",
    options=Options(),
)
driver.get("https://example.com")
print(driver.title)
driver.quit()
```

**Java**

```java
ChromeOptions options = new ChromeOptions();
WebDriver driver = new RemoteWebDriver(new URL("{{GRID_URL}}/t/{{AUTH_TOKEN}}"), options);
driver.get("https://example.com");
driver.quit();
```

Template: [`selenium-python`](../selenium-python).

---

## Appium — real devices

Same endpoint, mobile capabilities. `automationName` selects the engine: `UiAutomator2`
(Android), `XCUITest` (iOS), `Espresso` (Android native).

```python
from appium import webdriver
from appium.options.android import UiAutomator2Options

options = UiAutomator2Options().load_capabilities({
    "platformName": "Android",
    "appium:automationName": "UiAutomator2",
    "appium:udid": "<device-serial>",
    "appium:app": "/path/to/app.apk",
})
driver = webdriver.Remote("{{GRID_URL}}/t/{{AUTH_TOKEN}}", options=options)
```

Templates: [`appium-js`](../appium-js), [`wdio`](../wdio).

---

## Playwright — browsers

Playwright is the exception to the path-prefix rule, and it has two modes.

**Direct WS** — a browser container per session, the Playwright protocol end to end:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect("wss://{{GRID_HOST}}/playwright/chromium?token={{AUTH_TOKEN}}")
    page = browser.new_page()
    page.goto("https://example.com")
    browser.close()
```

> **The token goes in the query string, not in `connect(headers=…)`.** Playwright drops
> custom HTTP headers on a `ws://`/`wss://` upgrade, so a header-authenticated connect is
> rejected as unauthorised with no hint as to why.

**Selenium-remote** — routes Playwright through the WebDriver endpoint instead:

```bash
export SELENIUM_REMOTE_URL="{{GRID_URL}}"
export SELENIUM_REMOTE_HEADERS='{"Authorization":"Bearer {{AUTH_TOKEN}}"}'
```

```ts
const browser = await chromium.launch();   // routed to the grid
await browser.close();                     // always close — this mode ghosts sessions otherwise
```

Templates: [`playwright-python`](../playwright-python), [`playwright`](../playwright).

### Version parity (read this before debugging a connect failure)

Playwright's client and browser server **must be the same version**. A mismatch does not
say so — `connect()` fails with `Object with guid browser@… was not bound in the
connection`, or the client hangs with no error at all and the run looks stalled. Both
Playwright templates pin their client for exactly this reason. Pin yours to the version
your grid serves, and bump the two together.

---

## Reporting pass/fail back to the dashboard

Runs show up in the dashboard automatically, but they're far more useful with a name and a
result attached. From any Selenium or Appium session:

```python
driver.execute_script("ra:job-name=Checkout — guest user")
driver.execute_script("ra:testsuite=Regression")
driver.execute_script("ra:job-result=passed")      # or: failed
driver.execute_script("ra:fail-reason=Total mismatched: expected 42.00")
```

The name and suite can also be set at session creation with the `ra:testName` and
`ra:testsuite` capabilities, which is usually tidier — one place, no teardown hook.

Every template already wires this into its fixtures, so results land in the dashboard
without you writing any of it.

---

## Which approach fits

| You have | Use |
|---|---|
| Browser tests, any language | Selenium |
| Browser tests, prefer the Playwright API | Playwright (direct WS) |
| Mobile tests you're writing now | Appium (`UiAutomator2` / `XCUITest`) |
| Compiled native suites you don't want to rewrite | Native runner — ask us, it takes your built bundle as-is |

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `401 Unauthorized` on connect | Token missing from the URL path, or sent as a header by a client that can't attach one. Use `/t/{{AUTH_TOKEN}}/…`. |
| Playwright: `… was not bound in the connection`, or a silent hang | Client/server version mismatch. See version parity above. |
| Session succeeds but the page is an error page | DNS or egress from wherever the browser runs — check the page body, not the status code. WebDriver returns 200s through a failed navigation. |
| Tests pass locally, nothing appears in the dashboard | The suite launched a **local** browser because the grid URL was unset. Every template fails the run instead of passing quietly; check your `.env` or CI secrets. |
| `0 tests ran` but the job is green | A marker/tag expression matched nothing. The templates' `ci.sh` catches this and fails. |
