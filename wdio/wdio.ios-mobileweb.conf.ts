/**
 * Mobile-web WDIO config: Safari on a real iOS device via Appium XCUITest +
 * the Selenium Grid (device-node browserName=safari slot).
 *
 * Run: AUTH_TOKEN=... GRID_HOST=localhost:4444 npx wdio run wdio.ios-mobileweb.conf.ts
 *
 * NOTE: the feature file carries @android because it was written for the
 * Android run; the tagExpression here is @mobileweb so the same scenario is
 * included on iOS without needing a tag edit.
 */
// Environment is read only in ./config.ts — never process.env directly here.
import { gridConnection, maxInstances, suiteName } from './config';
import { createHash } from 'node:crypto';


// Pin to the first real iOS UDID from .env so Grid routes to the physical device.

/** PickleResult.error may be a string or an Error depending on the failure. */
function errorText(error: unknown): string {
    if (!error) return 'scenario failed';
    if (typeof error === 'string') return error;
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : 'scenario failed';
}

export const config: WebdriverIO.Config = {
    runner: 'local',
    specs: ['./features/robotactions-mobileweb.feature'],
    maxInstances: maxInstances(1),

    capabilities: [{
        // Send Safari as an APPIUM extension cap, not plain W3C `browserName`:
        // the grid's iOS node advertises only the NATIVE slot (platformName=iOS,
        // no browserName), so a plain `browserName: safari` request matches no
        // slot and queues forever. `appium:browserName` is ignored by the slot
        // matcher (routes to the native iOS slot) and XCUITest opens Safari from
        // inside the session. (Grid Safari browserName slot disabled 2026-06-21.)
        'appium:browserName': 'safari',
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:newCommandTimeout': 180,
        // No appium:udid — the grid distributes the session to any free iOS
        // device. Pinning serialises every scenario onto one handset and fails
        // whenever it is busy or offline.
        // ra:* caps — intercepted + stripped by the proxy before forwarding to Appium.
        'ra:testsuite': suiteName(),
        'ra:autoFailDetect': false,
    } as WebdriverIO.Capabilities],

    // Grid connection — scheme, host, port and auth resolved in ./config.ts.
    ...gridConnection(),

    logLevel: 'error',
    waitforTimeout: 20000,
    connectionRetryTimeout: 300000,
    connectionRetryCount: 1,

    framework: 'cucumber',
    cucumberOpts: {
        require: [
            './step-definitions/hooks.ts',
            './step-definitions/robotactions-mobileweb.steps.ts',
            './step-definitions/robotactions-parallel.steps.ts',
        ],
        timeout: 180000,
        // @mobileweb matches the feature-level tag, which also carries @android —
        // we include it deliberately since the smoke is browser-agnostic.
        tagExpression: '@mobileweb',
    },

    reporters: ['spec'],

    /**
     * Inject per-scenario test name + stable test id via proxy magic verbs.
     */
    beforeScenario: async function (world: { pickle: { name: string } }) {
        const name = world.pickle.name.slice(0, 200);
        const testId = `WDIO-IOS-MOBILEWEB-${createHash('sha1').update(name).digest('hex').slice(0, 8).toUpperCase()}`;
        try { await (globalThis as any).browser.execute(`ra:job-name=${name}`); } catch (_e) { /* best-effort */ }
        try { await (globalThis as any).browser.execute(`ra:test-id=${testId}`); } catch (_e) { /* best-effort */ }
    },

    afterStep: async function (_step: unknown, _scenario: unknown, result: { passed: boolean }) {
        if (!result.passed) {
            try { await (globalThis as any).browser.takeScreenshot(); } catch (_e) { /* ignore */ }
        }
    },

    /**
     * Report pass/fail on the SAME session via the ra:job-result magic verb.
     * Do NOT reloadSession — a post-scenario reload spawns a fresh, unnamed
     * session that surfaces as "Unknown - Device @ <time>" in the dashboard.
     */
    afterScenario: async function (_world: unknown, result: { passed: boolean; error?: unknown }) {
        const verb = result && result.passed
            ? 'ra:job-result=passed'
            : `ra:job-result=failed:${errorText(result && result.error).slice(0, 200)}`;
        try { await (globalThis as any).browser.execute(verb); } catch (_e) { /* best-effort */ }
    },
};
