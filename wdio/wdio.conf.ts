// Environment is read only in ./config.ts — never process.env directly here.
import { baseUrl, gridConnection, isCi, maxInstances, suiteName } from './config';

export const config = {
    runner: 'local' as const,

    specs: [
        './features/**/*.feature',
    ],
    exclude: [],

    maxInstances: maxInstances(5),

    capabilities: [{
        browserName: 'chrome',
        'ra:testsuite': suiteName(),
        'goog:chromeOptions': {
            args: isCi() ? ['--headless', '--no-sandbox', '--disable-gpu'] : [],
        },
    }],

    // Selenium Grid connection — scheme, host, port and auth all resolved in
    // ./config.ts so every conf file shares one definition.
    ...gridConnection(),

    framework: 'cucumber',
    cucumberOpts: {
        require: [
            './step-definitions/**/*.ts',
        ],
        backtrace: false,
        dryRun: false,
        failFast: false,
        snippets: true,
        source: true,
        strict: false,
        tagExpression: '',
        timeout: 60000,
        ignoreUndefinedDefinitions: false,
    },

    reporters: [
        'spec',
        ['junit', {
            outputDir: './test-results',
            outputFileFormat: ({ cid }: { cid: string }) => `results-${cid}.xml`,
        }],
        // html-nice reporter dropped — wdio-html-nice-reporter@^3.2.0 isn't
        // published; spec + junit cover run output + results parsing.
    ],

    baseUrl: baseUrl(),
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    afterStep: async function (_step: unknown, _scenario: unknown, result: { passed: boolean }) {
        if (!result.passed) {
            await browser.takeScreenshot();
        }
    },
};
