package com.example.tests.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/**
 * Page object for https://robotactions.com as rendered in mobile Chrome
 * (Appium, real Android device — {@code PLATFORM=mobileweb}).
 *
 * <p>Separate from {@link RobotActionsHomePage} because the mobile layout is a
 * different page, not a narrower one:
 * <ul>
 *   <li>Every top-level nav link is hidden until the icon-only menu button is
 *       tapped — at a 393 px viewport {@code nav a} yields 0 visible links,
 *       19 after the tap.</li>
 *   <li>There is no hover, so the desktop dropdown flows do not exist here.</li>
 *   <li>The theme control is a <em>dropdown</em> (Light / Dark / System), not a
 *       one-tap toggle.</li>
 *   <li>Several controls render twice — a hidden desktop node and a visible
 *       mobile node — so locators go through {@code anyVisible} / {@code
 *       clickAnyVisible}, never plain {@code visible} (which only inspects the
 *       first match and would time out on the hidden one).</li>
 * </ul>
 *
 * <p>Locator strategy: no test-ids on the marketing site, so visible text via
 * XPath {@code normalize-space()}, section {@code id}s for anchors, and
 * structure (icon-only button inside the header) for the menu trigger.
 */
public class RobotActionsMobileWebPage extends BasePage {

    private static final String HOME_URL = "https://robotactions.com";

    /** Sub-tagline beneath the hero heading — stable copy, safe to assert. */
    public static final String HERO_TAGLINE = "No credit card required";

    // ── Static locators ───────────────────────────────────────────────────

    private static final By MAIN = By.tagName("main");
    private static final By BODY = By.tagName("body");
    private static final By HTML = By.tagName("html");
    private static final By HERO_HEADING = By.tagName("h1");
    private static final By VIEWPORT_META = By.cssSelector("meta[name=viewport]");

    /**
     * The hamburger. It carries no text and no aria-label — only an inline SVG —
     * which is exactly what distinguishes it from the other two header buttons
     * (they hold the sr-only text "Toggle theme" / "Switch language", so
     * {@code normalize-space()} is non-empty for them). {@code [last()]} picks
     * the rightmost, which is the menu trigger in the header row.
     */
    private static final By MENU_TRIGGER = By.xpath(
        "(//header//button[not(normalize-space(.))][.//*[local-name()='svg']]"
        + " | //nav//button[not(normalize-space(.))][.//*[local-name()='svg']])[last()]");

    private static final By THEME_TRIGGER = By.xpath("//button[normalize-space()='Toggle theme']");
    private static final By LANGUAGE_TRIGGER = By.xpath("//button[normalize-space()='Switch language']");
    private static final By SIGN_IN_CTA = By.xpath(
        "//button[normalize-space()='Sign in / Sign up']"
        + " | //a[normalize-space()='Sign in / Sign up']");

    /**
     * {@code contains(text(), ...)} — NOT {@code contains(normalize-space(), ...)}.
     * The latter also matches every ancestor holding the text, so it resolves
     * {@code <html>} first and the assertion passes without the tagline ever
     * rendering. The copy lives in a single {@code <p>} text node.
     */
    private static final By HERO_TAGLINE_TEXT =
        By.xpath("//*[contains(text(), '" + HERO_TAGLINE + "')]");

    // ── Parameterised locators ────────────────────────────────────────────

    /** Nav link inside the (open) mobile menu. */
    private static By menuLink(String label) {
        return By.xpath("//nav//a[normalize-space()='" + label + "']"
            + " | //header//a[normalize-space()='" + label + "']");
    }

    private static By buttonByText(String label) {
        return By.xpath("//button[normalize-space()='" + label + "']");
    }

    /** Item inside an open Radix dropdown (theme / language menus). */
    private static By menuItem(String label) {
        return By.xpath("//*[@role='menuitem' or @role='option'][normalize-space()='" + label + "']");
    }

    /** Any dropdown item — the "is this menu actually open" sentinel. */
    private static final By ANY_MENU_ITEM =
        By.xpath("//*[@role='menuitem' or @role='option']");

    private static By sectionById(String id) {
        return By.id(id);
    }

    /** FAQ accordion trigger, scoped to the {@code #faq} section. */
    private static By faqQuestion(String question) {
        return By.xpath("//*[@id='faq']//button[contains(normalize-space(), '" + question + "')]");
    }

    /** Pricing tier heading inside the {@code #pricing} section. */
    private static By pricingTier(String name) {
        return By.xpath("//*[@id='pricing']//*[self::h2 or self::h3][normalize-space()='" + name + "']");
    }

    private static By headingContaining(String text) {
        return By.xpath(
            "//*[self::h1 or self::h2 or self::h3][contains(normalize-space(), '" + text + "')]");
    }

