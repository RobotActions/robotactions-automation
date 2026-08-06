// Environment is read only in ./config.ts — never process.env directly here.
import { baseUrl, gridConnection, maxInstances, releaseId, suiteName, tagExpression } from './config';
import { createHash } from 'node:crypto';

// Mobile-browser test config — Android Chrome via Appium UiAutomator2.
// Targets the local Selenium Grid + appium-grid-service stack; Grid routes
// each session to an available real Android device. Tag set the user
// asked for: ra:testsuite, ra:releaseId, ra:testName, ra:testId. The
// suite + releaseId are shared across the batch (set on the capability),
// the per-scenario testName + testId are injected in a Before hook via
// the proxy's executeScript magic verbs.

const RUN_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SUITE = suiteName('wdio-mobile-2026-06-06');
const RELEASE_ID = releaseId(`run-${RUN_TIMESTAMP}`);

export const config = {
    runner: 'local' as const,

    specs: ['./features/**/*.feature'],
    exclude: [],

    // Five concurrent mobile sessions — Grid routes each to a different
    // physical Android device from the connected pool.
    maxInstances: maxInstances(5),

    capabilities: [{
        // The Android Appium nodes register with platformName=Android +
        // appium:automationName=uiautomator2 in their stereotype but NO
        // browserName. Match the stereotype shape so Grid routes the
        // request, then tell Appium to launch Chrome via the
        // appium:browserName cap (NOT the W3C-top-level browserName,
        // which would cause Grid to reject for capability mismatch).
        platformName: 'Android',
        'appium:automationName': 'uiautomator2',
        'appium:browserName': 'chrome',
        // Standard Selenium-side options (Grid forwards them through Appium)
        'goog:loggingPrefs': { browser: 'ALL' },
        // Custom RA caps — proxy intercepts + strips these before forwarding
        // upstream, persists onto sessions.test_*. testName + testId are set
        // per-scenario at runtime by the Before hook below; the testsuite +
        // releaseId stay shared across the whole batch so the dashboard's
        // Test Suite filter + Reports rollup card group the whole run.
        'ra:testsuite': SUITE,
        'ra:releaseId': RELEASE_ID,
        // Cucumber afterScenario stamps pass/fail via `ra:job-result=...`;
        // the plugin's stopCapture probes `getLogTypes` (legacy JSON Wire,
        // W3C-rejected on uiautomator2/xcuitest) which would otherwise
        // become the last 4xx command and flip result back to 'failed'.
        'ra:autoFailDetect': false,
    }],

    // Grid connection resolved in ./config.ts. This config uses the
    // /t/<token> path-prefix auth mode (the proxy strips the prefix before
    // forwarding); gridConnection also sets the Bearer header as a fallback.
    ...gridConnection({ auth: 'path' }),

    framework: 'cucumber',
    cucumberOpts: {
        require: ['./step-definitions/**/*.ts'],
        backtrace: false,
        dryRun: false,
        failFast: false,
        snippets: true,
        source: true,
        strict: false,
        tagExpression: tagExpression(''),
        timeout: 90_000,
        ignoreUndefinedDefinitions: false,
    },

    reporters: [
        'spec',
        ['junit', {
            outputDir: './test-results',
            outputFileFormat: ({ cid }: { cid: string }) => `mobile-results-${cid}.xml`,
        }],
    ],

    baseUrl: baseUrl('https://robotactions.com'),
    waitforTimeout: 15_000,
    connectionRetryTimeout: 180_000,
    connectionRetryCount: 3,

    /**
     * Inject the per-scenario test name + test id into the running session
     * via the proxy's executeScript magic verbs. The proxy short-circuits
     * these calls and writes onto sessions.test_name / test_id without
     * forwarding to the browser. testId is a stable hash of the scenario
     * name so the same scenario across runs maps to the same id — the
     * Tests tab's "by-id" rollup then shows the per-test pass history.
     */
    beforeScenario: async function (world: { pickle: { name: string } }) {
        const name = world.pickle.name.slice(0, 200);
        const testId = `WDIO-MOBILE-${createHash('sha1').update(name).digest('hex').slice(0, 8).toUpperCase()}`;
        // Magic-string form works on every WebDriver client; structured form
        // also works but adds a serialize step.
        try { await (globalThis as any).browser.execute(`ra:job-name=${name}`); } catch (_e) { /* best-effort */ }
        try { await (globalThis as any).browser.execute(`ra:test-id=${testId}`); } catch (_e) { /* best-effort */ }
    },

    afterStep: async function (_step: unknown, _scenario: unknown, result: { passed: boolean }) {
        if (!result.passed) {
            try { await (globalThis as any).browser.takeScreenshot(); } catch (_e) { /* ignore */ }
        }
    },

    /**
     * Force a fresh Selenium session at the end of every scenario so each
     * scenario shows up as its own row in the dashboard. Without this,
     * Cucumber shares one browser session across every scenario in the
     * spec file → 2 spec files → 2 sessions, even when 10 scenarios run.
     * `browser.reloadSession()` tears down + reopens through the Grid in
     * one call; the next Before hook re-applies the ra:* caps + magic
     * verbs against the new sessionId.
     */
    afterScenario: async function (_world: unknown) {
        try { await (globalThis as any).browser.reloadSession(); } catch (_e) { /* best-effort */ }
    },
};
