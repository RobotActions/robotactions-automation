// Environment is read only in ./config.ts — never process.env directly here.
import { defineConfig } from '@playwright/test';
import { defineBddConfig, cucumberReporter } from 'playwright-bdd';
import {
    baseUrl, describeTarget, forbidOnly, gridConnectOptions, headless, retries, workers,
} from './config';

const testDir = defineBddConfig({
    features: 'features/**/*.feature',
    steps: 'steps/**/*.ts',
    importTestFrom: 'steps/fixtures.ts',
});

// Grid wiring (mode selection, scheme, auth) lives in ./config.ts.
const connectOptions = gridConnectOptions();
// Make the target explicit in the run output: a missing GRID_HOST silently
// falls back to a LOCAL browser, and a green run then proves nothing about
// the grid.
console.log(`[playwright] target: ${describeTarget()}`);

export default defineConfig({
    testDir,
    fullyParallel: true,
    forbidOnly: forbidOnly(),
    retries: retries(),
    // 5 workers — exercises the dynamic-scaler ceiling (config.docker.maxDynamicNodes=5
    // and config.playwright.maxContainers=5). Override at runtime with --workers=N.
    workers: workers(),
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['allure-playwright', {
            resultsDir: 'allure-results',
            detail: true,
            suiteTitle: true,
            environmentInfo: {
                node: process.version,
                grid: describeTarget(),
            },
        }],
        ['monocart-reporter', {
            name: 'Playwright Grid Load Report',
            outputFile: 'test-results/monocart-report/index.html',
        }],
        ['playwright-ctrf-json-reporter', {
            outputFile: 'ctrf-report.json',
            outputDir: 'test-results/ctrf',
            testType: 'e2e',
            appName: 'grid',
            appVersion: '1.0.0',
        }],
        // Cucumber output lives OUTSIDE test-results, and that is load-bearing.
        //
        // These reporters open their output file when they are *constructed*,
        // which happens before Playwright clears its outputDir — so with a
        // `test-results/...` path Playwright unlinks the file moments later,
        // every later write lands on a deleted inode, and the run finishes
        // with no report and no error. Verified by writing both paths in one
        // run: cucumber-report/ got 25KB, test-results/ got nothing.
        //
        // Playwright's own json/junit reporters are unaffected because they
        // write once at the end, after the cleanup.
        cucumberReporter('json', { outputFile: 'cucumber-report/cucumber-report.json' }),
        cucumberReporter('html', { outputFile: 'cucumber-report/cucumber-report.html' }),
    ],
    use: {
        baseURL: baseUrl(),
        headless: headless(),
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                ...(connectOptions ? { connectOptions } : {}),
            },
        },
    ],
});