    public RobotActionsMobileWebPage(WebDriver driver) {
        super(driver, HOME_URL);
    }

    // ── Navigation ────────────────────────────────────────────────────────

    public void openHomePage() {
        driver.get(HOME_URL);
    }

    /** Opens {@code HOME_URL + path} — used for deep-link scenarios. */
    public void openPath(String path) {
        open(path);
    }

    /**
     * Waits for the document title to contain {@code fragment}.
     *
     * <p>The site is an SPA: after a deep-link navigation the title is set by
     * the client router, so reading {@code driver.getTitle()} straight away can
     * still return the previous page's title. Asserting without this wait fails
     * intermittently under load (observed 2026-08-04 on the /integrations row).
     */
    public boolean awaitTitleContains(String fragment) {
        return awaitTrue(d -> d.getTitle() != null && d.getTitle().contains(fragment), wait);
    }

    public void waitForHydration() {
        waitVisible(MAIN, longWait);
        waitForDocumentReady(longWait);
        // <main> visible + document.readyState=="complete" both fire before the
        // responsive header has necessarily finished mounting — observed as an
        // intermittent failure of the very next "mobile menu should be closed"
        // check (isMobileMenuClosed polls a 5 s tier meant for close-animation
        // settling, not initial-mount settling, and occasionally lost that race
        // on a real device over the grid). Waiting for the hamburger trigger
        // itself confirms the header has applied its mobile layout before any
        // menu-state assertion runs.
        waitVisible(MENU_TRIGGER, longWait);
    }

    // ── Mobile menu ───────────────────────────────────────────────────────

    /** Taps the hamburger. */
    public void openMobileMenu() {
        clickAnyVisible(MENU_TRIGGER);
    }

    /** True when the menu is showing nav links (uses "Home" as the sentinel). */
    public boolean isMobileMenuOpen() {
        return isAnyVisible(menuLink("Home"), shortWait);
    }

    /** True once no menu nav link is displayed — the close animation is polled. */
    public boolean isMobileMenuClosed() {
        return awaitNotDisplayed(menuLink("Home"), shortWait);
    }

    public boolean isMenuLinkVisible(String label) {
        return isAnyVisible(menuLink(label), shortWait);
    }

    public void tapMenuLink(String label) {
        clickAnyVisible(menuLink(label));
    }

    // ── Layout / responsiveness ───────────────────────────────────────────

    /**
     * Pixels the document overflows the viewport horizontally. A responsive page
     * returns 0; anything positive means the user can pan sideways.
     */
    public long horizontalOverflowPx() {
        Object v = executeScript(
            "return document.documentElement.scrollWidth - window.innerWidth;");
        return v instanceof Number n ? n.longValue() : 0L;
    }

    /** Content of {@code <meta name="viewport">} (present in head, never displayed). */
    public String viewportMetaContent() {
        return find(VIEWPORT_META).getDomAttribute("content");
    }

    public boolean isSectionInViewport(String id) {
        var section = find(sectionById(id), longWait);
        return awaitTrue(d -> Boolean.TRUE.equals(executeScript(
            "var r = arguments[0].getBoundingClientRect();"
            + "return r.top < window.innerHeight && r.bottom > 0;", section)), shortWait);
    }

    // ── Hero ──────────────────────────────────────────────────────────────

    public String heroHeadingText() {
        return waitVisible(HERO_HEADING).getText();
    }

    public boolean isHeroTaglineVisible() {
        return isAnyVisible(HERO_TAGLINE_TEXT);
    }

    public boolean isButtonVisible(String label) {
        return isAnyVisible(buttonByText(label));
    }

    public boolean isHeadingVisible(String text) {
        return isAnyVisible(headingContaining(text));
    }

    // ── FAQ accordion ─────────────────────────────────────────────────────

    /**
     * Taps an FAQ trigger after centring it in the viewport.
     *
     * <p>The deepest question in the list sits well below the fold. Tapping it
     * without scrolling first cost a full 300 s client timeout on iOS and a
     * silent no-op toggle on Android (verified 2026-08-04 — the same Examples
     * row failed in both templates). Centring the element makes the tap land on
     * the trigger rather than on whatever the driver's own scroll heuristic
     * leaves under the touch point.
     */
    public void tapFaqQuestion(String question) {
        WebElement trigger = anyVisible(faqQuestion(question), wait);
        executeScript("arguments[0].scrollIntoView({block:'center'});", trigger);
        trigger.click();
    }

    public boolean isFaqQuestionVisible(String question) {
        return isAnyVisible(faqQuestion(question));
    }

