# Appium + WebdriverIO + Cucumber Template

Mobile BDD test automation using WebdriverIO, Appium, and Cucumber. Supports Android and iOS devices via a shared step-definition and page-object layer.

> **Running this against a RobotActions grid?** You need two things from your account: the
> **grid URL** and an **auth token**. Put them in `.env` (see `.env.example`) — never in a
> committed file. Connection details, auth, reporting results back to the dashboard and a
> troubleshooting table live in
> [**docs/connecting-to-the-grid.md**](../docs/connecting-to-the-grid.md).
>
> These tests need a real device, so unlike the browser templates there is no local
> fallback — a grid (or a locally attached device with Appium running) is required.


## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure your device
cp .env.example .env
# Edit .env with your device UDID, app package / bundle ID, and Appium server address

# 3. Start an Appium server (if not using a remote grid)
npx appium

# 4. Run BDD tests (Cucumber)
npm test

# 5. Run regular Mocha tests
npm run test:regular
```

## Project Structure

```
appium-js/
├── features/                    # Cucumber feature files
│   └── login.feature
├── pageobjects/                 # Mobile page object models
│   ├── Page.ts                  # Base page with mobile helpers (tap, swipe, typeText)
│   └── LoginPage.ts             # Login screen page object
├── step-definitions/            # Cucumber glue code
│   ├── hooks.ts                 # Before/After hooks, app launch guard
│   └── login.steps.ts           # Login step definitions
├── test/
│   └── specs/
│       └── login.spec.ts        # Regular Mocha tests
├── wdio.conf.ts                 # Primary Cucumber/BDD config
├── wdio.mocha.conf.ts           # Secondary Mocha config
├── tsconfig.json
├── .env.example
└── package.json
```

## Configuration

All device and server settings are controlled via environment variables (set in `.env`).

| Variable        | Default              | Description                                      |
|-----------------|----------------------|--------------------------------------------------|
| `PLATFORM`      | `android`            | Target platform: `android` or `ios`              |
| `DEVICE_UDID`   | `emulator-5554`      | ADB serial (Android) or device UDID (iOS)        |
| `APP_PACKAGE`   | `com.example.app`    | Android app package name                         |
| `APP_ACTIVITY`  | `.MainActivity`      | Android launch activity                          |
| `BUNDLE_ID`     | `com.example.app`    | iOS app bundle ID                                |
| `APP_PATH`      | _(empty)_            | Path or URL to .apk/.ipa — auto-installs before tests |
| `GRID_HOST`     | `localhost:5555`     | Grid auth/capture proxy `host:port`. A standalone Appium server instead listens on `:4723`. |
| `AUTH_TOKEN`    | _(empty)_            | Bearer token for authenticated grid endpoints    |

## Commands

| Command              | Description                          |
|----------------------|--------------------------------------|
| `npm test`           | Run all Cucumber BDD feature files   |
| `npm run test:regular` | Run Mocha specs in `test/specs/`   |
| `npm run test:debug` | Run with Node inspector attached     |

## Android Setup

1. Start an emulator or connect a physical device
2. Verify `adb devices` shows your device
3. Set `DEVICE_UDID` to the value shown by `adb devices`
4. Set `APP_PACKAGE` and `APP_ACTIVITY` for your target app

```env
PLATFORM=android
DEVICE_UDID=emulator-5554
APP_PACKAGE=com.mycompany.myapp
APP_ACTIVITY=.ui.activities.SplashActivity
GRID_HOST=localhost:5555
```

## iOS Setup

1. Connect a device or start a simulator
2. Ensure WebDriverAgent is built and signed for your team
3. Set `PLATFORM=ios`, `DEVICE_UDID`, and `BUNDLE_ID`

```env
PLATFORM=ios
DEVICE_UDID=00008101-001234567890001E
BUNDLE_ID=com.mycompany.myapp
GRID_HOST=localhost:5555
```

## Remote Grid (RemoteDeviceServer)

Point `GRID_HOST` at your grid and supply `AUTH_TOKEN`:

```env
GRID_HOST=my-grid.example.com:5555
AUTH_TOKEN=<your-grid-token>
```

## Selectors

Page objects use Appium accessibility IDs (`~id`) for cross-platform portability:

```typescript
get usernameInput() { return $('~username'); }
```

- **Android**: set `contentDescription` on the view
- **iOS**: set `accessibilityIdentifier` on the UIView

For platform-specific selectors, use `driver.isAndroid` / `driver.isIOS` inside the page object.

## App Install & Upload

### Auto-install via config

Set `APP_PATH` in `.env` to auto-install the app before test execution:

```env
# Local file
APP_PATH=/path/to/app-debug.apk

# Remote URL (Appium downloads it)
APP_PATH=https://builds.example.com/latest/app-debug.apk
```

### Programmatic install in tests

The base `Page` class provides app lifecycle helpers:

```typescript
import Page from '../pageobjects/Page';

const page = new Page();

// Install app from path or URL
await page.installApp('/sdcard/Download/app.apk');

// Check if installed
const installed = await page.isAppInstalled('com.example.app');

// Launch / terminate
await page.launchApp('com.example.app');
await page.terminateApp('com.example.app');

// Remove app
await page.removeApp('com.example.app');

// Push file to device (Android)
await page.pushFile('/sdcard/Download/test-data.json', base64Content);

// Pull file from device
const content = await page.pullFile('/sdcard/Download/results.json');
```
