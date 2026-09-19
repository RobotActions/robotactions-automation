# Appwright — native app tests on real devices

[Appwright](https://github.com/empirical-run/appwright) is Playwright's test runner
and assertion style over Appium: `device.getByText('Sign in').tap()` instead of
capabilities and element ids. This template runs it against a **RobotActions
grid**, so the devices are real handsets the grid hands out rather than emulators
on your laptop.

```bash
cp .env.example .env          # fill in GRID_HOST + AUTH_TOKEN
npm install
npm test                      # BDD suite (device smoke — no app needed)
```

A fresh clone is green: the default suite is a device-level smoke that needs no
app installed, so you see a real session in the dashboard before writing
anything. Point `APP_PATH` at your build to run the app suite.

| Command | Runs |
|---|---|
| `npm test` | BDD features, `@app` excluded — green with no app |
| `npm run test:app` | The `@app` features (needs `APP_PATH`) |
| `npm run test:settings` | The `@settings` walkthrough — a real app, no build needed |
| `npm run test:regular` | Regular non-BDD specs under `tests/` |
| `npm run test:tagged @smoke` | Features matching a tag |
| `npm run test:debug` | Playwright inspector |
| `npm run report` | Open the HTML report |

## How this connects

Appwright ships four device providers — `browserstack`, `lambdatest`, `emulator`
and `local-device` — chosen by a hardcoded `switch`. There is no registry to add
a grid to, and `local-device` is not a way in: it spawns its own Appium on
`localhost:4723` and shells out to `adb` / Xcode locally.

So this template does not name a provider. It builds the Appium session against
the grid itself and wraps it in Appwright's exported `Device` class — the one
behind every `device.getByText(...)` call:

```
providers/robotactions.ts   session on the grid  →  new Device(client, …)
steps/fixtures.ts           exposes it as the `device` fixture
features/ + tests/          use the ordinary Appwright API
```

Nothing is patched or forked, and the Appwright API is the real one rather than a
lookalike. The session itself is ordinary Appium — the same capabilities every
other template in this repo sends — so the grid needs nothing special either.

Two consequences worth knowing:

- **`device.setMockCameraView()` is a no-op.** Appwright implements it with
  BrowserStack's and LambdaTest's own image-injection executors and branches on
  the provider name. Everything else on `Device` is plain WebDriver and behaves
  identically.
- **The runner is Playwright's, driven directly** — `npx playwright test`, not
  `npx appwright test`. Appwright's CLI is a shim over
  `npx playwright test --config appwright.config.ts`, and its `defineConfig`
  wrapper adds a global setup that rejects any provider outside its four plus a
  video reporter that downloads recordings from BrowserStack. Neither applies
  here; the recording, logs and video are in the dashboard already. This is also
  why the config is `playwright.config.ts` — `bddgen` and the VS Code Playwright
  extension both discover `playwright*.config.ts` and neither finds anything
  under the other name.

## Driving a real app without a build

`npm run test:settings` runs the `@settings` walkthrough against the
**preinstalled Settings app**, read-only. It is the quickest way to prove the API
works on a device — text and id locators, `getText`, tap-and-navigate, scrolling
a long list — with nothing to upload:

```bash
RUN_SETTINGS_WALKTHROUGH=true DEVICE_UDID=<a stock handset> WORKERS=1 npm run test:settings
```

Three things about it, all deliberate:

- **Opt-in.** It asserts on *stock* Android and iOS labels, and OEM skins rename
  them — "Network and Internet" is "Connections" on Samsung. Since the default
  run takes whatever device is free, leaving it on would make a fresh clone
  flaky. Hence `RUN_SETTINGS_WALKTHROUGH` plus a pinned `DEVICE_UDID`.
- **`WORKERS=1` when a device is pinned.** All workers target that one handset,
  so extra workers just queue for it.
- **The steps are generic, the labels are not.** `steps/settings.steps.ts` has no
  knowledge of Settings beyond opening it — every label and identifier lives in
  the feature files (`I tap "About phone"`, `the element with id "…" is on
  screen`). Those steps are the ones to reuse for your own app; only the two
  feature files are throwaway.

## Configuration

Everything comes from the environment, with `.env` as the fallback — see
[`.env.example`](.env.example) for the annotated list. `config.ts` is the only
file that reads it.

| Variable | Meaning |
|---|---|
| `GRID_HOST` / `GRID_URL` | Grid endpoint, `host:port`. `:5555` locally, `443` hosted. |
| `AUTH_TOKEN` | Grid bearer token. Rides the URL path (`/t/<token>/wd/hub`) — built for you. |
| `PLATFORM` | `android`, `ios`, or `android,ios` — one Playwright project each. |
| `DEVICE_UDID` | Pin one handset. Normally leave unset and let the grid choose. |
| `APP_PATH` | `.apk`/`.ipa` path **or https URL** — the grid fetches and installs it. |
| `APP_PACKAGE` / `BUNDLE_ID` | For activating, terminating, and iOS clipboard reads. |
| `RA_TESTSUITE` | Suite label stored against the session, for dashboard grouping. |
| `WORKERS` | Devices to use at once. Defaults to 1. |

### Placeholders

`package.json` carries `{{PROJECT_NAME}}`. Everything else is an env var, so
there is nothing else to substitute.

## Writing tests

Steps and specs both receive a `device` — an Appwright `Device` on a real handset:

```ts
import { Given, Then, expect } from './fixtures';

Given('the app is on the login screen', async ({ device }) => {
    await device.getById('username').waitFor('visible');
});

Then('the dashboard is shown', async ({ device }) => {
    await expect(device.getById('dashboard')).toBeVisible();
});
```

`getById` is the accessibility id — the one selector that ports across platforms
(`contentDescription` on Android, `accessibilityIdentifier` on iOS). `getByText`
and `getByXpath` are the fallbacks when you cannot change the app.
`pageobjects/LoginScreen.ts` shows the page-object shape.

One Appium session is created **per test**, not per worker. Sharing a session
makes failures depend on execution order. The cost is session setup per test,
which is why `TEST_TIMEOUT` defaults to 240s.

### Two behaviours worth knowing before you write assertions

**Locators never scroll.** Appwright has no scroll-into-view: a locator matches
only what is currently rendered, and one `scroll()` advances roughly one screen.
Anything further down a long list needs an explicit loop:

```ts
async function scrollUntilVisible(device: Device, locator: AppwrightLocator, attempts = 8) {
    for (let i = 0; i < attempts; i++) {
        if (await locator.isVisible({ timeout: 2000 })) return true;
        // The scrollable container, not the element you are looking for —
        // locator.scroll() scrolls *within* the element it is called on.
        await device.getByXpath('//*[@scrollable="true"]').scroll(ScrollDirection.DOWN);
    }
    return locator.isVisible({ timeout: 2000 });
}
```

**A new session is not a new app.** Appium attaches to the app already running,
and with `APP_FULL_RESET=false` (or no `APP_PATH` at all) the process keeps its
task stack — so a test can open three screens deep because the previous test
navigated there. This template therefore terminates and relaunches the app at
the start of each session whenever `appBundleId` is known and no reinstall is
happening, which puts every test on the app's first screen. It is skipped when
`APP_PATH` + `fullReset` already guarantee a clean start, and when there is no
app at all.

Measured while validating this against a stock Settings app: `appium:forceAppLaunch`
and `appium:shouldTerminateApp` do **not** achieve it — they bring the existing
task forward, leaving the app exactly where it was. The explicit relaunch does.

## Running on more than one device

Workers default to 1 because a device is exclusive for the life of a session.
With no `DEVICE_UDID` pinned, the grid gives each worker a different free
handset:

```bash
WORKERS=4 npm test                   # four devices at once
PLATFORM=android,ios npm test        # both platforms, as separate projects
```

Do not set `WORKERS` above the number of free devices on the platform — the
extra workers just queue for a slot.

## Reporting

Each test names its session and reports its own verdict, so the dashboard shows
a result rather than a bare "completed" — the grid cannot infer one, because at
the WebDriver layer a passing suite and a failing one are the same command
stream. Failures also attach a device screenshot to the Playwright HTML report.

Set `RA_TESTSUITE` to group a run, and `RA_RELEASE_ID` to tag it with a build.
`RA_NETWORK_CAPTURE=true` records the request waterfall into the session's
Network tab — off by default because capture costs disk, and it only applies to
webviews and mobile browsers.

## Editor support

Open **this folder**, not the repository root: the Playwright extension binds to
the folder it is opened in, and this template carries its own `node_modules` and
runner config. `.vscode/` wires up the Testing view (over the specs `bddgen`
generates into `.features-gen/`), Cucumber language support for `.feature` files,
and two debug configurations. The green run arrows start a real device session,
exactly as a CLI run does.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `401 Unauthorized` | `AUTH_TOKEN` missing or wrong. The run line prints `NO AUTH_TOKEN` when it is unset. |
| "No nodes support the capabilities in the request" | A `DEVICE_UDID` the grid does not have, or no free device on that platform. |
| `App with bundle identifier '…' unknown` | `BUNDLE_ID` / `APP_PACKAGE` names an app that is not installed. Set `APP_PATH` to install it. |
| iOS session never starts | iOS 17+/18+ automation-runner build. Install a runner once and set `USE_PREINSTALLED_RUNNER=true`. |
| `WDA xcuitest runner exited early` / `serves no tunnel for udid` | That iOS device has no active tunnel on the host, so the runner cannot start — a device-side condition, not your test. Pin `DEVICE_UDID` to a healthy handset, and tell whoever runs the grid. |
| `getByText` finds nothing that is plainly on screen | A hierarchy deeper than the snapshot limit. This template raises it to 62; raise it further if you nest deeper. |
| Every app assertion fails, and the tree shows `SBCoverSheetWindow` | The iOS device is on its lock screen, so no app is in the foreground. Unlock it (the device smoke still passes — the session is healthy). |
| Tests pass but the dashboard has no record | The suite ran against the wrong endpoint. Check the target line each run prints. |

More, including the connection recipe for suites you already have:
[**Connecting to the grid**](../docs/connecting-to-the-grid.md).
