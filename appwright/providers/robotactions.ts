/**
 * A RobotActions grid device provider for Appwright.
 *
 * ## Why this file exists
 *
 * Appwright ships four providers — `browserstack`, `lambdatest`, `emulator` and
 * `local-device` — and picks between them with a hardcoded `switch` in
 * `createDeviceProvider()`. There is no registry to add a fifth to, so a grid
 * cannot be named in `device.provider`, and the built-in `local-device` is no
 * help: it spawns its own Appium on `localhost:4723` and shells out to `adb` /
 * Xcode on the machine running the tests.
 *
 * What Appwright *does* export is `Device` — the class behind every
 * `device.getByText(...).tap()` call — and it takes a plain WebDriver client in
 * its constructor. So the integration is not a fork or a patch: build the
 * session against the grid ourselves, wrap it in Appwright's `Device`, and hand
 * that to the tests through a fixture. The whole Appwright API works unchanged,
 * because it is the real `Device`.
 *
 * The session itself is ordinary Appium — the same W3C capabilities every other
 * template in this repo sends — so the grid needs nothing special either.
 *
 * ## What is not available through here
 *
 * `device.setMockCameraView()` is a no-op: Appwright implements it with
 * BrowserStack's and LambdaTest's own image-injection executors and branches on
 * the provider name. Everything else on `Device` is plain WebDriver and behaves
 * identically.
 */
import { Device, Platform, type DeviceProvider } from 'appwright';
import type { Client as WebDriverClient } from 'webdriver';
import {
    appActivity, appBundleId, autoFailDetect, buildPath, deviceUdid, expectTimeout, fullReset, gridEndpoint,
    iosRunnerBundleId, iosRunnerUrl, isApple, networkCapture, releaseId, suiteName,
    usePreinstalledRunner, type PlatformName,
} from '../config';

/**
 * Passed to `Device` and used by Appwright only to gate provider-specific
 * behaviour (emulator clipboard shortcuts, BrowserStack/LambdaTest camera
 * injection). Any value outside that set — this one included — takes the
 * plain-WebDriver path, which is what a real device on the grid wants.
 */
const PROVIDER_NAME = 'robotactions';

/** Appium's own cap for how deep an iOS page-source snapshot goes. */
const SNAPSHOT_MAX_DEPTH = 62;

export interface GridDeviceRequest {
    platform: PlatformName;
    udid?: string;
    buildPath?: string;
    appBundleId?: string;
    appActivity?: string;
    expectTimeout?: number;
    /** Names the session in the dashboard. Usually the test title. */
    testName?: string;
    /**
     * Stable identity for this test, so the dashboard can trend the same test
     * across runs rather than treating every session as a new one.
     */
    testId?: string;
}

/** Capability map — flat W3C, as the grid and Appium both expect. */
type Capabilities = Record<string, unknown>;

export class RobotActionsDeviceProvider implements DeviceProvider {
    /** Set once the session exists; undefined if creation failed. */
    sessionId?: string;

    private client?: WebDriverClient;
    private readonly request: GridDeviceRequest;

    constructor(request: GridDeviceRequest) {
        this.request = request;
    }

    /**
     * Requested platform as Appwright's enum.
     *
     * Appwright only models Android and iOS — `getPlatform()` is literally
     * `isAndroid ? ANDROID : IOS` — so an Apple TV reports itself as iOS. That is
     * the right answer for everything the enum drives (XCUITest selector syntax,
     * predicate strings, bundle-id handling), and the real platform name sent to
     * the grid comes from `platformName()` below instead.
     */
    private get platform(): Platform {
        return isApple(this.request.platform) ? Platform.IOS : Platform.ANDROID;
    }

    /** The `platformName` capability the grid matches against. */
    private platformName(): string {
        switch (this.request.platform) {
            case 'tvos': return 'tvOS';
            case 'ios': return 'iOS';
            default: return 'Android';
        }
    }

