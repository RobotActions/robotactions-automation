// Environment is read only in ./config.ts — never process.env directly here.
import { baseUrl, errorText, gridConnection, maxInstances, releaseId, suiteName } from './config';
import { createHash } from 'node:crypto';

const RUN_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SUITE = suiteName('wdio-android-2026-06-07');
const RELEASE_ID = releaseId(`run-${RUN_TIMESTAMP}`);

// `ra:autoFailDetect: false` opts these sessions out of the proxy's
// last-command-fails heuristic. The cucumber afterScenario hook stamps
// pass/fail explicitly via `ra:job-result=...` BEFORE reloadSession;
// the plugin's stopCapture() then probes `getLogTypes` (W3C-rejected
// on uiautomator2/xcuitest), and that probe's 4xx becomes the literal
// last command — which would otherwise flip result back to 'failed'
// even though every scenario passed.
const RA_CAPS = { 'ra:testsuite': SUITE, 'ra:releaseId': RELEASE_ID, 'ra:autoFailDetect': false };
// Chrome on Android — UiAutomator2 driver handles browser sessions via the
// chromedriver bundled with the device's Chrome. No Selenium-Grid Docker
// node involvement; the local device's Appium server handles createSession.
const androidCap = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:browserName': 'chrome',
    ...RA_CAPS,
};

export const config = {
    runner: 'local' as const,
    // Same feature set as the iOS smoke run — selectors are platform-neutral
    // (CSS / JS DOM walks), not WDA-specific.
    specs: ['./features/robotactions-smoke.feature'],
    exclude: [],
    maxInstances: maxInstances(2),
    capabilities: [androidCap, androidCap],

    // Grid connection resolved in ./config.ts (single env reader).
    ...gridConnection(),

    framework: 'cucumber',
    cucumberOpts: {
        require: ['./step-definitions/**/*.ts'],
        backtrace: false,
        dryRun: false,
        failFast: false,
        snippets: true,
        source: true,
        strict: false,
        tagExpression: '',
        timeout: 120_000,
        ignoreUndefinedDefinitions: false,
    },

    reporters: [
        'spec',
        ['junit', {
            outputDir: './test-results',
            outputFileFormat: ({ cid }: { cid: string }) => `android-2-results-${cid}.xml`,
        }],
    ],

    baseUrl: baseUrl('https://robotactions.com'),
    waitforTimeout: 15_000,
    connectionRetryTimeout: 600_000,
    connectionRetryCount: 5,

    beforeScenario: async function (world: { pickle: { name: string } }) {
        const name = world.pickle.name.slice(0, 200);
        const testId = `WDIO-AND-${createHash('sha1').update(name).digest('hex').slice(0, 8).toUpperCase()}`;
        try { await (globalThis as any).browser.execute(`ra:job-name=${name}`); } catch (_e) { /* best-effort */ }
        try { await (globalThis as any).browser.execute(`ra:test-id=${testId}`); } catch (_e) { /* best-effort */ }
    },

    afterStep: async function (_step: unknown, _scenario: unknown, result: { passed: boolean }) {
        if (!result.passed) {
            try { await (globalThis as any).browser.takeScreenshot(); } catch (_e) { /* ignore */ }
        }
    },

    afterScenario: async function (
        _world: unknown,
        result: { passed?: boolean; error?: unknown } | undefined,
    ) {
        // Tag session pass/fail BEFORE reloadSession (same shape as iOS conf —
        // see wdio.ios-2.conf.ts for the why on ordering).
        try {
            const passed = result?.passed !== false;
            if (passed) {
                await (globalThis as any).browser.execute('ra:job-result=passed');
            } else {
                const reason = errorText(result?.error).slice(0, 256);
                await (globalThis as any).browser.execute(`ra:job-result=failed:${reason}`);
            }
        } catch (_e) { /* best-effort */ }
        try { await (globalThis as any).browser.reloadSession(); } catch (_e) { /* best-effort */ }
    },
};
