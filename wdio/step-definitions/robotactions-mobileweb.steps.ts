/**
 * Step definitions for `features/robotactions-mobileweb.feature`.
 *
 * Mobile web: RobotActions in the browser on a real handset via Appium + the
 * Grid. Capabilities live in `wdio.mobileweb.conf.ts` (Chrome/Android) and
 * `wdio.ios-mobileweb.conf.ts` (Safari/iOS) — the same scenarios run on both,
 * so step wording is browser-neutral (the config stamps the scenario name onto
 * the grid session, and Android-specific wording would mislabel iOS runs).
 *
 * Selectors live in RobotActionsMobileWebPage, never here.
 */
import { Given, Then, When } from '@cucumber/cucumber';
import page, { HERO_TAGLINE } from '../pageobjects/RobotActionsMobileWebPage';

/** No assertion library is wired into this template — keep failures explicit. */
function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
}

// ── Navigation ────────────────────────────────────────────────────────────

Given('I open RobotActions in the device browser', async () => {
    await page.openHomePage();
});

Given('I wait for the mobile SPA to hydrate', async () => {
    await page.waitForHydration();
});

When('I open the mobile path {string}', async (path: string) => {
    await page.openPath(path);
});

Then('the mobile page title should contain {string}', async (fragment: string) => {
    // Waits: on an SPA the title is set by the client router after the
    // navigation resolves, so a bare read can return the previous page's.
    const matched = await page.awaitTitleContains(fragment);
    assert(matched, `title '${await page.title()}' missing '${fragment}'`);
});

Then('the mobile page should show the {string} URL', async (fragment: string) => {
    const url = await page.currentUrl();
    assert(url.includes(fragment), `url '${url}' missing '${fragment}'`);
});

Then('the mobile page text should mention {string}', async (word: string) => {
    const text = (await page.bodyText()).toLowerCase();
    assert(text.includes(word.toLowerCase()), `page text missing '${word}'`);
});

Then('the mobile URL fragment should be {string}', async (fragment: string) => {
    const url = await page.currentUrl();
    assert(url.endsWith(fragment), `expected URL to end with '${fragment}' but was '${url}'`);
});

// ── Mobile menu ───────────────────────────────────────────────────────────

When('I tap the mobile menu button', async () => {
    await page.openMobileMenu();
});

Then('the mobile menu should be open', async () => {
    assert(await page.isMobileMenuOpen(),
        'mobile menu did not open (no nav link visible after tapping the trigger)');
});

Then('the mobile menu should be closed', async () => {
    assert(await page.isMobileMenuClosed(),
        'mobile menu is still open (a nav link is still visible)');
});

Then('the mobile menu should show the {string} link', async (label: string) => {
    assert(await page.isMenuLinkVisible(label), `menu link '${label}' is not visible`);
});

When('I tap the {string} link in the mobile menu', async (label: string) => {
    await page.tapMenuLink(label);
});

// ── Layout ────────────────────────────────────────────────────────────────

Then('the mobile page should not scroll horizontally', async () => {
    // A couple of pixels of slack: device pixel-ratio rounding can leave a
    // sub-pixel difference that is not a real layout overflow.
    const overflow = await page.horizontalOverflowPx();
    assert(overflow <= 2, `page overflows the viewport horizontally by ${overflow}px`);
});

Then('the mobile viewport meta tag should contain {string}', async (fragment: string) => {
    const content = await page.viewportMetaContent();
    assert(!!content && content.includes(fragment),
        `viewport meta '${content}' does not contain '${fragment}'`);
});

Then('the mobile section with id {string} should be in viewport', async (id: string) => {
    assert(await page.isSectionInViewport(id), `section #${id} is not in the viewport`);
});

// ── Content ───────────────────────────────────────────────────────────────

Then('the mobile hero heading should not be empty', async () => {
    const text = await page.heroHeadingText();
    assert(!!text && text.trim().length > 3, `hero heading is empty or too short: '${text}'`);
});

Then('the mobile hero tagline should be visible', async () => {
    assert(await page.isHeroTaglineVisible(),
        `hero tagline containing '${HERO_TAGLINE}' is not visible`);
});

Then('I should see the mobile {string} button', async (label: string) => {
    assert(await page.isButtonVisible(label), `button '${label}' is not visible on mobile`);
});

Then('the mobile {string} pricing tier should be visible', async (tier: string) => {
    assert(await page.isPricingTierVisible(tier),
        `pricing tier '${tier}' is not visible on mobile`);
});

// ── FAQ accordion ─────────────────────────────────────────────────────────

Then('I should see the mobile FAQ question {string}', async (question: string) => {
    assert(await page.isFaqQuestionVisible(question),
        `FAQ question '${question}' is not visible on mobile`);
});

Then('the mobile FAQ question {string} should toggle when tapped', async (question: string) => {
    assert(await page.faqQuestionTogglesOnTap(question),
        `FAQ question '${question}' did not toggle on tap (aria-expanded never changed)`);
});

// ── Header controls ───────────────────────────────────────────────────────

When('I select the {string} theme on mobile', async (choice: string) => {
    await page.selectTheme(choice);
});

Then('the mobile theme should be {string}', async (expected: string) => {
    const actual = await page.currentTheme();
    assert(actual === expected, `mobile theme did not switch to '${expected}' (is '${actual}')`);
});

When('I tap the mobile language switcher', async () => {
    await page.openLanguageMenu();
});

Then('the mobile menu item {string} should be visible', async (label: string) => {
    assert(await page.isMenuItemVisible(label), `menu item '${label}' is not visible`);
});

Then('the mobile {string} button should be visible and enabled', async (label: string) => {
    assert(await page.isSignInVisibleAndEnabled(),
        `button '${label}' is not visible or not enabled on mobile`);
});
