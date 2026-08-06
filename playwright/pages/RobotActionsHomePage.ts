import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the RobotActions marketing site (https://robotactions.com).
 *
 * The site is a React SPA — initial HTML is a 2KB shell with `<div id="root"></div>`
 * and the React bundle hydrates afterwards. All locators wait on the post-hydration
 * DOM (Playwright auto-waits on `expect(...).toBeVisible()`).
 *
 * Routes covered (from /sitemap.xml):
 *   /                  — home
 *   /integrations
 *   /documentation
 *   /api-documentation
 *   /solutions
 */
export class RobotActionsHomePage extends BasePage {
    // ── Selectors ─────────────────────────────────────────────────────────
    // Every selector string lives here; methods use the locators below.
    private static readonly SEL = {
        root: 'main',
        heroHeading: 'h1',
        navLinks: 'nav a, header a',
        canonical: 'link[rel="canonical"]',
        metaDescription: 'meta[name="description"]',
    } as const;

    // ── Locators ──────────────────────────────────────────────────────────
    readonly root: Locator;
    readonly heroHeading: Locator;
    readonly navLinks: Locator;
    readonly hydrationMarker: Locator;
    readonly canonicalLink: Locator;
    readonly metaDescription: Locator;

    constructor(page: Page) {
        super(page);
        const sel = RobotActionsHomePage.SEL;
        // robotactions.com is a React SPA that mounts into <main>.
        // The hydration marker we wait on is "first descendant of main".
        this.root = page.locator(sel.root).first();
        this.hydrationMarker = this.root.locator('*').first();
        // The H1 rotates through 3 phrases on a ~20s cycle — use the
        // generic h1 locator; callers should not assert a fixed string.
        this.heroHeading = page.locator(sel.heroHeading).first();
        this.navLinks = page.locator(sel.navLinks);
        this.canonicalLink = page.locator(sel.canonical);
        this.metaDescription = page.locator(sel.metaDescription);
    }

    /** Nav/header link matched by accessible name. */
    navLink(name: string | RegExp): Locator {
        return this.page.getByRole('link', { name }).first();
    }

    async open(path: string = '/'): Promise<void> {
        await super.open(path);
    }

    async waitForHydration(): Promise<void> {
        // SPA root holds nothing until React mounts. Wait for any descendant
        // element to appear inside it as a hydration signal.
        await expect(this.hydrationMarker).toBeVisible({ timeout: 15000 });
    }

    async expectTitleContains(text: string | RegExp): Promise<void> {
        await expect(this.page).toHaveTitle(new RegExp(typeof text === 'string' ? text : text.source, 'i'));
    }

    async expectCanonical(href: string): Promise<void> {
        const canonical = await this.canonicalLink.getAttribute('href');
        expect(canonical).toBe(href);
    }

    async expectMetaDescriptionContains(text: string): Promise<void> {
        const desc = await this.metaDescription.getAttribute('content');
        expect(desc || '').toContain(text);
    }

    async expectHeroVisible(): Promise<void> {
        await expect(this.heroHeading).toBeVisible({ timeout: 15000 });
        const heroText = (await this.heroHeading.textContent()) || '';
        expect(heroText.trim().length).toBeGreaterThan(3);
    }

    async clickFirstNavLink(name: string | RegExp): Promise<void> {
        await this.navLink(name).click();
    }

    /** Walks every <a href> within the nav/header region and returns the
     *  ones that point at a same-origin route. Used for smoke validation
     *  that the navigation menu exposes the routes we expect. */
    async listNavRouteHrefs(): Promise<string[]> {
        const hrefs = await this.navLinks.evaluateAll((els) =>
            els.map((el) => (el as HTMLAnchorElement).getAttribute('href') || '').filter(Boolean));
        return hrefs.filter((h) => h.startsWith('/') || h.includes('robotactions.com'));
    }
}
