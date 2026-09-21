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
anything. Point `APP_ID` at a build in your App Library to run the app suite —
or try the [Wikipedia sample](#try-it-with-the-wikipedia-sample) first.

| Command | Runs |
|---|---|
| `npm test` | BDD features, `@app` excluded — green with no app |
| `npm run test:app` | The `@app` features (needs `APP_ID` or `APP_PATH`) |
| `npm run test:settings` | The `@settings` walkthrough — a real app, no build needed |
| `PLATFORM=tvos npm test` | Apple TV coverage, including the Siri Remote |
| `PLATFORM=androidtv npm test` | Android TV / Google TV / Chromecast coverage |
| `npm run test:regular` | Regular non-BDD specs under `tests/` |
| `npm run test:tagged @smoke` | Features matching a tag |
| `npm run test:debug` | Playwright inspector |
| `npm run report` | Open the HTML report |

## How this connects

Upstream Appwright ships four device providers — `browserstack`, `lambdatest`,
`emulator` and `local-device` — chosen by a hardcoded `switch`, so a grid cannot
be named in `device.provider`. This template depends on the RobotActions fork
([github:RobotActions/appwright](https://github.com/RobotActions/appwright)),
which adds a fifth:

```ts
device: { provider: 'robotactions', udid, deviceClass, testSuite, capabilities }
```

That is the whole integration. `config.ts` turns the environment into one
Playwright project per platform (`gridProject()`), and everything else is
Appwright's own: its `defineConfig` (a global setup that checks the grid
connection and build path before any worker starts, plus a reporter that attaches
each session's recording to the HTML report), its `test`/`device` fixtures, and
its `Device` API. `steps/fixtures.ts` merges that `test` with playwright-bdd's and
adds two things — a `remote` fixture for the TV platforms and a screenshot on
failure.

The session itself is ordinary Appium — the same W3C capabilities every other
template in this repo sends — so the grid needs nothing special either. Three
consequences worth knowing:

- **`device.setMockCameraView()` is a no-op.** Appwright implements it with
  BrowserStack's and LambdaTest's own image-injection executors. Everything else
  on `Device` is plain WebDriver and behaves identically.
- **The runner is Playwright's, driven directly** — `npx playwright test`, not
  `npx appwright test`. Appwright's CLI is a shim over the former with
  `appwright.config.ts`, and the config here is `playwright.config.ts` because
  `bddgen` and the VS Code Playwright extension both discover `playwright*.config.ts`
  and neither finds anything under the other name.
- **`@playwright/test` stays below 1.60.** Newer versions reject Appwright's
  `use.device` config key (it collides with the `device` fixture); the fork pins
  the range and so does `package.json`.

## Try it with the Wikipedia sample

The same app and scenario as Appwright's own example, installed from your App
Library rather than a local file. Import it once — the library pulls the APK
straight from the Appwright repo, nothing is hosted by you:

```sh
curl -X POST https://<rds-host>/apps/import-url \
     -H "Authorization: Bearer $AUTH_TOKEN" -H "Content-Type: application/json" \
     -d '{"url":"https://github.com/empirical-run/appwright/raw/main/example/builds/wikipedia.apk"}'
# → { "id": "8eb08fc5-…", "fileName": "wikipedia.apk", "expiresAt": "…" }
```

Then, in `.env`:

```sh
APP_ID=<the id>
APP_PACKAGE=org.wikipedia
PLATFORM=android
```

`npm run test:app` installs Wikipedia on a real Android device, skips the
onboarding, searches for "playwright", opens the article and asserts on it
(`features/wikipedia.feature`). It is skipped unless `APP_PACKAGE` is
`org.wikipedia`, so switching to your own build never runs it by accident.
Android only: Appwright ships the iOS build for the Simulator, which a real
iPhone cannot run.

Library uploads expire (48 h by default), so a CI job should import the build
and use the id it gets back, rather than pinning one.

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

## TV platforms (Apple TV and Android TV)

Two set-top platforms are supported:

| `PLATFORM` | Devices | Driver |
|---|---|---|
| `tvos` | Apple TV | XCUITest, as `ios` |
| `androidtv` | Android TV, Google TV, Chromecast | UiAutomator2, as `android` |

Each reuses its phone counterpart's driver, so **locators, assertions and
screenshots are unchanged** — `getByText`, `getById`, `getByXpath` and
`expect(...).toBeVisible()` all behave the same, and `features/device-smoke.feature`
runs against a TV as-is.

What changes is input. A TV has no touchscreen, so there is nothing to tap: you
move a focus ring with the remote and press Select on whatever is focused.
Appwright's API is built around taps and gestures and has no key command, so this
template adds a `remote` fixture:

```ts
When('I open Settings', async ({ remote, device }) => {
    await remote.focusTo(() => device.getByText('Settings').isVisible({ timeout: 1500 }));
    await remote.select();
});
```

`remote` gives you `up/down/left/right`, `select`, `back`, `home`, `playPause`,
`press(button)`, and `focusTo(predicate)` — which presses a direction until the
predicate holds, the TV equivalent of the scroll loop the touch platforms need. It
shares the session with `device`, so the two are one session, not two.

**The button names are platform-neutral, and that is the point.** The two
platforms agree on nothing at the wire level, so one vocabulary is what lets a
single feature file drive both:

| Button | Apple TV | Android TV |
|---|---|---|
| `down` | `mobile: pressButton` `Down` | keycode 20 (`DPAD_DOWN`) |
| `select` | `mobile: pressButton` `Select` | keycode 23 (`DPAD_CENTER`) |
| `back` | `mobile: pressButton` `Menu` | keycode 4 (`BACK`) |

Note `back` rather than `menu`: Apple labels that button Menu and Android labels
it Back, so the name describes the intent instead.

**Picking a TV.** An `androidtv` run needs no `DEVICE_UDID` — an Android TV
reports `platformName: Android` like every phone, so the template sends
`appium:deviceClass: TV` and the grid hands over any free TV. Without that, an
`androidtv` run would cheerfully land on a phone.

Two quirks worth knowing:

- **`device.getPlatform()` collapses the TV platforms.** Appwright models only
  Android and iOS (`isAndroid ? ANDROID : IOS`), so an Apple TV reports as `ios`
  and an Android TV as `android`. The grid still receives the real
  `platformName`; only Appwright's own view of it collapses.
- **`tap()`, `scroll()` and `fill()` are not useful on a TV** — they resolve to
  touch gestures. Use the remote.
- **The grid's verdict inference is disabled on tvOS.** It reads the device log to
  decide how a run went, an Apple TV serves none, and the resulting `getLog
  failed: No logs currently available` marked passing runs as failed in the
  dashboard. The template therefore sends `ra:autoFailDetect: false` for tvOS
  only; the explicit `ra:job-result` this template reports is authoritative
  anyway. Override with `RA_AUTO_FAIL_DETECT=true`.

Both TV platforms are recorded under their own `platform` in the dashboard
(`tvos`, `androidtv`), so you can filter runs by platform there as usual.

## Configuration

Everything comes from the environment, with `.env` as the fallback — see
[`.env.example`](.env.example) for the annotated list. `config.ts` is the only
file that reads it.

| Variable | Meaning |
|---|---|
| `GRID_HOST` / `GRID_URL` | Grid endpoint, `host:port`. `:5555` locally, `443` hosted. |
| `AUTH_TOKEN` | Grid bearer token. Sent as an `Authorization` header on every request. |
| `PLATFORM` | `android`, `ios`, `tvos`, `androidtv`, or a combination — one Playwright project each. |
| `DEVICE_UDID` | Pin one device. Normally leave unset and let the grid choose. |
| `DEVICE_CLASS` | Narrow the grid's choice by class (`TV`, `Phone`, `AppleTV`…). Set automatically for `androidtv`. |
| `APP_ID` | A build in your RobotActions **App Library**, by upload id (dashboard → Apps, `POST /apps/import-url`, or the `app_upload` MCP tool). The grid fetches it with this run's token — nothing to host. Leave unset (and `APP_PATH` unset) for a device-level session. |
| `APP_PATH` | The older form: an https URL the grid can download, **or a path on the grid host**. `APP_ID` wins when both are set. |
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
| `WDA did not become ready within 90000ms` | WebDriverAgent could not start on that device. Nothing to do with your test or capabilities — the request reached the node and was accepted. Try another device and tell whoever runs the grid. |
| `WDA xcuitest runner exited early` / `serves no tunnel for udid` | That iOS device has no active tunnel on the host, so the runner cannot start — a device-side condition, not your test. Pin `DEVICE_UDID` to a healthy handset, and tell whoever runs the grid. |
| `getByText` finds nothing that is plainly on screen | A hierarchy deeper than the snapshot limit. This template raises it to 62; raise it further if you nest deeper. |
| Every app assertion fails, and the tree shows `SBCoverSheetWindow` | The iOS device is on its lock screen, so no app is in the foreground. Unlock it (the device smoke still passes — the session is healthy). |
| Tests pass but the dashboard has no record | The suite ran against the wrong endpoint. Check the target line each run prints. |

More, including the connection recipe for suites you already have:
[**Connecting to the grid**](../docs/connecting-to-the-grid.md).
