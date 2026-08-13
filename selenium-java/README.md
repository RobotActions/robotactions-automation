# Selenium + Java + Cucumber Template

BDD test automation with [Cucumber-JVM](https://github.com/cucumber/cucumber-jvm), [Selenium 4](https://www.selenium.dev/), and [Appium Java Client](https://github.com/appium/java-client). Drives **web browsers, Android apps, and iOS apps** from one template — the active platform is selected by the `PLATFORM` environment variable.

## Running with Maven

Everything runs through Maven Surefire. There is no wrapper script — `mvn test` with a
runner class and a tag filter is the entry point.

```bash
mvn test -Dtest=RunCucumberTest          # every scenario, every platform
```

Two flags do all the work:

| Flag | What it does |
|---|---|
| `-Dtest=RunCucumberTest` | selects the JUnit 5 `@Suite` runner that owns the Cucumber engine |
| `-Dcucumber.filter.tags="…"` | selects which scenarios run |

`PLATFORM` (env var, not a `-D` flag) picks the driver — `web`, `mobileweb`,
`ios-mobileweb`, `android`, `ios`. Pair it with a matching tag filter, or a web
scenario will run against a mobile driver:

```bash
# Desktop Chrome via the Grid
PLATFORM=web mvn test -Dtest=RunCucumberTest -Dcucumber.filter.tags="@smoke and not @mobileweb"

# Mobile web — Chrome on a real Android device via Appium
PLATFORM=mobileweb mvn test -Dtest=RunCucumberTest -Dcucumber.filter.tags="@mobileweb and @smoke"

# Mobile web — Safari on a real iOS device
PLATFORM=ios-mobileweb mvn test -Dtest=RunCucumberTest -Dcucumber.filter.tags="@mobileweb and @smoke"

# Native app automation
PLATFORM=android mvn test -Dtest=RunCucumberTest -Dcucumber.filter.tags="@android"
PLATFORM=ios     mvn test -Dtest=RunCucumberTest -Dcucumber.filter.tags="@ios"
```

Tag expressions are boolean: `"@smoke"`, `"@smoke and not @mobileweb"`,
`"@sanity or @smoke"`, `"@mobileweb and @sanity"`.

### Tag tiers

| Tag | Scope |
|---|---|
| `@smoke` | critical path, fast — must always pass |
| `@sanity` | broader functional coverage, includes `@smoke` |
| `@regression` | everything (default feature-level tag on the desktop suite) |
| `@mobileweb` | mobile-browser suite (see `robotactions-mobileweb.feature`) |

### Useful Maven invocations

```bash
mvn -o test -Dtest=RunCucumberTest                       # offline (skip dependency resolution)
mvn test -Dtest=RunCucumberTest -Dcucumber.execution.dry-run=true   # bind every step, launch no driver
mvn clean test -Dtest=RunCucumberTest                    # clean build + run (CI)
mvn test -Dtest=RunCucumberTest -Dsurefire.rerunFailingTestsCount=1 # one retry on failure
```

The **dry run** is the fastest way to catch an unbound or ambiguous step — it
executes the whole feature set without creating a session, so it needs neither a
grid nor a device.

Reports land in `reports/` (Cucumber HTML + JSON + JUnit XML); Surefire output is
under `target/surefire-reports/`.

## Project Structure

```
├── pom.xml                                            # Maven config (Selenium 4, Appium 9, Cucumber 7, JUnit 5)
├── src/test/resources/features/                      # Gherkin feature files (.feature)
├── src/test/resources/junit-platform.properties      # Cucumber/JUnit Platform config
├── src/test/java/com/example/tests/
│   ├── config/
│   │   ├── Env.java                                  # Env var reads (.env supported) with placeholder fallbacks
│   │   ├── DriverFactory.java                        # PLATFORM-aware driver creation, Bearer-header auth
│   │   ├── DriverHolder.java                         # ThreadLocal WebDriver
│   │   └── Http11HttpClientFactory.java              # Forces HTTP/1.1 (no h2c upgrade) for the proxy
│   ├── support/
│   │   ├── WaitHandlers.java                         # The only place a WebDriverWait is built (3 tiers)
│   │   └── ElementHandler.java                       # find / click / visibility on top of those waits
│   ├── pages/
│   │   ├── BasePage.java                             # Resolves both handlers, delegates to them
│   │   ├── RobotActionsHomePage.java                 # Desktop web page object
│   │   └── RobotActionsMobileWebPage.java            # Mobile-browser page object (menu, tap, no hover)
│   ├── steps/
│   │   ├── Hooks.java                                # Cucumber @Before/@After driver lifecycle
│   │   ├── RobotActionsLoadSteps.java                # Desktop BDD glue
│   │   ├── MobileWebSteps.java                       # Mobile-web BDD glue ("mobile …" step text)
│   │   └── ScenarioContext.java                      # ThreadLocal per-scenario state
│   ├── runners/
│   │   └── RunCucumberTest.java                      # JUnit 5 @Suite runner (primary entry)
│   └── regular/                                      # Non-BDD JUnit 5 tests (secondary entry) — EMPTY
```

> The `regular/` package is currently empty, so `mvn test -Dtest='*RegularTest'`
> matches no tests. Add one there to restore the secondary (non-BDD) entry point.

## Command reference

| Command                                                                            | Description                                  |
|------------------------------------------------------------------------------------|----------------------------------------------|
| `mvn test -Dtest=RunCucumberTest`                                                  | All BDD scenarios (no tag filter)            |
| `PLATFORM=web mvn test -Dtest=RunCucumberTest -Dcucumber.filter.tags="@smoke"`     | Desktop smoke                                |
| `PLATFORM=mobileweb mvn test -Dtest=RunCucumberTest -Dcucumber.filter.tags="@mobileweb"` | Full mobile-web suite on Android       |
| `PLATFORM=ios-mobileweb mvn test -Dtest=RunCucumberTest -Dcucumber.filter.tags="@mobileweb"` | Same suite on iOS Safari           |
| `mvn test -Dtest=RunCucumberTest -Dcucumber.execution.dry-run=true`                | Verify step bindings, no driver              |
| `mvn test -Dtest='*RegularTest'`                                                   | Non-BDD JUnit tests (none present yet)       |
| `mvn clean test -Dtest=RunCucumberTest`                                            | Clean build + test (CI)                      |

## Remote Grid / Appium Server

The same `GRID_URL` + `AUTH_TOKEN` flow drives Selenium Grid (for `PLATFORM=web`) and an
Appium server fronted by the grid proxy (for the mobile platforms). The token is sent as an
`Authorization: Bearer …` header on every WebDriver request — see
`DriverFactory.authHeaderFilter()`. (The `/t/<token>` path-prefix form is used by the
Python/WDIO templates; the Java client needs the header form — the javadoc on
`executorUrl()` explains why.)

```bash
PLATFORM=android \
GRID_URL=http://grid:5555 \
AUTH_TOKEN=your-token \
APP_PATH=/abs/path/to/app.apk \
DEVICE_UDID=emulator-5554 \
PLATFORM_VERSION=14 \
mvn test -Dtest=RunCucumberTest -Dcucumber.filter.tags="@android"
```

Env vars are read from the process first, then `.env` (see `Env.java`), so anything below
can live in `.env` instead of the command line:

| Var | Used by | Notes |
|---|---|---|
| `GRID_URL` / `GRID_HOST` | all | defaults to `http://localhost:5555` |
| `AUTH_TOKEN` | all | grid/Appium proxy token; a 401 at `newSession` means it expired |
| `BASE_URL` | web | application under test |
| `PLATFORM` | all | `web` / `mobileweb` / `ios-mobileweb` / `android` / `ios` |
| `CI` | web | `true` forces Chrome headless; unset for headed debugging |
| `RA_TESTSUITE` | all | suite label sent as the `ra:testsuite` capability |
| `APP_PATH`, `DEVICE_UDID`, `PLATFORM_VERSION`, `BUNDLE_ID` | native app | native `@android` / `@ios` runs only |

**The mobile-web platforms do not pin a device.** `createMobileWeb()` and
`createIosMobileWeb()` send no `appium:udid`, so the grid distributes each session to any
free Android/iOS web slot. Pinning a udid would serialise every scenario onto one handset
and fail whenever it is busy or offline.

**Mobile web requests the browser as `appium:browserName`, not W3C `browserName`.** Device
slots advertise a native stereotype only (`platformName: ANDROID` + `appium:*`, no
`browserName`), and Grid's slot matcher requires a `browserName` match whenever one is
requested — so the W3C form matches zero slots and the hub silently queues the request
until it times out. The `appium:`-prefixed form is invisible to the matcher, routes to the
native slot, and the driver opens the browser from inside the session. This is also why
`ChromeOptions` can't be used there: it always stamps W3C `browserName: chrome`.

## GitHub Actions

A manual-dispatch workflow lives at [`.github/workflows/selenium-java.yml`](../.github/workflows/selenium-java.yml)
(repo root — GitHub only reads workflows from there). It is `workflow_dispatch` only: every
run consumes real devices, so it stays opt-in. Inputs: `platform` (choice), `tags`,
`grid_url` (default `https://enterprise-grid.robotactions.com`); the token comes from
`secrets.RA_AUTH_TOKEN`.

It also guards against a trap worth knowing about: **a tag or name filter that matches
nothing runs 0 scenarios and Maven still exits 0** — a green build that tested nothing. The
workflow parses `reports/cucumber.json` and fails when the scenario count is zero.

For a downstream project that cloned this template, the equivalent minimal workflow:

```yaml
name: mobile-web
on: [push, workflow_dispatch]

jobs:
  mobile-web:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: mobileweb       # Chrome on a real Android device
          - platform: ios-mobileweb   # Safari on a real iOS device
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: temurin
          cache: maven
      - name: Run mobile-web suite
        env:
          GRID_URL: https://enterprise-grid.robotactions.com
          AUTH_TOKEN: ${{ secrets.RA_AUTH_TOKEN }}
          PLATFORM: ${{ matrix.platform }}
          RA_TESTSUITE: ${{ github.workflow }} (${{ matrix.platform }})
        run: mvn test -Dtest=RunCucumberTest -Dcucumber.filter.tags="@mobileweb and @smoke"
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: cucumber-${{ matrix.platform }}
          path: reports/
```

Notes that matter in CI:

- **Scheme.** `GRID_URL`/`GRID_HOST` may be given with or without one. A bare host resolves
  to `https://` unless it is loopback, so the public endpoint is never downgraded to
  cleartext — see `Env.gridUrl()`.
- **Secrets, not `.env`.** `Env` reads the process environment before `.env`, so the
  workflow's `env:` block wins with no file changes. Never commit a real token; every
  template's `.env` is gitignored.
- **Don't set `CI=true` for mobile.** GitHub sets `CI=true` automatically, which forces
  Chrome headless — that only applies to `PLATFORM=web`; mobile drivers ignore it.
- **`RA_TESTSUITE` labels the run** in the RobotActions dashboard, and `Hooks` additionally
  stamps each session with its scenario name and pass/fail, so a CI failure is traceable to
  one session.
- **Timeouts.** Session creation on a real handset routinely exceeds 60 s, so the Appium
  paths use a 300 s read timeout (`MOBILE_READ_TIMEOUT`). Keep the job timeout above that.

## Placeholders

Substituted at template clone time — keep literal in committed code:

- `{{PROJECT_NAME}}` — Maven `artifactId`
- `{{BASE_URL}}` — Application URL under test (web)
- `{{AUTH_TOKEN}}` — Grid/Appium proxy auth token
- `{{APP_PATH}}` — Mobile app `.apk` / `.ipa` path
- `{{DEVICE_UDID}}` — Mobile device or emulator UDID

The default Java package is `com.example.tests`. Rename it to your own package (and update the `<groupId>` in `pom.xml`) after cloning — keep `RunCucumberTest`'s `GLUE_PROPERTY_NAME` aligned with wherever you move the steps package.

## Authoring new scenarios

1. Add the scenario to `src/test/resources/features/<file>.feature` and tag it with a platform (`@web` / `@mobileweb` / `@android` / `@ios`) plus a tier (`@smoke` / `@sanity` / `@regression`).
2. Add step glue under `src/test/java/com/example/tests/steps/` — reuse existing steps before adding new ones. Cucumber scans the whole `steps` package, so two identical step patterns are a `DuplicateStepDefinitionException`; the mobile steps are all prefixed "mobile …" for exactly this reason.
3. Add or extend a page object under `src/test/java/com/example/tests/pages/` — **locators are declared at the top of the class** (static `By` fields, or static factory methods for text-driven ones) and used by the methods below. No selector literal inside a method, ever.
4. Never call `new WebDriverWait(...)`. Take a tier from `BasePage` (`shortWait` / `wait` / `longWait`) or reach for `WaitHandlers.forDriver(...)` / `ElementHandler.forDriver(...)` from a step.
5. Use `anyVisible` / `clickAnyVisible` when a locator can match a hidden duplicate — the responsive site renders several controls twice (desktop node hidden, mobile node visible), and plain `visible` only ever inspects the first match.
6. Verify bindings without a grid: `mvn test -Dtest=RunCucumberTest -Dcucumber.execution.dry-run=true`, then run the suite for the platform you touched.
