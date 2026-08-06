import { test, expect } from '@playwright/test';
import { RobotActionsHomePage } from '../pages/RobotActionsHomePage';

/**
 * Secondary: Regular Playwright tests for robotactions.com.
 * Run with: npm run test:regular
 *
 * Each test ends with the implicit Playwright session teardown → driver.quit()
 * → DELETE /session/:id, which the grid's selenium-proxy intercepts to stamp
 * sessions.close_reason='client_quit'. After the suite passes, the dashboard's
 * Session History should show 🛑 quit badges for every spawned row.
 */
test.describe('RobotActions marketing site', () => {
    let homepage: RobotActionsHomePage;
    let consoleErrors: string[];

    test.beforeEach(async ({ page }) => {
        homepage = new RobotActionsHomePage(page);
        consoleErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
    });

    test('home page loads with correct title and metadata', async ({ page }) => {
        await homepage.open('/');
        await expect(page).toHaveTitle(/RobotActions/i);
        await homepage.expectMetaDescriptionContains('device farm');
        await homepage.expectCanonical('https://robotactions.com/');
    });

    test('SPA hydrates and hero section is visible', async () => {
        await homepage.open('/');
        await homepage.waitForHydration();
        await homepage.expectHeroVisible();
    });

    // Sitemap routes — same SPA shell, different React Router state. Each one
    // must hydrate without throwing.
    for (const path of ['/', '/integrations', '/documentation', '/api-documentation', '/solutions']) {
        test(`route ${path} renders a hydrated React tree`, async ({ page }) => {
            await homepage.open(path);
            await homepage.waitForHydration();
            await expect(page).toHaveTitle(/RobotActions/i);
        });
    }

    test('home page loads without first-party console errors', async () => {
        await homepage.open('/');
        await homepage.waitForHydration();
        // Wait a beat for late-firing trackers to surface their noise.
        await new Promise((r) => setTimeout(r, 1500));
        const ours = consoleErrors.filter((e) => {
            const s = e.toLowerCase();
            return !s.includes('cdn-cgi/rum')
                && !s.includes('calendly')
                && !s.includes('cloudflare')
                && !s.includes('zaraz')
                && !s.includes('hotjar');
        });
        expect(ours, ours.join('\n')).toEqual([]);
    });
});
