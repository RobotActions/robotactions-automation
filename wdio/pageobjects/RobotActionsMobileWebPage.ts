/**
 * Page object for https://robotactions.com in a mobile browser (Appium on a
 * real handset — `wdio.mobileweb.conf.ts` or `wdio.ios-mobileweb.conf.ts`).
 *
 * The mobile layout is a different page, not a narrower one:
 *   · every top-level nav link is hidden until the icon-only menu button is
 *     tapped — at a ~400px viewport `nav a` yields 0 visible links, 19 after
 *   · there is no hover, so the desktop dropdown flows do not exist here
 *   · the theme control is a dropdown (Light / Dark / System), not a toggle
 *   · several controls render twice — a hidden desktop node and a visible
 *     mobile one — so lookups take the first DISPLAYED match, never just the
 *     first match
 *
 * Every selector lives in the SELECTORS block at the top; no selector literal
 * appears inside a method.
 */

// browser / $ / $$ are not Node globals — they come from this import.
import { $, $$, browser } from '@wdio/globals';

const HOME_URL = 'https://robotactions.com';

/** Sub-tagline beneath the hero heading — stable copy, safe to assert. */
export const HERO_TAGLINE = 'No credit card required';

const SELECTORS = {
    main: 'main',
    body: 'body',
    html: 'html',
    heroHeading: 'h1',
    viewportMeta: 'meta[name=viewport]',

    // The hamburger carries no text and no aria-label — only an inline SVG —
    // which is what separates it from the other two header buttons (they hold
    // the sr-only text "Toggle theme" / "Switch language"). [last()] picks the
    // rightmost in the header row.
    menuTrigger:
        "(//header//button[not(normalize-space(.))][.//*[local-name()='svg']]"
        + " | //nav//button[not(normalize-space(.))][.//*[local-name()='svg']])[last()]",

    themeTrigger: "//button[normalize-space()='Toggle theme']",
    languageTrigger: "//button[normalize-space()='Switch language']",
    signInCta:
        "//button[normalize-space()='Sign in / Sign up']"
        + " | //a[normalize-space()='Sign in / Sign up']",

    // contains(text(), ...) — NOT contains(normalize-space(), ...). The latter
    // also matches every ancestor holding the text, so it resolves <html> first
    // and the assertion passes without the tagline ever rendering.
    heroTagline: `//*[contains(text(), '${HERO_TAGLINE}')]`,

    // Any dropdown item — the "is this menu actually open" sentinel.
    anyMenuItem: "//*[@role='menuitem' or @role='option']",

    // The analytics consent bar: `fixed bottom-0`, about a third of a phone's
    // viewport. Decline rather than Accept — a test run should not opt itself
    // into analytics, and the bar goes away either way.
    consentDecline: "//*[@role='region']//button[normalize-space()='Decline']",
    // The chatbot greeting bubble: a second fixed overlay, bottom-right, that
    // arrives on a timer rather than at load. Its dismiss control is icon-only.
    chatGreetingDismiss:
        "//div[contains(@class,'fixed') and contains(@class,'bottom-[90px]')]//button[@aria-label]",
} as const;

/**
 * Dispatches the pointer + mouse sequence a real finger produces, with NO
 * trailing click.
 *
 * The dropdown triggers open on pointerdown; a click afterwards is read as an
 * outside-click dismissal and closes the menu again, so the sequence stops at
 * mouseup. Measured on a real iPhone inside one safaridriver session: a
 * WebDriver click, an executeScript click, and a W3C Actions touch tap ALL
 * leave the menu closed; only this dispatched sequence opens it.
 */
const POINTER_TAP_JS = `
const el = arguments[0];
const r = el.getBoundingClientRect();
const o = {bubbles:true, cancelable:true, composed:true,
           clientX:r.x+r.width/2, clientY:r.y+r.height/2, button:0, buttons:1,
           pointerId:1, pointerType:'touch', isPrimary:true};
el.dispatchEvent(new PointerEvent('pointerover', o));
el.dispatchEvent(new PointerEvent('pointerenter', o));
el.dispatchEvent(new PointerEvent('pointerdown', o));
el.dispatchEvent(new MouseEvent('mousedown', o));
el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, {buttons:0})));
el.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, o, {buttons:0})));
`;

