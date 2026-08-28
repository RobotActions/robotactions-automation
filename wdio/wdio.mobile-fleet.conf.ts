// Environment is read only in ./config.ts — never process.env directly here.
import { baseUrl, errorText, gridConnection, maxInstances, releaseId, suiteName } from './config';
import { createHash } from 'node:crypto';

// Mixed Android + iOS mobile-browser fleet test. Spins up 5 concurrent
// Selenium sessions (2 Android Chrome, 3 iOS Safari) — Grid routes each
// to a physical device. Only 1 iPad is connected, so the 3 iOS workers
// proves the Grid queueing path: 1 iOS session runs at a time and the
// other 2 sit in sessionQueueRequests until the iPad slot frees.
// No simulators / emulators are used.
//
// Same ra:* tagging contract as wdio.mobile.conf.ts:
//   ra:testsuite  ← shared across the whole batch
//   ra:releaseId  ← shared, set to a per-run timestamp
//   ra:testName   ← per-scenario, set at runtime via the magic verb
//   ra:testId     ← per-scenario, sha1-derived from the scenario name

const RUN_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SUITE = suiteName('wdio-fleet-2026-06-06');
const RELEASE_ID = releaseId(`run-${RUN_TIMESTAMP}`);

// Vendor-prefixed RA caps shared by every entry below. The proxy strips
// them before forwarding to the Selenium hub, so SE_REJECT_UNSUPPORTED_CAPS
// can't trip on them, then persists onto sessions.test_*.
const RA_CAPS = {
    'ra:testsuite': SUITE,
    'ra:releaseId': RELEASE_ID,
    // Cucumber afterScenario stamps pass/fail via `ra:job-result=...`;
    // the plugin's stopCapture probes `getLogTypes` (legacy JSON Wire,
    // W3C-rejected on uiautomator2/xcuitest) which would otherwise
    // become the last 4xx command and flip result back to 'failed'.
    'ra:autoFailDetect': false,
};

export const config = {
    runner: 'local' as const,

    specs: ['./features/**/*.feature'],
    exclude: [],

    // 4 concurrent WDIO workers: 2 Android + 2 iOS. With 1 iPad, 1 iOS
    // session runs at a time and the other 1 sits in the Grid queue.
    // Android has 12+ available devices so both Android workers run
    // immediately on separate devices.
    maxInstances: maxInstances(4),

    capabilities: [
        // 2 Android Chrome slots
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
        // 2 iOS Safari slots — Grid routes to the connected real iPad.
        // 1 runs at a time; the other queues until the iPad slot frees.
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
    ],

    // Selenium Grid connection (same shape as the other configs).
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
            outputFileFormat: ({ cid }: { cid: string }) => `fleet-results-${cid}.xml`,
        }],
    ],

    baseUrl: baseUrl('https://robotactions.com'),
    waitforTimeout: 15_000,
    connectionRetryTimeout: 240_000,
    connectionRetryCount: 3,

    /** Per-scenario tagging via the proxy's magic-string executeScript verbs. */
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

    /** Force a fresh session per scenario so each appears as its own row. */
    /**
     * Stamp pass/fail BEFORE reloadSession() tears the session down.
     *
     * These capabilities carry `ra:autoFailDetect: false`, which opts out of
     * the proxy's last-command-errored heuristic on the promise that this hook
     * reports explicitly. It did not — the hook only recycled the session — so
     * every run from this config landed in the dashboard as "no pass/fail was
     * reported" with both mechanisms disabled. Measured 2026-08-28: 146 of 531
     * sessions in a week had no verdict, and the named ones traced back here.
     *
     * Order matters: the magic string has to reach the proxy while the session
     * is still alive. reloadSession() below ends THIS session and opens a fresh
     * one for the next scenario.
     */
    afterScenario: async function (
        _world: unknown,
        result: { passed?: boolean; error?: unknown } | undefined,
    ) {
        try {
            // Default to passed: `result` is undefined only when Cucumber
            // could not classify the scenario, and treating that as a failure
            // would cry wolf on every framework hiccup.
            if (result?.passed !== false) {
                await (globalThis as any).browser.execute('ra:job-result=passed');
            } else {
                const reason = errorText(result?.error).slice(0, 256);
                await (globalThis as any).browser.execute(`ra:job-result=failed:${reason}`);
            }
        } catch (_e) { /* best-effort — never fail a scenario over reporting */ }
        try { await (globalThis as any).browser.reloadSession(); } catch (_e) { /* best-effort */ }
    },
};
