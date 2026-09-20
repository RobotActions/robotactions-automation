import { ScrollDirection, type AppwrightLocator, type Device } from 'appwright';
import { Before, Given, When, Then, expect, test } from './fixtures';
import { settingsWalkthrough } from '../config';

/**
 * Generic app steps, demonstrated against the preinstalled Settings app.
 *
 * Nothing here names Settings except `the Settings app is open` — the labels and
 * identifiers live in the feature files, so these steps are the ones to reuse
 * for your own app.
 *
 * Read-only by design: they navigate and assert, and never change a setting.
 */

/** Bundle ids of the preinstalled Settings app, per platform. */
const SETTINGS_APP = {
    android: 'com.android.settings',
    ios: 'com.apple.Preferences',
} as const;

/** How many scroll gestures `I scroll until …` will try before giving up. */
const MAX_SCROLLS = 8;

/** Short probe, so a scroll loop does not wait out the full expect timeout. */
const PROBE_TIMEOUT = 2_000;

Before('@settings', async () => {
    test.skip(
        !settingsWalkthrough(),
        'Stock-OS labels. Set RUN_SETTINGS_WALKTHROUGH=true, ideally with DEVICE_UDID pinned to a stock device.',
    );
});

// The two feature files are platform-specific, so each one is skipped unless the
// project under test is that platform. Without this, `PLATFORM=android` would
// also run the iOS feature and fail on labels that cannot exist.
Before('@android', async ({ gridPlatform: platform }) => {
    test.skip(platform !== 'android', 'Android-only labels.');
});

Before('@ios', async ({ gridPlatform: platform }) => {
    test.skip(platform !== 'ios', 'iOS-only labels and identifiers.');
});

Given('the Settings app is open', async ({ device }) => {
    // getPlatform() answers 'ios' for tvOS too, which is the right key here.
    const bundleId = SETTINGS_APP[device.getPlatform() as 'android' | 'ios'];
    // Terminate first: relaunching is what actually returns the app to its first
    // screen, so the scenario does not inherit where the last one navigated to.
    try {
        await device.terminateApp(bundleId);
    } catch {
        /* not running */
    }
    await device.activateApp(bundleId);
});

Then('{string} is on screen', async ({ device }, text: string) => {
    await expect(device.getByText(text)).toBeVisible();
});

Then('the text of {string} is {string}', async ({ device }, target: string, expected: string) => {
    expect(await device.getByText(target).getText()).toBe(expected);
});

Then('the element with id {string} is on screen', async ({ device }, id: string) => {
    await expect(device.getById(id)).toBeVisible();
});

Then('the element at xpath {string} is on screen', async ({ device }, xpath: string) => {
    await expect(device.getByXpath(xpath)).toBeVisible();
});

When('I tap {string}', async ({ device }, text: string) => {
    await device.getByText(text).tap();
});

When('I tap the element with id {string}', async ({ device }, id: string) => {
    await device.getById(id).tap();
});

When('I scroll until {string} is on screen', async ({ device }, text: string) => {
    const found = await scrollUntilVisible(device, device.getByText(text));
    expect(found, `"${text}" was not reached after ${MAX_SCROLLS} scrolls`).toBe(true);
});

When('I scroll the screen', async ({ device }) => {
    // Drags from 0.8 to 0.2 of the screen height, wherever that lands — useful
    // when there is no single scrollable container to target (an iPad split
    // view, for instance).
    await device.scroll();
});

/**
 * Scroll a list until the element shows up.
 *
 * Appwright has no scroll-into-view: a locator only ever matches what is
 * currently rendered, and one `scroll()` advances roughly one screen — so
 * anything further down a long list needs a loop like this one.
 *
 * Note the scroll targets the *scrollable container*, not the element being
 * looked for: `locator.scroll()` scrolls within the element it is called on, and
 * the element you want is by definition not on screen yet.
 */
async function scrollUntilVisible(
    device: Device,
    locator: AppwrightLocator,
    attempts = MAX_SCROLLS,
): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
        if (await locator.isVisible({ timeout: PROBE_TIMEOUT })) return true;
        await device.getByXpath('//*[@scrollable="true"]').scroll(ScrollDirection.DOWN);
    }
    return locator.isVisible({ timeout: PROBE_TIMEOUT });
}