    /** Current {@code aria-expanded} of the visible accordion trigger, without waiting. */
    private String faqExpandedState(String question) {
        return elements.all(faqQuestion(question)).stream()
            .filter(WebElement::isDisplayed)
            .findFirst()
            .map(el -> el.getDomAttribute("aria-expanded"))
            .orElse(null);
    }

    /**
     * Taps the question and returns true once {@code aria-expanded} flips.
     *
     * <p>Asserts a <em>transition</em>, not an absolute state, because the
     * initial state is not deterministic across devices: on a real Android
     * handset the first FAQ item was already expanded, while on a real iPhone
     * (and in desktop Chrome at a mobile viewport) it was collapsed. A test
     * asserting "expanded after tap" therefore passes on one device and fails
     * on the other — tapping an open item closes it.
     */
    public boolean faqQuestionTogglesOnTap(String question) {
        String before = faqExpandedState(question);
        tapFaqQuestion(question);
        return awaitTrue(d -> {
            String now = faqExpandedState(question);
            return now != null && !now.equals(before);
        }, shortWait);
    }

    // ── Pricing ───────────────────────────────────────────────────────────

    public boolean isPricingTierVisible(String name) {
        return isAnyVisible(pricingTier(name));
    }

    // ── Header controls ───────────────────────────────────────────────────

    /**
     * Synthesises the pointer + mouse sequence a real finger produces, with no
     * trailing {@code click}.
     *
     * <p>The dropdown triggers open on {@code pointerdown}; a {@code click}
     * afterwards is read as an outside-click dismissal and closes the menu
     * again, so the sequence deliberately stops at {@code mouseup}.
     */
    private static final String POINTER_TAP_JS =
        "const el = arguments[0];"
        + "const r = el.getBoundingClientRect();"
        + "const o = {bubbles:true, cancelable:true, composed:true,"
        + "           clientX:r.x+r.width/2, clientY:r.y+r.height/2, button:0, buttons:1,"
        + "           pointerId:1, pointerType:'touch', isPrimary:true};"
        + "el.dispatchEvent(new PointerEvent('pointerover', o));"
        + "el.dispatchEvent(new PointerEvent('pointerenter', o));"
        + "el.dispatchEvent(new PointerEvent('pointerdown', o));"
        + "el.dispatchEvent(new MouseEvent('mousedown', o));"
        + "el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, {buttons:0})));"
        + "el.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, o, {buttons:0})));";

    /**
     * Opens a Radix dropdown and does not return until one of its items is
     * actually on screen.
     *
     * <p>A plain WebDriver click is enough on Android but does nothing at all on
     * iOS Safari. Measured on a real iPhone inside one safaridriver session
     * (2026-08-04), against the language trigger:
     * <ul>
     *   <li>WebDriver {@code element.click()} — menu stays closed</li>
     *   <li>{@code executeScript("arguments[0].click()")} — stays closed</li>
     *   <li>W3C Actions touch tap (pointerMove/Down/Up) — stays closed</li>
     *   <li>{@link #POINTER_TAP_JS} — opens ({@code aria-expanded="true"},
     *       items rendered)</li>
     * </ul>
     * So the fallback is the dispatched sequence, not another form of click.
     * On Android the first click succeeds and the fallback never runs.
     */
    private void openDropdown(By trigger) {
        clickAnyVisible(trigger);
        if (isAnyVisible(ANY_MENU_ITEM, shortWait)) return;
        executeScript(POINTER_TAP_JS, anyVisible(trigger, shortWait));
        isAnyVisible(ANY_MENU_ITEM, shortWait);
    }

    /**
     * Opens the theme dropdown and picks {@code choice} ("Light" / "Dark" /
     * "System"). The control is a menu, not a one-tap toggle.
     */
    public void selectTheme(String choice) {
        openDropdown(THEME_TRIGGER);
        clickAnyVisible(menuItem(choice), shortWait);
    }

    public void openLanguageMenu() {
        openDropdown(LANGUAGE_TRIGGER);
    }

    public boolean isMenuItemVisible(String label) {
        return isAnyVisible(menuItem(label), shortWait);
    }

    /** {@code "dark"} when {@code <html>} carries the dark class, else {@code "light"}. */
    public String currentTheme() {
        String cls = find(HTML).getDomAttribute("class");
        return (cls != null && cls.contains("dark")) ? "dark" : "light";
    }

    public boolean isSignInVisibleAndEnabled() {
        try {
            return anyVisible(SIGN_IN_CTA, wait).isEnabled();
        } catch (Exception e) {
            return false;
        }
    }

    // ── Page text ─────────────────────────────────────────────────────────

    public String bodyText() {
        return text(BODY);
    }
}
