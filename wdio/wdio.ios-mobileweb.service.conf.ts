/**
 * iOS mobile-web suite connected via `wdio-robotactions-service`.
 *
 * Same capabilities as wdio.ios-mobileweb.conf.ts minus what the service
 * supplies: no gridConnection() spread and no ra:testsuite. Safari travels as
 * `appium:browserName` — the iOS node advertises only the native slot, so a
 * plain `browserName` matches nothing and the session queues forever.
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
        'appium:browserName': 'safari',
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:newCommandTimeout': 180,
        'ra:autoFailDetect': false,
        'ra:networkCapture': true,
    } as WebdriverIO.Capabilities],

    logLevel: 'error',
    waitforTimeout: 20000,
    connectionRetryTimeout: 300000,
    connectionRetryCount: 1,

    framework: 'cucumber',
    cucumberOpts: {
        require: [
            './step-definitions/hooks.ts',
            './step-definitions/robotactions-mobileweb.steps.ts',
            './step-definitions/robotactions-parallel.steps.ts',
        ],
        timeout: 180000,
        tagExpression: '@mobileweb',
    },

    reporters: ['spec'],

    beforeScenario: async function (world: { pickle: { name: string } }) {
        const name = world.pickle.name.slice(0, 200);
        const testId = `WDIO-IOS-MOBILEWEB-${createHash('sha1').update(name).digest('hex').slice(0, 8).toUpperCase()}`;
        try { await (globalThis as any).browser.execute(`ra:job-name=${name}`); } catch (_e) { /* best-effort */ }
        try { await (globalThis as any).browser.execute(`ra:test-id=${testId}`); } catch (_e) { /* best-effort */ }
    },

    /**
     * Stamp pass/fail while the session is still alive. There is no
     * reloadSession() here — the service owns the session lifecycle — but the
     * ordering constraint is the same: once Cucumber finishes the scenario the
     * driver is torn down and the magic string has nowhere to land.
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
                await (globalThis as any).browser.execute(
                    `ra:job-result=failed:${errorText(result?.error).slice(0, 256)}`,
                );
            }
        } catch (_e) { /* best-effort — never fail a scenario over reporting */ }
    },
};
