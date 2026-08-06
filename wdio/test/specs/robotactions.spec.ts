import { browser, $, $$ } from '@wdio/globals';

/**
 * Secondary entry: regular Mocha tests (non-BDD).
 * Run with: npm run test:regular  (npx wdio run wdio.mocha.conf.ts)
 *
 * Inherits the desktop capabilities from wdio.conf.ts. This file replaces the
 * old login.spec.ts, which imported pageobjects/LoginPage — deleted during the
 * robotactions migration, leaving the secondary entry unable to compile.
 *
 * Deliberately thin: the BDD suite owns behavioural coverage, so this exists to
 * keep the non-BDD path exercised and honest.
 */
describe('RobotActions marketing site', () => {
    before(async () => {
        await browser.url('https://robotactions.com');
        await $('main').waitForDisplayed({ timeout: 30000 });
        await browser.waitUntil(
            async () => (await browser.execute(() => document.readyState)) === 'complete',
            { timeout: 30000, interval: 300 },
        );
    });

    it('serves the expected document title', async () => {
        await browser.waitUntil(
            async () => (await browser.getTitle()).includes('RobotActions'),
            { timeout: 15000, timeoutMsg: 'title never contained "RobotActions"' },
        );
    });

    it('renders a non-empty hero heading', async () => {
        const heading = await $('h1');
        await heading.waitForDisplayed({ timeout: 15000 });
        const text = (await heading.getText()).trim();
        expect(text.length).toBeGreaterThan(3);
    });

    it('shows the stable hero tagline', async () => {
        // contains(text(), ...) matches only the element owning the text node;
        // contains(normalize-space(), ...) would also match <html>, which is
        // always displayed and would make this assertion pass vacuously.
        const tagline = await $("//*[contains(text(), 'No credit card required')]");
        await expect(tagline).toBeDisplayed();
    });

    it('exposes same-origin routes in the nav', async () => {
        // Explicit loop: in WDIO v9 `$$(...).map()` is itself async and returns
        // a promise, so Promise.all would receive a promise rather than an array.
        const routes: string[] = [];
        for (const anchor of await $$('nav a, header a')) {
            const href = await anchor.getAttribute('href');
            if (href && (href.startsWith('/') || href.includes('robotactions.com'))) {
                routes.push(href);
            }
        }
        expect(routes.length).toBeGreaterThan(0);
    });

    it('does not overflow the viewport horizontally', async () => {
        const overflow = await browser.execute(
            () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(Number(overflow)).toBeLessThanOrEqual(2);
    });
});
