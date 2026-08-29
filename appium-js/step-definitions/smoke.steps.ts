import { Given, Then } from '@cucumber/cucumber';

/**
 * Device-level smoke steps. These assert the automation session itself is
 * healthy (the device automation stack is up) without
 * requiring an app under test — the session existing already proves the
 * automation server started — including on iOS 17+/18+ devices, where a
 * preinstalled runner is used instead of building one per session.
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

Then('the session reports a device platform', async () => {
    // The grid may auto-distribute to any free node when DEVICE_UDID is unset,
    // so assert the platform is one we know rather than a specific device.
    const caps = driver.capabilities as Record<string, unknown>;
    const platform = String(caps.platformName ?? '').toUpperCase();
    if (!['ANDROID', 'IOS'].includes(platform)) {
        throw new Error(`Session reports an unexpected platformName: ${platform || '(empty)'}`);
    }
    console.log(`[smoke] platform ${platform} on ${caps['appium:deviceName'] ?? 'unknown device'}`);
});

Then('the device still responds after a second command', async () => {
    // A single successful command can be served from session creation state.
    // Issuing another proves the session is genuinely alive on the device and
    // that the proxy is still forwarding, rather than having gone stale.
    const before = await driver.getWindowSize();
    const source = await driver.getPageSource();
    if (!(before.width > 0) || !source) {
        throw new Error('Follow-up command returned nothing — session may be stale');
    }
    console.log('[smoke] session answered a second round-trip command');
});