const SHORT_TIMEOUT = 5000;
const DEFAULT_TIMEOUT = 15000;
const LONG_TIMEOUT = 30000;

class RobotActionsMobileWebPage {
    // ── Parameterised selectors ───────────────────────────────────────────

    /** Nav link inside the (open) mobile menu. */
    private menuLink(label: string): string {
        return `//nav//a[normalize-space()='${label}'] | //header//a[normalize-space()='${label}']`;
    }

    private buttonByText(label: string): string {
        return `//button[normalize-space()='${label}']`;
    }

    /** Item inside an open dropdown (theme / language menus). */
    private menuItem(label: string): string {
        return `//*[@role='menuitem' or @role='option'][normalize-space()='${label}']`;
    }

    private sectionById(id: string): string {
        return `//*[@id='${id}']`;
    }

    /** FAQ accordion trigger, scoped to the #faq section. */
    private faqQuestion(question: string): string {
        return `//*[@id='faq']//button[contains(normalize-space(), '${question}')]`;
    }

    private pricingTier(name: string): string {
        return `//*[@id='pricing']//*[self::h2 or self::h3][normalize-space()='${name}']`;
    }

    // ── Displayed-match helpers ───────────────────────────────────────────

    /**
     * First DISPLAYED element for a selector, ignoring hidden matches earlier
     * in the DOM. `$(selector)` returns the first match whether or not it is
     * displayed, which times out on the controls the site renders twice.
     */
    private async firstDisplayed(selector: string, timeout = DEFAULT_TIMEOUT) {
        let found: WebdriverIO.Element | undefined;
        await browser.waitUntil(async () => {
            for (const el of await $$(selector)) {
                if (await el.isDisplayed()) {
                    found = el;
                    return true;
                }
            }
            return false;
        }, { timeout, interval: 200 });
        return found!;
    }

    private async isAnyDisplayed(selector: string, timeout = SHORT_TIMEOUT): Promise<boolean> {
        try {
            await this.firstDisplayed(selector, timeout);
            return true;
        } catch {
            return false;
        }
    }

    private async tap(selector: string, timeout = DEFAULT_TIMEOUT): Promise<void> {
        await (await this.firstDisplayed(selector, timeout)).click();
    }

    // ── Navigation ────────────────────────────────────────────────────────

    async openHomePage(): Promise<void> {
        await browser.url(HOME_URL);
        await this.dismissOverlays();
    }

    async openPath(path: string): Promise<void> {
        await browser.url(`${HOME_URL}${path}`);
        await this.dismissOverlays();
    }

    // ── Overlays ──────────────────────────────────────────────────────────

    /**
     * Clears the two fixed overlays that cover content on a phone.
     *
     * The consent bar covers the lower third of the viewport, so a control
     * scrolled to the centre of a shorter screen sits under it and the tap
     * lands on the bar instead:
     *
     *   AccordionTrigger is not clickable at point (205, 569). Other element
     *   would receive the click: <p class="mt-2 text-sm leading-relaxed …">
     *
     * That is why the FAQ scenarios failed on a Galaxy S20+ and Note9 but
     * passed on a taller LG G9. Answering both overlays is what a visitor does
     * first anyway. Mirrors `dismiss_overlays()` in the selenium-python
     * template and `dismissOverlays()` in the playwright one.
     *
     * Once per browser session: the answers are stored, so neither overlay
     * renders again, and probing on every page open cost ~10s per scenario
     * (a Note9 run went from 1m43 to 4m29 before this guard).
     */
    async dismissOverlays(): Promise<void> {
        if (this.overlaysCheckedFor === browser.sessionId) return;
        await this.dismissIfPresent(SELECTORS.consentDecline);
        await this.dismissIfPresent(SELECTORS.chatGreetingDismiss);
        this.overlaysCheckedFor = browser.sessionId;
    }

    private overlaysCheckedFor?: string;

