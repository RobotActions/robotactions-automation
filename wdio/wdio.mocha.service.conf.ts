/**
 * Mocha (non-BDD) suite connected via `wdio-robotactions-service`.
 * Exercises the service's afterTest hook, which the Cucumber configs never
 * reach — they go through afterScenario instead.
 */
import 'dotenv/config';
import { baseUrl, isCi, maxInstances } from './config';

export const config: WebdriverIO.Config = {
    runner: 'local',
    specs: ['./test/specs/**/*.spec.ts'],
    maxInstances: maxInstances(1),

    services: ['robotactions'],

    capabilities: [{
        browserName: 'chrome',
        'goog:chromeOptions': {
            args: isCi() ? ['--headless', '--no-sandbox', '--disable-gpu'] : [],
        },
    } as WebdriverIO.Capabilities],

    framework: 'mocha',
    mochaOpts: { ui: 'bdd', timeout: 60000 },

    reporters: ['spec'],
    baseUrl: baseUrl(),
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
};
