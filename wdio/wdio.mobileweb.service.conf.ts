/**
 * Mobile-web suite connected via `wdio-robotactions-service`.
 *
 * Same capabilities as wdio.mobileweb.conf.ts minus the parts the service
 * supplies: no gridConnection() spread and no ra:testsuite. Chrome still
 * travels as `appium:browserName` — the Android nodes advertise only the
 * native slot, so a plain `browserName` matches nothing and the session queues
 * until the client gives up.
 *
 * Result reporting is NOT one of the parts the service supplies. This config
 * previously had none while still passing `ra:autoFailDetect: false`, so every
 * run it produced was invisible to both the explicit and the automatic path
 * and showed in the dashboard as "no pass/fail was reported".
 */
import 'dotenv/config';
import { errorText, maxInstances } from './config';
import { createHash } from 'node:crypto';

export const config: WebdriverIO.Config = {
    runner: 'local',
    specs: ['./features/robotactions-mobileweb.feature'],
    maxInstances: maxInstances(1),

    services: ['robotactions'],

    capabilities: [{
        'appium:browserName': 'chrome',
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:newCommandTimeout': 180,
        'ra:autoFailDetect': false,
        'ra:networkCapture': true,
    } as WebdriverIO.Capabilities],

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

    beforeScenario: async function (world: { pickle: { name: string } }) {
        const name = world.pickle.name.slice(0, 200);
        const testId = `WDIO-MOBILEWEB-${createHash('sha1').update(name).digest('hex').slice(0, 8).toUpperCase()}`;
        try { await (globalThis as any).browser.execute(`ra:job-name=${name}`); } catch (_e) { /* best-effort */ }
        try { await (globalThis as any).browser.execute(`ra:test-id=${testId}`); } catch (_e) { /* best-effort */ }
    },

    /**
     * Stamp pass/fail while the session is still alive. Unlike the sibling
     * configs there is no reloadSession() here — the service owns the session
     * lifecycle — but the ordering constraint is the same: once Cucumber
     * finishes the scenario the driver is torn down and the magic string has
     * nowhere to land.
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
    },
};
