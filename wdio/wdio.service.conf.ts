/**
 * Same suite as wdio.conf.ts, connected via `wdio-robotactions-service`
 * instead of the hand-rolled `gridConnection()` block. Used to verify the
 * package against a live grid.
 */
import 'dotenv/config';
import { baseUrl, isCi, maxInstances } from './config';

export const config = {
    runner: 'local' as const,

    specs: ['./features/robotactions-smoke.feature'],
    exclude: [],

    maxInstances: maxInstances(1),

    // No connection block, no ra:testsuite — the service supplies both.
    services: ['robotactions'],

    capabilities: [{
        browserName: 'chrome',
        'goog:chromeOptions': {
            args: isCi() ? ['--headless', '--no-sandbox', '--disable-gpu'] : [],
        },
    }],

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
        timeout: 60000,
        ignoreUndefinedDefinitions: false,
    },

    reporters: ['spec'],

    baseUrl: baseUrl(),
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
};
