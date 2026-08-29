import 'dotenv/config';
import { createHash } from 'node:crypto';

// Device-health smoke across the whole physical fleet, routed through the
// Selenium Grid hub (NOT a single Appium). Each capability entry is a slot
// the Grid distributes to a distinct free device (every node has
// maxSessions=1). It runs features/smoke.feature only (@device @smoke) —
// no app under test; a live session already proves the automation stack came
// up and the device is reachable.
//
// Set these to match the number of free device slots you want to fill.
const ANDROID_SLOTS = parseInt(process.env.ANDROID_SLOTS || '8', 10);
const IOS_SLOTS = parseInt(process.env.IOS_SLOTS || '1', 10);

const RUN_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SUITE = process.env.RA_TESTSUITE || 'WebdriverIO Mobile Smoke';
const RELEASE_ID = process.env.RA_RELEASE_ID || `smoke-${RUN_TIMESTAMP}`;

// Vendor-prefixed RA caps — the proxy strips them before forwarding to the
// hub, then persists onto sessions.test_*. autoFailDetect:false avoids the
// getLogTypes W3C-reject flipping a passed run to 'failed'.
const RA_CAPS = {
    'ra:testsuite': SUITE,
    'ra:releaseId': RELEASE_ID,
    'ra:autoFailDetect': false,
};

const androidCap = {
    platformName: 'Android',
    'appium:automationName': 'uiautomator2',
    'appium:noReset': true,
    'appium:newCommandTimeout': 120,
    ...RA_CAPS,
};

const iosCap = {
    platformName: 'iOS',
    'appium:automationName': 'xcuitest',
    'appium:noReset': true,
    'appium:newCommandTimeout': 120,
    // IOS_MANAGED_WDA=true lets the grid manage the iOS automation runner for
    // the session and tear it down afterwards. This is the working path here.
    ...(process.env.IOS_MANAGED_WDA === 'true'
        ? { 'ra:iosManagedWda': true, 'ra:liveVideo': false }
        : {}),
    ...RA_CAPS,
};

const capabilities = [
    ...Array.from({ length: ANDROID_SLOTS }, () => ({ ...androidCap })),
    ...Array.from({ length: IOS_SLOTS }, () => ({ ...iosCap })),
];

export const config = {
    runner: 'local' as const,

    specs: ['./features/smoke.feature'],
    exclude: [],

    // One worker per slot so all devices smoke concurrently.
    maxInstances: capabilities.length,

    capabilities,

    // Selenium Grid connection. GRID_HOST may include a port; defaults to 5555.
    // AUTH_TOKEN rides the /t/<token>/ path prefix (proxy strips it) — the most
    // reliable auth path for WDIO.
    protocol: 'http' as const,
    hostname: (process.env.GRID_HOST || 'localhost').split(':')[0],
    port: parseInt((process.env.GRID_HOST || '').split(':')[1] || process.env.GRID_PORT || '5555', 10),
    path: process.env.AUTH_TOKEN ? `/t/${process.env.AUTH_TOKEN}/` : '/',
    headers: {
        ...(process.env.AUTH_TOKEN ? { Authorization: `Bearer ${process.env.AUTH_TOKEN}` } : {}),
    },

    framework: 'cucumber',
    cucumberOpts: {
        require: ['./step-definitions/**/*.ts'],
        backtrace: false,
        dryRun: false,
        failFast: false,
        snippets: true,
        source: true,
        strict: false,
        tagExpression: '@smoke',
        timeout: 180_000,
        ignoreUndefinedDefinitions: false,
    },

    reporters: [
        'spec',
        ['junit', {
            outputDir: './test-results',
            outputFileFormat: ({ cid }: { cid: string }) => `grid-smoke-${cid}.xml`,
        }],
    ],

    waitforTimeout: 15_000,
    connectionRetryTimeout: 300_000,
    connectionRetryCount: 2,

    /** Per-scenario RA tagging so each device row is identifiable in Reports. */
    beforeScenario: async function (world: { pickle: { name: string } }) {
        const cid = (globalThis as any).browser?.capabilities?.platformName || 'device';
        const name = `${world.pickle.name} [${cid}]`.slice(0, 200);
        const testId = `SMOKE-${createHash('sha1').update(name + Math.random()).digest('hex').slice(0, 8).toUpperCase()}`;
        try { await (globalThis as any).browser.execute(`ra:job-name=${name}`); } catch (_e) { /* best-effort */ }
        try { await (globalThis as any).browser.execute(`ra:test-id=${testId}`); } catch (_e) { /* best-effort */ }
    },

    afterStep: async function (_step: unknown, _scenario: unknown, result: { passed: boolean }) {
        if (!result.passed) {
            try { await (globalThis as any).browser.takeScreenshot(); } catch (_e) { /* ignore */ }
        }
    },
};
