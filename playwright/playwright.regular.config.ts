// Environment is read only in ./config.ts — never process.env directly here.
import { defineConfig } from '@playwright/test';
import {
    baseUrl, describeTarget, forbidOnly, gridConnectOptions, headless, retries,
} from './config';

/**
 * Secondary config for regular (non-BDD) Playwright tests.
 * Run with: npx playwright test --config=playwright.regular.config.ts
 *
 * Grid wiring is shared with the BDD config through ./config.ts. It used to be
 * duplicated here with the token passed as a `headers` entry on the ws
 * endpoint — which Playwright silently drops on a ws:// upgrade, so every
 * authenticated grid run from this entry failed the auth gate.
 */
const connectOptions = gridConnectOptions();
console.log(`[playwright:regular] target: ${describeTarget()}`);

export default defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.ts',
    fullyParallel: true,
    forbidOnly: forbidOnly(),
    retries: retries(),
    workers: forbidOnly() ? 1 : undefined,
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/regular-results.json' }],
    ],
    use: {
        baseURL: baseUrl(),
        headless: headless(),
        ...(connectOptions ? { connectOptions } : {}),
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
});
