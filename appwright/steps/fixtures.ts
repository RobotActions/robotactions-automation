/**
 * The test object every spec and step definition imports.
 *
 * It is `playwright-bdd`'s test (itself Playwright's, extended) plus the grid
 * fixtures. BDD steps and plain specs therefore share one device lifecycle, and
 * the Appwright API is the real thing rather than a wrapper:
 *
 *     await device.getByText('Sign in').tap();
 *     await expect(device.getById('welcome')).toBeVisible();
 *
 * Fixtures:
 *   `device`         — an Appwright `Device` on a grid session
 *   `remote`         — hardware buttons for that same session (required on tvOS)
 *   `deviceProvider` — the session owner, if a test needs the grid session id
 */
import { test as base, createBdd } from 'playwright-bdd';
import type { ActionOptions, AppwrightLocator, Device } from 'appwright';
import { RobotActionsDeviceProvider } from '../providers/robotactions';
import { createRemote, type Remote } from '../remote';
import {
    appActivity, appBundleId, buildPath, defaultPlatform, deviceUdid, expectTimeout,
    type GridDeviceOptions,
} from '../config';

type GridFixtures = {
    deviceProvider: RobotActionsDeviceProvider;
    device: Device;
    remote: Remote;
};

export const test = base.extend<GridDeviceOptions & GridFixtures>({
    // Options — overridable per project in playwright.config.ts, and per file
    // with `test.use({ platform: 'ios' })`. Defaults come from the environment
    // so a run is configured in one place (.env) rather than in each spec.
    platform: [defaultPlatform(), { option: true }],
    udid: [deviceUdid(), { option: true }],
    buildPath: [buildPath(), { option: true }],
    appBundleId: [appBundleId(), { option: true }],
    appActivity: [appActivity(), { option: true }],
    expectTimeout: [expectTimeout(), { option: true }],

    /**
     * Owns the grid session.
     *
     * Separate from `device` so that `device` and `remote` are two views of one
     * session rather than two sessions: both depend on this, and Playwright
     * builds it once per test.
     */
    deviceProvider: async (
        { platform, udid, buildPath: build, appBundleId: bundleId, appActivity: activity, expectTimeout: timeout },
        use,
        testInfo,
    ) => {
        await use(new RobotActionsDeviceProvider({
            platform,
            udid,
            buildPath: build,
            appBundleId: bundleId,
            appActivity: activity,
            expectTimeout: timeout,
            testName: testInfo.title,
            // Playwright's own stable per-test id — same value on every run, so
            // the dashboard can trend one test rather than seeing a new one each
            // time.
            testId: testInfo.testId,
        }));
    },

    /**
     * One Appium session per test, on a device the grid hands out.
     *
     * Per-test rather than per-worker: a session inherits whatever the previous
     * test left on screen, and reusing one across tests makes failures depend on
     * execution order. The cost is session setup per test, which is why
     * `testTimeout()` is generous.
     */
    device: async ({ deviceProvider, platform }, use, testInfo) => {
        const device = await deviceProvider.getDevice();

        // Surfaces the grid session in the HTML report, so a failed test links
        // back to the recording, logs and video the dashboard holds.
        testInfo.annotations.push({ type: 'sessionId', description: deviceProvider.sessionId });
        await deviceProvider.syncTestDetails({ name: `${testInfo.title} [${platform}]` });

        await use(device);

        // Teardown order is deliberate: evidence and verdict both need a live
        // session, so `device.close()` goes last.
        const failed = testInfo.status !== testInfo.expectedStatus;

        if (failed) {
            try {
                const screenshot = await device.screenshot();
                await testInfo.attach('device-screenshot', {
                    body: Buffer.from(screenshot, 'base64'),
                    contentType: 'image/png',
                });
            } catch {
                /* a dead session cannot be screenshotted — keep the real failure */
            }
        }

        await deviceProvider.syncTestDetails({
            status: testInfo.status,
            reason: testInfo.error?.message,
        });

        await device.close();
    },

    /**
     * Hardware buttons for the session `device` is driving.
     *
     * Required on tvOS, where there is no touchscreen: you move the focus ring
     * with the Siri Remote and then select, so taps have nothing to act on.
     * Depends on `device` so the session exists before a button is pressed.
     */
    remote: async ({ deviceProvider, device }, use) => {
        void device;
        await use(createRemote(deviceProvider));
    },
});

/**
 * Playwright's `expect`, plus Appwright's `toBeVisible` for its locators.
 *
 * Appwright exports an `expect` of its own, but it is bound to Appwright's test
 * object (the one whose fixtures assume its built-in providers). This is the
 * same matcher over ours.
 */
export const expect = test.expect.extend({
    toBeVisible: async (locator: AppwrightLocator, options?: ActionOptions) => {
        const isVisible = await locator.isVisible(options);
        return {
            message: () => (isVisible ? '' : 'Element was not found on the screen'),
            pass: isVisible,
            name: 'toBeVisible',
            expected: true,
            actual: isVisible,
        };
    },
});

export const { Given, When, Then, Before, After } = createBdd(test);
