import { Platform, type Device } from 'appwright';
import { Given, Then, expect } from './fixtures';

/**
 * Device-level smoke steps.
 *
 * These assert the automation session itself is healthy without needing an app
 * under test — the `device` fixture having produced a Device already proves
 * `newSession` succeeded end to end: the grid authenticated the token, matched a
 * free handset, and Appium came up on it.
 */

Given('an automation session is live on a device', async ({ device }) => {
    // getPlatform() reads the session's own capabilities, so a value here means
    // the session exists and reported what it is.
    expect(['android', 'ios']).toContain(device.getPlatform());
});

Then('the session runs on the requested platform', async ({ device, platform }) => {
    // Worth asserting rather than assuming: with no DEVICE_UDID pinned the grid
    // chooses the device, and a platform mismatch would otherwise surface much
    // later as locators that never match anything.
    //
    // Compared against what Appwright *can* report, not against `platform`
    // directly: `getPlatform()` is `isAndroid ? ANDROID : IOS`, so an Apple TV
    // answers 'ios'. Asserting 'tvos' here would fail on a perfectly good session.
    expect(device.getPlatform()).toBe(platform === 'android' ? 'android' : 'ios');
});

Then('a screenshot can be captured', async ({ device }) => {
    const screenshot = Buffer.from(await device.screenshot(), 'base64');
    // A live screen is never a handful of bytes; an empty or truncated payload
    // means the capture failed even though the command returned.
    expect(screenshot.byteLength).toBeGreaterThan(1000);
    console.log(`[smoke] screenshot ${screenshot.byteLength} bytes`);
});

Then('the UI hierarchy can be queried', async ({ device }) => {
    // Matches the root of whatever is on screen, so this exercises the locator
    // engine and the snapshot without knowing anything about the app. It stays
    // true on a locked device too, which is correct: the session is still healthy.
    await expect(device.getByXpath(rootSelector(device))).toBeVisible();
});

Then('the device still responds after a second command', async ({ device }) => {
    await device.waitForTimeout(500);
    const screenshot = Buffer.from(await device.screenshot(), 'base64');
    expect(screenshot.byteLength).toBeGreaterThan(1000);
});

/**
 * XPath for the root of the UI tree, per platform.
 *
 * `//*` is the obvious probe and is fine on Android, but on iOS it regularly
 * fails to resolve — measured on a real iPad: 10s+ and then "not found", while
 * the very same hierarchy answers `//XCUIElementTypeApplication` in ~300ms and
 * dumps a full tree. So `//*` gives a false negative on iOS rather than telling
 * you anything about the device.
 */
function rootSelector(device: Device): string {
    return device.getPlatform() === Platform.IOS ? '//XCUIElementTypeApplication' : '//*';
}
