import { test as base, createBdd } from 'playwright-bdd';
import { RobotActionsHomePage } from '../pages/RobotActionsHomePage';

/**
 * Custom test instance with Page Object fixtures + a shared `consoleErrors`
 * array that step definitions can assert against. Each test gets its own
 * empty array; the `page.on('console', ...)` hook pushes anything at error
 * level so the "no console errors" step can check it.
 */
export const test = base.extend<{
    robotActions: RobotActionsHomePage;
    consoleErrors: string[];
}>({
    robotActions: async ({ page }, use) => {
        await use(new RobotActionsHomePage(page));
    },
    consoleErrors: async ({ page }, use) => {
        // Marketing sites embed 3rd-party scripts (chat widgets, analytics,
        // tag managers) that emit benign console errors during init. Filter
        // those out here so the "no console errors" assertion focuses on
        // first-party (app code) failures. Add patterns below as needed.
        const IGNORE = [
            /intercom/i,                              // Intercom chat widget
            /analytics|gtag|googletagmanager/i,       // analytics noise
            /Failed to load resource.*\b(404|403)\b/i, // 404s from optional assets
            /favicon\.ico/i,                          // missing favicon
            /net::ERR_BLOCKED_BY_CLIENT/i,            // ad-blocker noise (won't fire in CI but harmless)
        ];
        const errors: string[] = [];
        const keep = (text: string) => !IGNORE.some((p) => p.test(text));
        page.on('console', (msg) => {
            if (msg.type() === 'error' && keep(msg.text())) errors.push(msg.text());
        });
        page.on('pageerror', (err) => {
            if (keep(err.message)) errors.push(`pageerror: ${err.message}`);
        });
        await use(errors);
    },
});

export const { Given, When, Then } = createBdd(test);