    /**
     * Clicks a dismiss control if it shows up, then CONFIRMS the overlay went.
     *
     * The probe is SHORT_TIMEOUT, not longer: a real iPhone keeps the stored
     * consent choice between sessions, so after the first run the bar never
     * renders and a long wait would be paid by every scenario. If a WebDriver
     * click leaves it showing (iOS Safari can ignore one), a script click
     * follows. Best-effort: an overlay is never the thing under test.
     */
    private async dismissIfPresent(selector: string): Promise<void> {
        try {
            if (!(await this.isAnyDisplayed(selector))) return;
            const control = await this.firstDisplayed(selector, SHORT_TIMEOUT);
            await control.click();
            if (!(await this.isAnyDisplayed(selector, 1000))) return;
            const still = await this.firstDisplayed(selector, SHORT_TIMEOUT);
            await browser.execute((el: HTMLElement) => el.click(), still as unknown as HTMLElement);
        } catch {
            /* best-effort */
        }
    }

    async waitForHydration(): Promise<void> {
        await (await $(SELECTORS.main)).waitForDisplayed({ timeout: LONG_TIMEOUT });
        await browser.waitUntil(
            async () => (await browser.execute(() => document.readyState)) === 'complete',
            { timeout: LONG_TIMEOUT, interval: 300 },
        );
    }

    /**
     * Waits for the title to contain `fragment`. The site is an SPA — after a
     * deep-link navigation the title is set by the client router, so reading it
     * straight away can return the previous page's title.
     */
    async awaitTitleContains(fragment: string): Promise<boolean> {
        try {
            await browser.waitUntil(
                async () => (await browser.getTitle()).includes(fragment),
                { timeout: DEFAULT_TIMEOUT, interval: 250 },
            );
            return true;
        } catch {
            return false;
        }
    }

    async title(): Promise<string> {
        return browser.getTitle();
    }

    async currentUrl(): Promise<string> {
        return browser.getUrl();
    }

    async bodyText(): Promise<string> {
        return (await $(SELECTORS.body)).getText();
    }

    // ── Mobile menu ───────────────────────────────────────────────────────

    async openMobileMenu(): Promise<void> {
        await this.tap(SELECTORS.menuTrigger);
    }

    async isMobileMenuOpen(): Promise<boolean> {
        return this.isAnyDisplayed(this.menuLink('Home'));
    }

    async isMobileMenuClosed(): Promise<boolean> {
        try {
            await browser.waitUntil(async () => {
                for (const el of await $$(this.menuLink('Home'))) {
                    if (await el.isDisplayed()) return false;
                }
                return true;
            }, { timeout: SHORT_TIMEOUT, interval: 200 });
            return true;
        } catch {
            return false;
        }
    }

    async isMenuLinkVisible(label: string): Promise<boolean> {
        return this.isAnyDisplayed(this.menuLink(label));
    }

    async tapMenuLink(label: string): Promise<void> {
        await this.tap(this.menuLink(label));
    }

    // ── Layout ────────────────────────────────────────────────────────────

    async horizontalOverflowPx(): Promise<number> {
        const value = await browser.execute(
            () => document.documentElement.scrollWidth - window.innerWidth);
        return Number(value ?? 0);
    }

    async viewportMetaContent(): Promise<string | null> {
        return (await $(SELECTORS.viewportMeta)).getAttribute('content');
    }

    async isSectionInViewport(id: string): Promise<boolean> {
        const section = await $(this.sectionById(id));
        await section.waitForExist({ timeout: LONG_TIMEOUT });
        try {
            await browser.waitUntil(async () => browser.execute((el: HTMLElement) => {
                const r = el.getBoundingClientRect();
                return r.top < window.innerHeight && r.bottom > 0;
            }, section as unknown as HTMLElement), { timeout: SHORT_TIMEOUT, interval: 200 });
            return true;
        } catch {
            return false;
        }
    }

    // ── Hero ──────────────────────────────────────────────────────────────

    async heroHeadingText(): Promise<string> {
        const h1 = await $(SELECTORS.heroHeading);
        await h1.waitForDisplayed({ timeout: DEFAULT_TIMEOUT });
        return h1.getText();
    }

