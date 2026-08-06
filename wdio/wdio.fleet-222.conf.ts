// Environment is read only in ./config.ts — never process.env directly here.
import { baseUrl, gridConnection, maxInstances, releaseId, suiteName } from './config';
import { createHash } from 'node:crypto';

// 6 parallel WDIO workers: 2 Android Chrome + 2 iOS Safari + 2 desktop Chrome.
// Mix of mobile and desktop browsers exercising the full grid pool in one shot.

const RUN_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SUITE = suiteName('wdio-fleet-222-2026-06-06');
const RELEASE_ID = releaseId(`run-${RUN_TIMESTAMP}`);
// `ra:autoFailDetect: false` opts these sessions out of the proxy's
// last-command-fails heuristic. Cucumber afterScenario stamps pass/fail
// explicitly via `ra:job-result=...`; the plugin's stopCapture probes
// `getLogTypes` via the legacy JSON Wire route which uiautomator2/xcuitest
// reject in W3C mode — that 4xx would otherwise become the "last command"
// and flip result back to 'failed'.
const RA_CAPS = { 'ra:testsuite': SUITE, 'ra:releaseId': RELEASE_ID, 'ra:autoFailDetect': false };

export const config = {
    runner: 'local' as const,
    specs: ['./features/**/*.feature'],
    exclude: [],
    maxInstances: maxInstances(6),

    capabilities: [
        // 2 Android Chrome (UiAutomator2 + appium:browserName=chrome)
        {
            platformName: 'Android',
            'appium:automationName': 'uiautomator2',
            'appium:browserName': 'chrome',
            'goog:loggingPrefs': { browser: 'ALL' },
            ...RA_CAPS,
        },
        {
            platformName: 'Android',
            'appium:automationName': 'uiautomator2',
            'appium:browserName': 'chrome',
            'goog:loggingPrefs': { browser: 'ALL' },
            ...RA_CAPS,
        },
        // 2 iOS Safari (XCUITest lowercase to match registered stereotype)
        {
            platformName: 'iOS',
            'appium:automationName': 'xcuitest',
            'appium:browserName': 'safari',
            ...RA_CAPS,
        },
        {
            platformName: 'iOS',
            'appium:automationName': 'xcuitest',
            'appium:browserName': 'safari',
            ...RA_CAPS,
        },
        // 2 desktop Chrome (Selenium static-grid container)
        {
            browserName: 'chrome',
            'goog:loggingPrefs': { browser: 'ALL' },
            ...RA_CAPS,
        },
        {
            browserName: 'chrome',
            'goog:loggingPrefs': { browser: 'ALL' },
            ...RA_CAPS,
        },
    ],

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
            outputFileFormat: ({ cid }: { cid: string }) => `fleet-222-results-${cid}.xml`,
        }],
    ],

    baseUrl: baseUrl('https://robotactions.com'),
    waitforTimeout: 15_000,
    connectionRetryTimeout: 300_000,
    connectionRetryCount: 3,

    beforeScenario: async function (world: { pickle: { name: string } }) {
        const name = world.pickle.name.slice(0, 200);
        const testId = `WDIO-FLEET-${createHash('sha1').update(name).digest('hex').slice(0, 8).toUpperCase()}`;
        try { await (globalThis as any).browser.execute(`ra:job-name=${name}`); } catch (_e) { /* best-effort */ }
        try { await (globalThis as any).browser.execute(`ra:test-id=${testId}`); } catch (_e) { /* best-effort */ }
    },

    afterStep: async function (_step: unknown, _scenario: unknown, result: { passed: boolean }) {
        if (!result.passed) {
            try { await (globalThis as any).browser.takeScreenshot(); } catch (_e) { /* ignore */ }
        }
    },

    afterScenario: async function (_world: unknown) {
        try { await (globalThis as any).browser.reloadSession(); } catch (_e) { /* best-effort */ }
    },
};
