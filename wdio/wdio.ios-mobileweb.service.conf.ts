/**
 * iOS mobile-web suite connected via `wdio-robotactions-service`.
 *
 * Same capabilities as wdio.ios-mobileweb.conf.ts minus what the service
 * supplies: no gridConnection() spread, no ra:testsuite, no afterScenario
 * result reporting. Safari travels as `appium:browserName` — the iOS node
 * advertises only the native slot, so a plain `browserName` matches nothing
 * and the session queues forever.
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
};
