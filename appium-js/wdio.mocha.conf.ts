import { config as baseConfig } from './wdio.conf';

/**
 * Secondary config for regular (non-BDD) Mocha tests.
 * Run with: npm run test:regular
 */
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
};
