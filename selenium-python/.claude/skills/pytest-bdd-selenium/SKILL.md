---
name: pytest-bdd-selenium
description: pytest-bdd + Selenium WebDriver + Appium-Python-Client expertise — feature file → step defs → page objects → fixtures, grid routing via /t/<token> path-prefix, pytest-xdist parallelism, locator strategies. Load before adding/changing scenarios or steps in `testgen/selenium-python/`.
---

# pytest-bdd + Selenium (Python)

The primary BDD pattern: `.feature` → `pytest-bdd` step decorators → standard pytest collection. The `PLATFORM` env var (`web | android | ios`) flips between Selenium browser and Appium mobile drivers using the same step set; this skill focuses on `PLATFORM=web`.

## File layout

```
features/                       — Gherkin specs (.feature)
tests/
  step_defs/                    — step implementations (one .py per feature file)
    test_robotactions_load.py   — generated to match features/robotactions-load.feature
pages/                          — Page Object Model
  base.py                       — BasePage with retry / wait helpers
  robotactions_home.py          — page-specific actions/locators
conftest.py                     — fixtures (driver, grid_url, base_url, browser)
requirements.txt                — pinned dependency set
```

## Grid routing

`conftest.py` builds the executor URL with the proxy's path-prefix auth:

```python
def _executor_url(grid_url: str, auth_token: str) -> str:
    if auth_token and auth_token != "{{AUTH_TOKEN}}":
        return f"{grid_url.rstrip('/')}/t/{auth_token}"
    return grid_url
```

`.env` provides `GRID_HOST=localhost:5555` + `AUTH_TOKEN=<jwt>` + `BASE_URL=https://robotactions.com`. The `browser` fixture builds `webdriver.Remote(command_executor=executor_url, options=ChromeOptions())`.

## Adding a step for an existing feature

1. The matching test file is `tests/step_defs/test_<feature>.py` — pytest-bdd convention.
2. Use the decorators + the `browser` fixture:

```python
from pytest_bdd import scenarios, given, when, then, parsers
from pages.robotactions_home import RobotActionsHomePage

scenarios("../../features/robotactions-load.feature")

@when(parsers.parse('I click the "{label}" nav link'))
def click_nav_link(browser, label):
    RobotActionsHomePage(browser).click_nav_link(label)

@then(parsers.parse('the URL fragment should be "{fragment}"'))
def url_fragment(browser, fragment):
    assert browser.current_url.endswith(fragment), (
        f"expected fragment {fragment} in {browser.current_url}"
    )
```

`scenarios()` registers every scenario in the feature as a generated test. `parsers.parse` matches Gherkin placeholders with type-coercion.

## Locator priority (Selenium-Python)

```python
from selenium.webdriver.common.by import By
```

1. **Accessible role + name** — no native getByRole in Selenium; emulate with `(By.XPATH, f'//a[normalize-space()="{label}"]')` for links, `//button[normalize-space()="{label}"]` for buttons
2. **By.LINK_TEXT** / **By.PARTIAL_LINK_TEXT** — for anchor tags
3. **By.XPATH** with `normalize-space()` text predicate — visible-text fallback
4. **By.CSS_SELECTOR** with `[data-testid="..."]` — only when available
5. Raw CSS path — last resort

Never `time.sleep(N)`. Use `WebDriverWait`:

```python
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

WebDriverWait(browser, 10).until(
    EC.visibility_of_element_located((By.XPATH, "//h1"))
)
```

## Hydration check

React mount marker — wait for the first `<main>` to be visible:

```python
@given("I wait for the SPA to hydrate")
def wait_for_hydration(browser):
    WebDriverWait(browser, 10).until(
        EC.visibility_of_element_located((By.TAG_NAME, "main"))
    )
    # readyState complete + one paint
    WebDriverWait(browser, 5).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )
```

## Console-error assertion

Selenium needs the browser to emit logs over W3C BiDi or via `goog:loggingPrefs`. Modern Chrome 130+ via Selenium 4 supports `chrome.set_capability("goog:loggingPrefs", {"browser": "ALL"})`. Then:

```python
@then("no console errors should have been logged")
def no_console_errors(browser):
    logs = browser.get_log("browser")
    errors = [l for l in logs if l["level"] in ("SEVERE", "ERROR")]
    assert errors == [], f"console errors: {errors}"
```

Set the cap inside the `browser` fixture in `conftest.py`:

```python
options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
```

## Parallel workers — how the load runner uses them

```bash
./load.sh 10 3 @load   # 10 xdist workers × 3 repeats per scenario
```

Translates to `pytest tests/step_defs/ -n 10 --count 3 --tags=@load`. Each xdist worker is a separate Python process; the `browser` fixture in each process creates its own `webdriver.Remote` → separate W3C session against the grid.

`pytest-xdist` distribution is per-test (each scenario becomes a test via `scenarios()`). For the robotactions-load feature, 25 scenarios × 10 workers means each worker handles ~2-3 scenarios; with `--count=3` each runs 3× = ~7-9 grid sessions per worker.

## pytest-bdd gotchas

- **`scenarios()` location matters** — call it at module top level of `test_<feature>.py`, NOT inside a function. pytest collects the generated tests at import time.
- **Step parameter types** — `parsers.parse('{N:d}')` for ints. Plain `{label}` is str. Avoid `parsers.re('...')` unless you really need regex; it's slower and harder to debug.
- **Background steps run per scenario** — same as Cucumber. If a heavy setup needs to run once per file, use a session-scoped fixture instead.
- **`scenarios("../../features/x.feature")` path** is relative to the test file, NOT to `conftest.py`.

## When the test_status / job-result hooks should fire

The appium-grid-service supports test-status magic strings via `executeScript`. The `selenium-python` template has a hook in `conftest.py` that calls `driver.execute_script("ra:job-result=...")` automatically based on `pytest_runtest_makereport`. Don't manually call it from steps — the conftest hook is the single source of truth so the dashboard's pass/fail surface stays consistent.
