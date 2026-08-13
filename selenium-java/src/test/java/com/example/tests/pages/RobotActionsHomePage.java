package com.example.tests.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Page object for https://robotactions.com — full marketing-site nav matrix.
 *
 * Locator strategy (no test-ids on the marketing site):
 *   1. XPath normalize-space() for visible text scoped to nav/button/link
 *   2. XPath aria-label for icon buttons (theme toggle, language switcher)
 *   3. contains() for links whose text may include badge suffixes (e.g. "AI QA AgentNEW")
 *
 * All locators are declared at the top of the class — static {@link By} fields for
 * fixed elements, static factory methods for the text-driven ones. No selector
 * literal appears inside a page method. Waits come from {@link BasePage}
 * ({@code shortWait} / {@code wait} / {@code longWait}); this class never
 * constructs a WebDriverWait.
 */
public class RobotActionsHomePage extends BasePage {

    private static final String HOME_URL = "https://robotactions.com";

    /**
     * The three H1 phrases that rotate on the hero section (~20s cycle).
     * Tests must assert against this set, not a single fixed string.
     */
    public static final List<String> KNOWN_HERO_PHRASES = Arrays.asList(
        // Current copy (verified 2026-08-04): the H1 no longer rotates — 14
        // samples over 30 s returned this phrase on both desktop and mobile.
        // The older rotating phrases are kept so the assertion still passes if
        // the rotation comes back.
        "Real devices, zero lag",
        "From user story to raised defect",
        "Real Android & iOS devices",
        "Talk to your device"
    );

    /** Stable tagline beneath the rotating H1 — never changes with the cycle. */
    public static final String STABLE_TAGLINE = "No credit card required";

    /** Sentinel links used to decide whether a named dropdown is open or closed. */
    /**
     * Verified against the live desktop site 2026-08-05.
     *
     * <p>The nav button is "Products" — there is no "Features" button. An
     * earlier edit renamed this key to "Features" to match the feature file;
     * that was backwards, the feature file is the stale side.
     *
     * <p>Sentinels are chosen to appear ONLY while the dropdown is open.
     * "Integrations" was a poor sentinel because the same link also sits in the
     * footer, so it reads as visible with the dropdown shut — a false positive.
     */
    private static final Map<String, String> DROPDOWN_SENTINELS = Map.of(
        "Products",  "AI Test Agent",
        "Resources", "Compare"
    );

    // ── Static locators ───────────────────────────────────────────────────

    private static final By MAIN = By.tagName("main");
    private static final By BODY = By.tagName("body");
    private static final By HTML = By.tagName("html");
    private static final By HERO_HEADING = By.tagName("h1");
    /**
     * {@code contains(text(), ...)} matches only the element that owns the text
     * node. {@code contains(normalize-space(), ...)} would also match every
     * ancestor — resolving {@code <html>} first, which is always displayed, so
     * the visibility assertion would pass whether or not the tagline rendered.
     */
    private static final By STABLE_TAGLINE_TEXT =
        By.xpath("//*[contains(text(), '" + STABLE_TAGLINE + "')]");
    private static final By LANGUAGE_MENU =
        By.xpath("//*[@role='menu' or @role='menuitem' or @role='listbox']");
    private static final By SIGN_IN_CTA = By.xpath(
        "//button[normalize-space()='Sign in / Sign up']"
        + " | //a[normalize-space()='Sign in / Sign up']");

    // ── Parameterised locators ────────────────────────────────────────────
    // Text-driven locators are built by these factories so no XPath literal
    // ever appears inside a page method.

    private static By navLink(String label) {
        return By.xpath("//nav[1]//a[normalize-space()='" + label + "']");
    }

    private static By navButton(String label) {
        return By.xpath("//nav[1]//button[normalize-space()='" + label + "']");
    }

    private static By buttonByText(String label) {
        return By.xpath("//button[normalize-space()='" + label + "']");
    }

    private static By byAriaLabel(String label) {
        return By.xpath("//*[@aria-label='" + label + "']");
    }

