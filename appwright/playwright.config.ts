// Environment is read only in ./config.ts — never process.env directly here.
import { defineConfig } from 'appwright';
import { defineBddConfig, cucumberReporter } from 'playwright-bdd';
import {
    describeTarget, expectTimeout, forbidOnly, gridProject, platforms, retries, testTimeout, workers,
} from './config';

/**
 * Primary (BDD) config: Gherkin features, run by Playwright's own runner.
 *
 * ## Why `playwright.config.ts` and not `appwright.config.ts`
 *
 * Appwright's own CLI looks for `appwright.config.ts`, but that CLI is a
 * two-line shim over `npx playwright test --config appwright.config.ts` — there
 * is nothing in it to lose. Naming the file the way Playwright expects is worth
 * more: both `bddgen` and the VS Code Playwright extension discover
 * `playwright*.config.ts` and neither finds anything under the other name, so
 * the Testing view would come up empty and every `bddgen` call would need a
 * `-c` flag.
 *
 * ## Appwright's `defineConfig`
 *
 * The RobotActions fork of Appwright (github:RobotActions/appwright) ships a
 * `robotactions` device provider, so this is Appwright's own `defineConfig`:
 * it adds a global setup that validates the grid connection and build path
 * before any worker starts, and a reporter that attaches each session's
 * recording to the HTML report. Both come from the provider — nothing here is
 * patched.
 */
const testDir = defineBddConfig({
    features: 'features/**/*.feature',
    steps: 'steps/**/*.ts',
});

// Make the target explicit in the run output. A suite that starts a session
// against the wrong endpoint can still go green while the dashboard has no
// record of it, so the endpoint is printed rather than assumed.
console.log(`[appwright] target: ${describeTarget()}`);

export default defineConfig({
    testDir,
    // Each test owns its own device session, so they do not contend. Actual
    // concurrency is workers() — one device at a time unless WORKERS says more.
    fullyParallel: true,
    forbidOnly: forbidOnly(),
    retries: retries(),
    workers: workers(),
    timeout: testTimeout(),
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        // Cucumber output lives OUTSIDE test-results, and that is load-bearing.
        //
        // These reporters open their output file when they are *constructed*,
        // which happens before Playwright clears its outputDir — so with a
        // `test-results/...` path Playwright unlinks the file moments later,
        // every later write lands on a deleted inode, and the run finishes with
        // no report and no error. Verified by writing both paths in one run:
        // cucumber-report/ got its file, test-results/ got nothing.
        //
        // The reporters above are unaffected because they write once at the
        // end, after the cleanup.
        cucumberReporter('json', { outputFile: 'cucumber-report/cucumber-report.json' }),
        cucumberReporter('html', { outputFile: 'cucumber-report/cucumber-report.html' }),
    ],
    use: {
        expectTimeout: expectTimeout(),
    },
    // One project per requested platform, so --project=ios selects a platform
    // and the report separates the two. PLATFORM=android,ios runs both.
    projects: platforms().map(gridProject),
});