    async getDevice(): Promise<Device> {
        // Keep the token out of the logs.
        //
        // It rides the URL path, and `@wdio/utils` logs the endpoint it is about
        // to connect to — path included — at info level, which would print the
        // bearer token in full on every run and bake it into CI logs. The
        // `logLevel` option below does not cover this: `newSession` applies it to
        // the `webdriver` logger only, while that line belongs to `@wdio/utils`.
        //
        // Each logger reads its level when it is created, and the `@wdio/utils`
        // logger is created while `webdriver` is being imported — so this has to
        // be set before the import below, not after. An explicit WDIO_LOG_LEVEL
        // is honoured, so raising it to debug still works (and will show the
        // token, which is the point of asking for debug).
        process.env.WDIO_LOG_LEVEL ??= 'warn';

        // `webdriver` is imported dynamically for the same reason Appwright does
        // it: the package is ESM-only, so a static import would force this
        // CommonJS module to be ESM too.
        const WebDriver = (await import('webdriver')).default;
        const grid = gridEndpoint();

        const client = await WebDriver.newSession({
            protocol: grid.protocol,
            hostname: grid.hostname,
            port: grid.port,
            path: grid.path,
            logLevel: 'warn',
            // Session creation on a real handset is slow — the app may need
            // installing and, on iOS, the automation runner has to come up.
            connectionRetryTimeout: 300_000,
            connectionRetryCount: 2,
            capabilities: this.capabilities() as never,
        });

        this.client = client;
        this.sessionId = client.sessionId;

        const device = new Device(
            client,
            this.request.appBundleId ?? appBundleId(),
            { expectTimeout: this.request.expectTimeout ?? expectTimeout() },
            PROVIDER_NAME,
        );

        await this.startFromFirstScreen(device);
        return device;
    }

    /**
     * Put the app on its first screen before the test runs.
     *
     * A new session is not a new app. Appium attaches to the app that is already
     * running, and with `noReset` the process keeps its task stack — so a test
     * opens three screens deep because the *previous* test navigated there, and
     * tests start passing or failing on execution order. Per-test sessions alone
     * do not prevent this; the state lives in the app, not the session.
     *
     * Measured on a stock Settings app: relaunching resets it to its root screen,
     * whereas `appium:forceAppLaunch` / `appium:shouldTerminateApp` did not (they
     * bring the existing task forward, leaving it exactly where it was). Hence
     * the explicit terminate + activate.
     *
     * Skipped when a reinstall already guarantees a clean start, and when there is
     * no app at all — a device-level session has nothing to relaunch.
     */
    private async startFromFirstScreen(device: Device): Promise<void> {
        const bundleId = this.request.appBundleId ?? appBundleId();
        const app = this.request.buildPath ?? buildPath();
        if (!bundleId || (app && fullReset())) return;

        // A not-running app is the normal case on the first test of a run, and
        // terminating one is not an error worth failing a test over. Anything
        // wrong with the app itself surfaces on activate below.
        try {
            await device.terminateApp(bundleId);
        } catch {
            /* already stopped */
        }
        await device.activateApp(bundleId);
    }

    private capabilities(): Capabilities {
        const isAndroid = this.platform === Platform.ANDROID;
        const app = this.request.buildPath ?? buildPath();
        const bundleId = this.request.appBundleId ?? appBundleId();
        const udid = this.request.udid ?? deviceUdid();

        return {
            platformName: this.platformName(),
            'appium:automationName': isAndroid ? 'UiAutomator2' : 'XCUITest',
            'appium:newCommandTimeout': 120,
            // Appwright's locators walk the UI tree, and iOS truncates a
            // snapshot at depth 50 by default — deep hierarchies then look
            // empty and `getByText` finds nothing that is plainly on screen.
            // Every Appwright provider raises this; so do we.
            'appium:settings[snapshotMaxDepth]': SNAPSHOT_MAX_DEPTH,
            ...this.deviceCaps(udid),
            ...this.appCaps(app, bundleId, isAndroid),
            ...(isAndroid ? {} : this.iosRunnerCaps()),
            ...this.reportingCaps(),
        };
    }

    /**
     * Pinning a device sends `udid` and nothing else.
     *
     * `deviceName` must not carry the UDID: the grid matches it against the
     * node's stereotype, which holds the model name (`SM-N986W`), so a UDID
     * there can never match and the request is refused with "No nodes support
     * the capabilities in the request" — even when the UDID is perfectly valid.
     */
    private deviceCaps(udid: string | undefined): Capabilities {
        return udid ? { 'appium:udid': udid } : {};
    }

    /**
     * App caps, or none.
     *
     * With no `APP_PATH` the session still starts — a device-level session with
     * no app under test, which is enough to prove the automation stack is
     * healthy and is what `features/device-smoke.feature` runs against. Naming
     * an app that is not installed fails the session instead, so nothing is
     * sent unless it was asked for.
     */
    private appCaps(app: string | undefined, bundleId: string | undefined, isAndroid: boolean): Capabilities {
        if (!app && !bundleId) {
            return { 'appium:noReset': true };
        }

        const caps: Capabilities = {
            'appium:autoAcceptAlerts': true,
            ...(isAndroid ? { 'appium:autoGrantPermissions': true } : {}),
        };

        if (app) {
            // A path or an https URL both work — the grid fetches a URL and
            // installs it before the session starts. There is no upload step.
            caps['appium:app'] = app;
            caps['appium:fullReset'] = fullReset();
            caps['appium:noReset'] = !fullReset();
        } else {
            // Launching an already-installed app: leave its data alone.
            caps['appium:noReset'] = true;
        }

        if (bundleId) {
            if (isAndroid) {
                caps['appium:appPackage'] = bundleId;
                const activity = this.request.appActivity ?? appActivity();
                if (activity) caps['appium:appActivity'] = activity;
            } else {
                caps['appium:bundleId'] = bundleId;
            }
        }

        return caps;
    }

