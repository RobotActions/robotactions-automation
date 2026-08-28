/**
 * Mobile-web WDIO config: Chrome on a real Android device via Appium + the
 * Selenium Grid (device-node browserName=chrome slot). Separate from
 * wdio.conf.ts (desktop) so the capabilities differ and it uses only the
 * `spec` reporter (the base config's html-nice reporter pin is unpublished).
 *
 * Run: AUTH_TOKEN=... GRID_HOST=localhost:5555 npx wdio run wdio.mobileweb.conf.ts
 */
// Environment is read only in ./config.ts — never process.env directly here.
import { errorText, gridConnection, maxInstances, suiteName } from './config';
import { createHash } from 'node:crypto';


// Pin to the first real Android UDID from .env so Grid routes to the physical device.

export const config: WebdriverIO.Config = {
    runner: 'local',
    specs: ['./features/robotactions-mobileweb.feature'],
    maxInstances: maxInstances(1),

    capabilities: [{
        // Send Chrome as an APPIUM extension cap, not plain W3C `browserName`:
        // the grid's Android nodes advertise only the NATIVE slot
        // (platformName=ANDROID + appium:*, no browserName), so a plain
        // `browserName: chrome` request matches no slot and queues until the
        // client gives up — verified 2026-08-05, this config failed every run
        // with UND_ERR_HEADERS_TIMEOUT on POST /session. `appium:browserName`
        // is ignored by the slot matcher (routes to the native Android slot)
        // and UiAutomator2 opens Chrome from inside the session. Same fix the
        // iOS config already carried.
        'appium:browserName': 'chrome',
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:newCommandTimeout': 180,
        // No appium:udid — the grid distributes the session to any free
        // handset. Pinning serialises every scenario onto one device and fails
        // outright whenever it is busy or offline.
        // ra:* caps — intercepted + stripped by the proxy before forwarding to Appium.
        'ra:testsuite': suiteName(),
        'ra:autoFailDetect': false,
        // Records every request Chrome makes into the session's Network tab —
        // URL, method, status, headers, timing, and the response body. Opt-in
        // because it costs disk; see docs/connecting-to-the-grid.md.
        'ra:networkCapture': true,
    } as WebdriverIO.Capabilities],

    // Grid connection — scheme, host, port and auth resolved in ./config.ts.
    ...gridConnection(),

    logLevel: 'error',
    waitforTimeout: 15000,
    connectionRetryTimeout: 180000,
    connectionRetryCount: 1,

    framework: 'cucumber',
    cucumberOpts: {
        require: [
            './step-definitions/hooks.ts',
            './step-definitions/robotactions-mobileweb.steps.ts',
        ],
        timeout: 120000,
        tagExpression: '',
    },

    reporters: ['spec'],

    /**
     * Inject per-scenario test name + stable test id via proxy magic verbs.
     * The proxy intercepts these executeScript calls and writes onto
     * sessions.test_name / test_id without forwarding to the browser.
     */
    beforeScenario: async function (world: { pickle: { name: string } }) {
        const name = world.pickle.name.slice(0, 200);
        const testId = `WDIO-MOBILEWEB-${createHash('sha1').update(name).digest('hex').slice(0, 8).toUpperCase()}`;
        try { await (globalThis as any).browser.execute(`ra:job-name=${name}`); } catch (_e) { /* best-effort */ }
        try { await (globalThis as any).browser.execute(`ra:test-id=${testId}`); } catch (_e) { /* best-effort */ }
    },

    afterStep: async function (_step: unknown, _scenario: unknown, result: { passed: boolean }) {
        if (!result.passed) {
            try { await (globalThis as any).browser.takeScreenshot(); } catch (_e) { /* ignore */ }
        }
    },

    /**
     * Report pass/fail on the SAME session via the ra:job-result magic verb so
     * sessions.result is populated. Do NOT reloadSession here — a reload after
     * the last scenario spawns a fresh, unnamed session that shows up in the
     * dashboard as "Unknown - Device @ <time>". WDIO already opens one session
     * per worker; for a one-scenario smoke that single named session is what we
     * want.
     */
    afterScenario: async function (_world: unknown, result: { passed: boolean; error?: unknown }) {
        const verb = result && result.passed
            ? 'ra:job-result=passed'
            : `ra:job-result=failed:${errorText(result && result.error).slice(0, 200)}`;
        try { await (globalThis as any).browser.execute(verb); } catch (_e) { /* best-effort */ }
    },
};
