// Environment is read only in ./config.ts — never process.env directly here.
import { baseUrl, errorText, gridConnection, maxInstances, releaseId, suiteName } from './config';
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