    /** Any heading level (h1–h6) whose text contains {@code text}. */
    private static By headingContaining(String text) {
        return By.xpath(
            "//*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6]"
            + "[contains(normalize-space(), '" + text + "')]");
    }

    /** FAQ accordion button scoped to the {@code #faq} section. */
    private static By faqQuestion(String question) {
        return By.xpath(
            "//section[@id='faq']//button[contains(normalize-space(), '" + question + "')]"
            + " | //*[@id='faq']//button[contains(normalize-space(), '" + question + "')]");
    }

    /** Same FAQ button, unscoped — fallback when the FAQ is not in a section. */
    private static By buttonContaining(String text) {
        return By.xpath("//button[contains(normalize-space(), '" + text + "')]");
    }

    /**
     * Link matched by partial text. contains() tolerates badge suffixes
     * appended to link labels (e.g. "AI QA AgentNEW").
     */
    private static By linkContaining(String text) {
        return By.xpath("//a[contains(normalize-space(), '" + text + "')]");
    }

    private static By sectionById(String id) {
        return By.id(id);
    }

    public RobotActionsHomePage(WebDriver driver) {
        super(driver, HOME_URL);
    }

    // ── Navigation ────────────────────────────────────────────────────────

    public void openHomePage() {
        driver.get(HOME_URL);
    }

    /**
     * Waits for {@code <main>} to be visible and {@code document.readyState}
     * to equal {@code "complete"}.
     */
    public void waitForHydration() {
        waitVisible(MAIN, longWait);
        waitForDocumentReady(longWait);
    }

    /**
     * Returns the rendered text of {@code <body>}, waiting for it to be present.
     * Used by the mobile-web smoke steps, which assert on page copy rather than
     * on a specific element.
     */
    public String bodyText() {
        return text(BODY);
    }

    // ── Hero assertions ───────────────────────────────────────────────────

    /**
     * Returns the text of the first H1 on the page, waiting up to 10 s.
     */
    public String heroHeadingText() {
        return waitVisible(HERO_HEADING).getText();
    }

    /**
     * Returns true when the current H1 text contains at least one of the known
     * rotating phrases. The H1 cycles every ~20 s; callers must not assert a
     * single fixed string.
     *
     * <p>Whitespace is collapsed on both sides before comparing. The H1 wraps
     * with a {@code <br>}, so its text arrives as {@code "Real devices,\nzero
     * lag."} while the known phrase reads {@code "Real devices, zero lag"} — a
     * match a literal {@code contains} misses purely on the line break.
     */
    public boolean heroHeadingMatchesKnownPhrase() {
        String text = collapseWhitespace(heroHeadingText());
        return KNOWN_HERO_PHRASES.stream()
            .map(RobotActionsHomePage::collapseWhitespace)
            .anyMatch(text::contains);
    }

