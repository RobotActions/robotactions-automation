import { config as baseConfig } from './wdio.conf';
import { createResultTracker, reportTestName } from './config';

/**
 * Secondary config for regular (non-BDD) Mocha tests.
 * Run with: npm run test:regular
 *
 * Own result tracker, separate from wdio.conf.ts's — this is a distinct
 * process/worker with its own session, and Mocha reports through
 * beforeTest/afterTest rather than Cucumber's beforeScenario/afterScenario
 * (which still exist on baseConfig here but are simply never invoked under
 * the mocha framework).
 */
const resultTracker = createResultTracker();

export const config = {
    ...baseConfig,

    specs: [
        './test/specs/**/*.spec.ts',
    ],

    framework: 'mocha' as const,
    mochaOpts: {
        ui: 'bdd' as const,
        timeout: 60000,
    },

    cucumberOpts: undefined,

    /** Names the session after whichever `it()` is currently running. */
    beforeTest: async function (test: { title: string }) {
        await reportTestName(test.title);
    },

    /** Records this test's outcome; the aggregate verdict reports once in `after`. */
    afterTest: async function (
        _test: unknown,
        _context: unknown,
        result: { passed: boolean; error?: unknown },
    ) {
        resultTracker.record(!!(result && result.passed), result && result.error);
    },

    /**
     * A failing `before`/`beforeEach` hook stops the `it()` it guards from
     * ever running, so `afterTest` never fires for it — verified live: a
     * missing app made `LoginPage.open()` throw in `beforeEach`, and without
     * this the run still reported `ra:job-result=passed`. `afterHook` fires
     * for every hook regardless of outcome, so a passing hook is a no-op
     * here (`record` ignores `passed`) and only a real hook failure counts.
     */
    afterHook: async function (
        _test: unknown,
        _context: unknown,
        result: { passed: boolean; error?: unknown },
    ) {
        resultTracker.record(!!(result && result.passed), result && result.error);
    },

    /** Reports the whole session's verdict — the one hook every framework calls. */
    after: async function () {
        await resultTracker.report();
    },
};
