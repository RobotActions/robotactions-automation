/**
 * Mobile-web suite connected via `wdio-robotactions-service`.
 *
 * Same capabilities as wdio.mobileweb.conf.ts minus the parts the service
 * supplies: no gridConnection() spread, no ra:testsuite, and no afterScenario
 * result reporting. Chrome still travels as `appium:browserName` — the Android
 * nodes advertise only the native slot, so a plain `browserName` matches
 * nothing and the session queues until the client gives up.
 */
import 'dotenv/config';
import { maxInstances } from './config';
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
};
