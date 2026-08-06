import { Given, Then } from '@cucumber/cucumber';

/**
 * Device-level smoke steps. These assert the automation session itself is
 * healthy (WebDriverAgent up on iOS / UiAutomator2 up on Android) without
 * requiring an app under test — the session existing already proves the
 * automation server started. On iOS 17+/18+ HID devices, that means the
 * preinstalled WDA was launched via devicectl with zero xcodebuild.
 */

Given('an automation session is active', async () => {
    // A resolvable session id means createSession succeeded end-to-end.
    if (!driver.sessionId) {
        throw new Error('No active Appium session — automation server failed to start');
    }
});

Then('the device reports a valid screen size', async () => {
    const { width, height } = await driver.getWindowSize();
    if (!(width > 0 && height > 0)) {
        throw new Error(`Invalid screen size: ${width}x${height}`);
    }
    console.log(`[smoke] screen size ${width}x${height}`);
});

Then('the page source is retrievable', async () => {
    const source = await driver.getPageSource();
    if (!source || source.length < 20) {
        throw new Error(`Page source looks empty (len=${source ? source.length : 0})`);
    }
    console.log(`[smoke] page source length ${source.length}`);
});

Then('the device orientation is readable', async () => {
    const orientation = await driver.getOrientation();
    if (!/^(PORTRAIT|LANDSCAPE)$/i.test(orientation)) {
        throw new Error(`Unexpected orientation: ${orientation}`);
    }
    console.log(`[smoke] orientation ${orientation}`);
});