    async isHeroTaglineVisible(): Promise<boolean> {
        return this.isAnyDisplayed(SELECTORS.heroTagline, DEFAULT_TIMEOUT);
    }

    async isButtonVisible(label: string): Promise<boolean> {
        return this.isAnyDisplayed(this.buttonByText(label), DEFAULT_TIMEOUT);
    }

    // ── FAQ accordion ─────────────────────────────────────────────────────

    async isFaqQuestionVisible(question: string): Promise<boolean> {
        return this.isAnyDisplayed(this.faqQuestion(question), DEFAULT_TIMEOUT);
    }

    private async faqExpandedState(question: string): Promise<string | null> {
        for (const el of await $$(this.faqQuestion(question))) {
            if (await el.isDisplayed()) return el.getAttribute('aria-expanded');
        }
        return null;
    }

    /**
     * Taps an FAQ trigger after centring it in the viewport.
     *
     * The deepest question sits well below the fold; tapping it without
     * scrolling first cost a full client timeout on iOS and a no-op toggle on
     * Android in the sibling templates.
     */
    async tapFaqQuestion(question: string): Promise<void> {
        const trigger = await this.firstDisplayed(this.faqQuestion(question));
        await browser.execute(
            (el: HTMLElement) => el.scrollIntoView({ block: 'center' }),
            trigger as unknown as HTMLElement);
        await trigger.click();
    }

    /**
     * Taps the question and resolves true once aria-expanded flips.
     *
     * Asserts a TRANSITION, not an absolute state: the initial state is not
     * deterministic across devices — the first FAQ item was already expanded on
     * a real Android handset and collapsed on a real iPhone.
     */
    async faqQuestionTogglesOnTap(question: string): Promise<boolean> {
        const before = await this.faqExpandedState(question);
        await this.tapFaqQuestion(question);
        try {
            await browser.waitUntil(async () => {
                const now = await this.faqExpandedState(question);
                return now !== null && now !== before;
            }, { timeout: SHORT_TIMEOUT, interval: 200 });
            return true;
        } catch {
            return false;
        }
    }

    // ── Pricing ───────────────────────────────────────────────────────────

    async isPricingTierVisible(name: string): Promise<boolean> {
        return this.isAnyDisplayed(this.pricingTier(name), DEFAULT_TIMEOUT);
    }

    // ── Header controls ───────────────────────────────────────────────────

    /**
     * Opens a dropdown and does not return until an item is on screen. A plain
     * click is enough on Android but does nothing at all on iOS Safari, so the
     * fallback dispatches the pointer sequence.
     */
    private async openDropdown(triggerSelector: string): Promise<void> {
        await this.tap(triggerSelector);
        if (await this.isAnyDisplayed(SELECTORS.anyMenuItem)) return;
        const trigger = await this.firstDisplayed(triggerSelector);
        await browser.execute(POINTER_TAP_JS, trigger as unknown as HTMLElement);
        await this.isAnyDisplayed(SELECTORS.anyMenuItem);
    }

    /** Opens the theme dropdown and picks Light / Dark / System. */
    async selectTheme(choice: string): Promise<void> {
        await this.openDropdown(SELECTORS.themeTrigger);
        await this.tap(this.menuItem(choice), SHORT_TIMEOUT);
    }

    async openLanguageMenu(): Promise<void> {
        await this.openDropdown(SELECTORS.languageTrigger);
    }

    async isMenuItemVisible(label: string): Promise<boolean> {
        return this.isAnyDisplayed(this.menuItem(label));
    }

    /** `"dark"` when <html> carries the dark class, else `"light"`. */
    async currentTheme(): Promise<string> {
        const cls = (await (await $(SELECTORS.html)).getAttribute('class')) || '';
        return cls.includes('dark') ? 'dark' : 'light';
    }

    async isSignInVisibleAndEnabled(): Promise<boolean> {
        try {
            const el = await this.firstDisplayed(SELECTORS.signInCta);
            return el.isEnabled();
        } catch {
            return false;
        }
    }
}

export default new RobotActionsMobileWebPage();
