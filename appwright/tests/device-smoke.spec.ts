import { Platform, type Device } from 'appwright';
import { test, expect } from '../steps/fixtures';

/**
 * Secondary: regular (non-BDD) Appwright tests.
 * Run with: npm run test:regular
 *
 * Same `device` fixture as the BDD suite — the only difference is the shape of
 * the test, so a team that does not want Gherkin loses nothing.
 */
test.describe('Device automation smoke', () => {
    test('the session runs on the requested platform', async ({ device, platform }) => {
        // Appwright reports tvOS as 'ios' — see steps/device-smoke.steps.ts.
        expect(device.getPlatform()).toBe(platform === 'android' ? 'android' : 'ios');
    });

    test('a screenshot can be captured', async ({ device }) => {
        const screenshot = Buffer.from(await device.screenshot(), 'base64');
        expect(screenshot.byteLength).toBeGreaterThan(1000);
    });

    test('the UI hierarchy can be queried', async ({ device }) => {
        await expect(device.getByXpath(rootSelector(device))).toBeVisible();
    });

    test('the session survives a round trip', async ({ device }) => {
        await device.waitForTimeout(500);
        const screenshot = Buffer.from(await device.screenshot(), 'base64');
        expect(screenshot.byteLength).toBeGreaterThan(1000);
    });
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
