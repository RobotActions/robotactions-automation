import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I open the RobotActions home page', async ({ robotActions }) => {
    await robotActions.open('/');
});

When('I navigate to {string}', async ({ robotActions }, path: string) => {
    await robotActions.open(path);
});

When('I wait for the SPA to hydrate', async ({ robotActions }) => {
    await robotActions.waitForHydration();
});

Then('the page title should match {}', async ({ page }, pattern: string) => {
    // Accept either /regex/ or a plain substring.
    const match = pattern.match(/^\/(.+)\/(\w*)$/);
    if (match) {
        await expect(page).toHaveTitle(new RegExp(match[1], match[2]));
    } else {
        await expect(page).toHaveTitle(new RegExp(pattern));
    }
});

Then('the page meta description should mention {string}', async ({ page }, text: string) => {
    const content = await page.locator('meta[name="description"]').getAttribute('content');
    expect(content || '').toContain(text);
});

Then('the canonical URL should be {string}', async ({ robotActions }, href: string) => {
    await robotActions.expectCanonical(href);
});

Then('I should see a hero heading', async ({ robotActions }) => {
    await robotActions.expectHeroVisible();
});

Then('no console errors should have been logged', async ({ consoleErrors }) => {
    // Drop noise from third-party trackers (Cloudflare RUM, Calendly widget).
    // We only flag errors that originate from our own bundles.
    const ourErrors = consoleErrors.filter((e) => {
        const s = e.toLowerCase();
        if (s.includes('cdn-cgi/rum')) return false;
        if (s.includes('calendly')) return false;
        if (s.includes('cloudflare')) return false;
        if (s.includes('zaraz')) return false;
        if (s.includes('hotjar')) return false;
        return true;
    });
    expect(ourErrors, ourErrors.join('\n')).toEqual([]);
});
