// Environment is read only in ./config.ts — never process.env directly here.
import { defineConfig } from '@playwright/test';
import {
    describeTarget, expectTimeout, forbidOnly, platforms, retries, testTimeout, workers,
    type GridDeviceOptions,
} from './config';

/**
 * Secondary config for regular (non-BDD) Appwright tests under ./tests.
 * Run with: npm run test:regular
 *
 * Same grid wiring and same `device` fixture as the BDD config — both go
 * through ./config.ts and steps/fixtures.ts, so there is nothing to keep in
 * sync between the two files.
 */
console.log(`[appwright:regular] target: ${describeTarget()}`);

export default defineConfig<GridDeviceOptions>({
    testDir: './tests',
    testMatch: '**/*.spec.ts',
    fullyParallel: true,
    forbidOnly: forbidOnly(),
    retries: retries(),
    workers: workers(),
    timeout: testTimeout(),
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/regular-results.json' }],
    ],
    use: {
        expectTimeout: expectTimeout(),
    },
    projects: platforms().map((platform) => ({
        name: platform,
        use: { platform },
    })),
});