    /**
     * iOS automation-runner handling.
     *
     * Building a runner at session start is unreliable on iOS 17+/18+. A runner
     * already installed on the device avoids the build entirely; alternatively
     * point at one you launched yourself and Appium neither builds nor manages
     * its own connection.
     */
    private iosRunnerCaps(): Capabilities {
        return {
            'appium:wdaLaunchTimeout': 120_000,
            'appium:wdaConnectionTimeout': 120_000,
            ...(usePreinstalledRunner()
                ? {
                      'appium:usePreinstalledWDA': true,
                      'appium:updatedWDABundleId': iosRunnerBundleId(),
                  }
                : {}),
            ...(iosRunnerUrl() ? { 'appium:webDriverAgentUrl': iosRunnerUrl() } : {}),
        };
    }

    /**
     * Vendor-prefixed `ra:` caps the grid strips before forwarding to Appium,
     * then persists against the session so the dashboard can group runs.
     */
    private reportingCaps(): Capabilities {
        return {
            ...(suiteName() ? { 'ra:testsuite': suiteName() } : {}),
            ...(releaseId() ? { 'ra:releaseId': releaseId() } : {}),
            ...(this.request.testName ? { 'ra:testName': this.request.testName.slice(0, 180) } : {}),
            ...(networkCapture() ? { 'ra:networkCapture': true } : {}),
            // Off for tvOS: the grid's verdict inference reads the device log,
            // an Apple TV serves none, and the resulting "getLog failed" marks a
            // passing run as failed. syncTestDetails() reports the real verdict.
            ...(autoFailDetect(this.request.platform) ? {} : { 'ra:autoFailDetect': false }),
        };
    }

    /**
     * Name the session and report its verdict to the dashboard.
     *
     * The grid cannot infer a verdict on its own: at the WebDriver layer a
     * passing suite and a failing one are the same command stream, so without
     * this the session lands with no result and a suite that silently stopped
     * asserting still looks healthy.
     *
     * **Call order matters.** These are magic scripts executed *in the session*,
     * so they have to run before `device.close()` deletes it. (Appwright's own
     * fixture reports after closing, which works for BrowserStack because that
     * is a REST call to their API — it would be a no-op here.)
     *
     * Best-effort throughout: a reporting failure must never turn a passing
     * test red, and the session may already be gone if the device dropped.
     */
    async syncTestDetails(details: { status?: string; reason?: string; name?: string }): Promise<void> {
        if (!this.client) return;

        if (details.name) {
            await this.execute(`ra:job-name=${details.name.slice(0, 180)}`);
            // Sent as a script rather than a capability because that is the form
            // the other templates use and the grid is known to accept.
            if (this.request.testId) {
                await this.execute(`ra:test-id=${this.request.testId}`);
            }
        }

        if (!details.status || details.status === 'skipped') return;

        if (details.status === 'passed') {
            await this.execute('ra:job-result=passed');
        } else {
            await this.execute(
                failureReason(details.reason)
                    ? `ra:job-result=failed:${failureReason(details.reason)}`
                    : 'ra:job-result=failed',
            );
        }
    }

    private async execute(script: string): Promise<void> {
        try {
            await this.client?.executeScript(script, []);
        } catch {
            /* best-effort — never fail a test over reporting */
        }
    }

    /**
     * Press a hardware button on the device.
     *
     * This exists because an Apple TV has no touchscreen: you move the focus
     * ring with the Siri Remote and then select, so `tap()` — which is what most
     * of Appwright's API is built on — has nothing to act on. Appwright's `Device`
     * keeps its WebDriver client private and exposes no button command, hence
     * going through the provider, which owns the same session.
     *
     * Valid tvOS names: Home, Menu, Up, Down, Left, Right, Select, Play/Pause.
     * On iOS the XCUITest driver accepts home, volumeUp and volumeDown.
     */
    async pressButton(name: string): Promise<void> {
        if (!this.client) {
            throw new Error('pressButton called before the session was created.');
        }
        await this.client.executeScript('mobile: pressButton', [{ name }]);
    }
}

/**
 * First readable line of a Playwright error, for the dashboard's one-line
 * failure reason. Playwright messages carry a stack and ANSI colour codes, both
 * of which make the reason unreadable in a table cell.
 */
function failureReason(message: string | undefined): string {
    if (!message) return '';
    const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
    return message.replace(ansi, '').trim().split('\n')[0].slice(0, 180);
}
