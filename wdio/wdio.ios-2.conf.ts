// Environment is read only in ./config.ts — never process.env directly here.
import { baseUrl, gridConnection, maxInstances, releaseId, suiteName } from './config';
import { createHash } from 'node:crypto';

const RUN_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SUITE = suiteName('wdio-ios-2026-06-06');
const RELEASE_ID = releaseId(`run-${RUN_TIMESTAMP}`);

// `ra:autoFailDetect: false` opts these sessions out of the proxy's
// last-command-fails heuristic. The cucumber afterScenario hook stamps
// pass/fail explicitly via `ra:job-result=...` BEFORE reloadSession;
// the plugin's stopCapture() then probes `getLogTypes` (W3C-rejected
// on uiautomator2/xcuitest), and that probe's 4xx becomes the literal
// last command — which would otherwise flip result back to 'failed'
// even though every scenario passed.
const RA_CAPS = { 'ra:testsuite': SUITE, 'ra:releaseId': RELEASE_ID, 'ra:autoFailDetect': false };
const iosCap = {
    platformName: 'iOS',
    'appium:automationName': 'xcuitest',
    'appium:browserName': 'safari',
    ...RA_CAPS,
};

export const config = {
    runner: 'local' as const,
    // robotactions-smoke is the iOS-tailored feature — every selector / text
    // assertion was sourced from a live Playwright-MCP inspection of
    // robotactions.com so the suite passes against the real site. login.feature
    // was deleted (it targeted /login which 404s on the marketing SPA);
    // robotactions-load.feature is for the load-test config, not this one.
    specs: ['./features/robotactions-smoke.feature'],
    exclude: [],
    maxInstances: maxInstances(2),
    capabilities: [iosCap, iosCap],

    // Grid connection resolved in ./config.ts (honours GRID_PROTOCOL).
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
            outputFileFormat: ({ cid }: { cid: string }) => `ios-2-results-${cid}.xml`,
        }],
    ],

    baseUrl: baseUrl('https://robotactions.com'),
    waitforTimeout: 15_000,
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

    afterScenario: async function (
        world: { pickle?: { name?: string } } | undefined,
        result: { passed?: boolean; error?: { message?: string } } | undefined,
    ) {
        // Tag the session with pass/fail BEFORE reloadSession() tears it
        // down. Without this, the recorded video is stored but the session
        // row stays `unmarked` — failed runs blend into the Reports list and
        // the dashboard's failed-sessions filter doesn't surface them.
        //
        // Order matters: the magic-string `ra:job-result=...` must reach the
        // plugin while the session is still active. reloadSession() below
        // ends THIS session and creates a fresh one for the next scenario.
        try {
            const passed = result?.passed !== false;
            if (passed) {
                await (globalThis as any).browser.execute('ra:job-result=passed');
            } else {
                const reason = String(
                    result?.error?.message || world?.pickle?.name || 'scenario failed',
                ).slice(0, 256);
                await (globalThis as any).browser.execute(`ra:job-result=failed:${reason}`);
            }
        } catch (_e) { /* best-effort */ }
        try { await (globalThis as any).browser.reloadSession(); } catch (_e) { /* best-effort */ }
    },
};