    /** Collapses every run of whitespace to a single space and trims the ends. */
    private static String collapseWhitespace(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    /**
     * Returns true when the stable hero tagline (beneath the rotating H1) is
     * visible. This text never rotates and is safe to assert unconditionally.
     */
    public boolean isStableTaglineVisible() {
        return isVisible(STABLE_TAGLINE_TEXT);
    }

    /**
     * Returns true when a button with visible text exactly matching {@code label}
     * is present and visible on the page.
     */
    public boolean isButtonVisible(String label) {
        return isVisible(buttonByText(label));
    }

    /**
     * Returns true when a heading at any level containing {@code text} is
     * visible on the page.
     */
    public boolean isHeadingVisible(String text) {
        return isVisible(headingContaining(text));
    }

    /**
     * Returns true when a FAQ accordion button whose text contains {@code question}
     * is visible inside the FAQ section. Falls back to a full-page search when the
     * FAQ is not wrapped in a {@code <section>}.
     */
    public boolean isFaqQuestionVisible(String question) {
        return isVisible(faqQuestion(question))
            || isVisible(buttonContaining(question), shortWait);
    }

    // ── Nav link / button clicks ──────────────────────────────────────────

    /**
     * Clicks the anchor inside {@code <nav>} whose visible text exactly matches
     * {@code label}. Scoped to the first {@code <nav>} element.
     */
    public void clickNavLink(String label) {
        click(navLink(label));
    }

    /**
     * Clicks a {@code <button>} inside the first {@code <nav>} element whose
     * visible text exactly matches {@code label}.
     */
    public void clickNavButton(String label) {
        click(navButton(label));
    }

    /**
     * Clicks ANY visible {@code <button>} on the page whose visible text
     * exactly matches {@code label}, or by aria-label for icon-only buttons.
     */
    public void clickButton(String label) {
        By byText = buttonByText(label);
        if (isClickable(byText, shortWait)) {
            click(byText, shortWait);
        } else {
            click(byAriaLabel(label));
        }
    }

    // ── Dropdown content ──────────────────────────────────────────────────

    /**
     * Returns true when a link whose text CONTAINS {@code sentinel} is visible.
     * Uses contains() to tolerate badge text appended to link labels
     * (e.g. "AI QA AgentNEW").
     */
    public boolean isDropdownLinkVisible(String sentinel) {
        return isVisible(linkContaining(sentinel), shortWait);
    }

    /**
     * Returns true once the sentinel link of the named dropdown is NOT in the
     * DOM as a visible element. Used for the dropdown-switching negative test
     * (opening one dropdown should close the other). Polls for up to 5 s so
     * the animation has time to finish.
     */
    public boolean isDropdownClosed(String dropdownName) {
        return awaitNotDisplayed(linkContaining(dropdownSentinel(dropdownName)), shortWait);
    }

    /**
     * Returns the sentinel link text that proves the named dropdown is open.
     * Steps share this map rather than re-declaring it.
     */
    public static String dropdownSentinel(String dropdownName) {
        String sentinel = DROPDOWN_SENTINELS.get(dropdownName);
        if (sentinel == null) {
            throw new IllegalArgumentException(
                "unknown dropdown '" + dropdownName + "' — add a sentinel entry");
        }
        return sentinel;
    }

    /**
     * Clicks a dropdown item (any visible link) matching {@code label} by
     * partial text.
     */
    public void clickDropdownItem(String label) {
        click(linkContaining(label));
    }

    // ── Theme toggle ──────────────────────────────────────────────────────

    /**
     * Returns the current theme by inspecting the {@code class} attribute of
     * {@code <html>}. Returns {@code "dark"} if the {@code dark} class is
     * present, otherwise {@code "light"}.
     */
    public String currentTheme() {
        String cls = find(HTML).getDomAttribute("class");
        return (cls != null && cls.contains("dark")) ? "dark" : "light";
    }

    // ── Viewport check ────────────────────────────────────────────────────

    /**
     * Returns true when the element with {@code id} has any portion of its
     * bounding rect within the current viewport.
     *
     * <p>Anchor-link clicks on robotactions.com trigger smooth-scroll
     * (CSS {@code scroll-behavior: smooth}) which typically takes 300-800ms.
     * A one-shot check immediately after the click races the animation, so we
     * poll the JS predicate for up to 5 s before failing the assertion.
     */
    public boolean isSectionInViewport(String id) {
        WebElement section = find(sectionById(id), longWait);
        return awaitTrue(d -> Boolean.TRUE.equals(executeScript(
            "var r = arguments[0].getBoundingClientRect();"
            + "return r.top < window.innerHeight && r.bottom > 0;",
            section)), shortWait);
    }

    // ── Language menu ─────────────────────────────────────────────────────

    /**
     * Returns true when any element with role {@code menu} or role
     * {@code menuitem} is visible.
     */
    public boolean isLanguageMenuVisible() {
        return isVisible(LANGUAGE_MENU, shortWait);
    }

    // ── Sign-in CTA ───────────────────────────────────────────────────────

    /**
     * Returns true when the "Sign in / Sign up" button is both visible and
     * enabled.
     */
    public boolean isSignInButtonVisibleAndEnabled() {
        try {
            return waitVisible(SIGN_IN_CTA).isEnabled();
        } catch (Exception e) {
            return false;
        }
    }
}
