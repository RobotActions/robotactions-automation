/**
 * The test object every spec and step definition imports.
 *
 * Three things merged into one `test`:
 *   - Appwright's own — its `device` fixture, driven by the `robotactions`
 *     provider from the RobotActions fork of Appwright (github:RobotActions/
 *     appwright); the grid session, name/verdict sync and video attachment
 *     all live there,
 *   - playwright-bdd's, so Gherkin steps get the same fixtures,
 *   - this template's `remote` (TV buttons) and a `device` wrapper that
 *     attaches a screenshot when a test fails.
 *
 *     await device.getByText('Sign in').tap();
 *     await expect(device.getById('welcome')).toBeVisible();
 *
 * Fixtures:
 *   `device`         — an Appwright `Device` on a grid session
 *   `remote`         — hardware buttons for that same session (required on tvOS)
 *   `deviceProvider` — the session owner: `sessionId`, and `client` for raw WebDriver
 *   `gridPlatform`   — this template's platform name (`androidtv`, `tvos`, …)
 */
import { mergeTests } from '@playwright/test';
import { test as bdd, createBdd } from 'playwright-bdd';
import { test as appwright, type ActionOptions, type AppwrightLocator } from 'appwright';
import { createRemote, type Remote, type RemoteSession } from '../remote';
import { defaultPlatform, type GridOptions } from '../config';

export const test = mergeTests(appwright, bdd).extend<GridOptions & { remote: Remote }>({
    // Set per project by config.ts → gridProject(); the default lets a spec run
    // outside the project list (e.g. from the VS Code Testing view).
    gridPlatform: [defaultPlatform(), { option: true }],

    /**
     * Appwright's `device`, plus evidence on failure.
     *
     * Runs inside the base fixture: the screenshot is taken after the test
     * body and before Appwright closes the session and reports its verdict, so
     * the session is still alive for it. The dashboard name gets the platform
     * suffix here for the same reason — Appwright sends the bare title.
     */
    device: async ({ device, deviceProvider, gridPlatform }, use, testInfo) => {
        await deviceProvider.syncTestDetails?.({
            name: `${testInfo.title} [${gridPlatform}]`,
            testId: testInfo.testId,
        });

        await use(device);

        if (testInfo.status !== testInfo.expectedStatus) {
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
    },

    /**
     * Hardware buttons for the session `device` is driving.
     *
     * Required on tvOS, where there is no touchscreen: you move the focus ring
     * with the Siri Remote and then select, so taps have nothing to act on.
     * Depends on `device` so the session exists before a button is pressed.
     */
    remote: async ({ deviceProvider, device, gridPlatform }, use) => {
        void device;
        await use(createRemote(deviceProvider as RemoteSession, gridPlatform));
    },
});

/**
 * Playwright's `expect`, plus Appwright's `toBeVisible` for its locators.
 *
 * Appwright exports an `expect` of its own, bound to its own test object; this
 * is the same matcher over the merged one.
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
