// Environment is read only in ./config.ts — never process.env directly here.
import { baseUrl, gridConnection, maxInstances, releaseId, suiteName } from './config';
import { createHash } from 'node:crypto';

// 5 iOS Safari workers — single connected iPad serves them one at a time,
// the other 4 sit in Grid's sessionQueueRequests until the slot frees.
// Same ra:* tagging as the fleet config; per-scenario testName/testId
// injected via the proxy magic verbs in the beforeScenario hook.

const RUN_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SUITE = suiteName('wdio-ios-2026-06-06');
const RELEASE_ID = releaseId(`run-${RUN_TIMESTAMP}`);

const RA_CAPS = {
    'ra:testsuite': SUITE,
    'ra:releaseId': RELEASE_ID,
    // Opt out of last-command-fails heuristic — cucumber afterScenario
    // stamps pass/fail explicitly via `ra:job-result=...`; the plugin's
    // stopCapture probes `getLogTypes` via the legacy JSON Wire route
    // which xcuitest rejects in W3C mode — that 4xx would otherwise
    // become the "last command" and flip result back to 'failed'.
    'ra:autoFailDetect': false,
};

const iosCap = {
    platformName: 'iOS',
    'appium:automationName': 'xcuitest',
    'appium:browserName': 'safari',
    ...RA_CAPS,
};

export const config = {
    runner: 'local' as const,
    specs: ['./features/**/*.feature'],
    exclude: [],

    // 5 concurrent WDIO workers, all iOS. With 1 connected iPad, 1 runs
    // at a time and 4 wait in Grid's queue.
    maxInstances: maxInstances(5),
    capabilities: [iosCap, iosCap, iosCap, iosCap, iosCap],

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
            outputFileFormat: ({ cid }: { cid: string }) => `ios-results-${cid}.xml`,
        }],
    ],

    baseUrl: baseUrl('https://robotactions.com'),
    waitforTimeout: 15_000,
    // Queue waits can be long — only one iPad, 4 workers waiting. Bump the
    // session-create retry timeout so queued workers don't time out before
    // their turn comes.
    connectionRetryTimeout: 600_000,
    connectionRetryCount: 5,

    beforeScenario: async function (world: { pickle: { name: string } }) {
        const name = world.pickle.name.slice(0, 200);
        const testId = `WDIO-IOS-${createHash('sha1').update(name).digest('hex').slice(0, 8).toUpperCase()}`;
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
