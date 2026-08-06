import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';

BeforeAll(async function () {
    console.log('Test suite starting...');
});

/**
 * Before each scenario: ensure the app is running and in the foreground.
 * activateApp is a no-op if the app is already in the foreground, so this
 * is safe to call unconditionally.
 */
Before(async function (scenario) {
    console.log(`Starting: ${scenario.pickle.name}`);

    // Device-level smoke scenarios need no app under test — skip app activation
    // so the smoke stays purely a "did the automation server start" check.
    const isDeviceSmoke = (scenario.pickle.tags || []).some((t) => t.name === '@device');
    if (isDeviceSmoke) {
        return;
    }

    const appId = process.env.BUNDLE_ID || process.env.APP_PACKAGE || 'com.example.app';
    try {
        await driver.activateApp(appId);
    } catch (err) {
        // activateApp may throw if the app was never launched; launch it instead.
        console.warn(`activateApp failed, attempting launchApp: ${(err as Error).message}`);
        await driver.launchApp();
    }
});

After(async function (scenario) {
    if (scenario.result?.status === 'FAILED') {
        const screenshot = await browser.takeScreenshot();
        this.attach(screenshot, 'image/png');
    }
});

AfterAll(async function () {
    console.log('Test suite complete.');
});
