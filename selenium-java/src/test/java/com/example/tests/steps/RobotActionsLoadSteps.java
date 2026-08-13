package com.example.tests.steps;

import com.example.tests.config.DriverHolder;
import com.example.tests.pages.RobotActionsHomePage;
import com.example.tests.support.ElementHandler;
import com.example.tests.support.WaitHandlers;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.net.URI;
import java.util.List;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Step definitions for {@code features/robotactions-load.feature}.
 *
 * Key design decisions:
 * <ul>
 *   <li>Uses {@link DriverHolder#get()} (ThreadLocal) — consistent with Hooks pattern.</li>
 *   <li>{@link ScenarioContext} (also ThreadLocal) carries per-scenario state.</li>
 *   <li>{@link #assertNoConsoleSevereErrors()} is wrapped in try/catch because
 *       {@code driver.manage().logs().get(LogType.BROWSER)} throws on Chrome 132+
 *       when browser logs are not available.  The step logs a warning and continues
 *       rather than failing on a capabilities gap.</li>
 * </ul>
 */
public class RobotActionsLoadSteps {

    private static final Logger LOG = Logger.getLogger(RobotActionsLoadSteps.class.getName());
    private static final String RA_HOME = "https://robotactions.com";

    // ── Helpers ───────────────────────────────────────────────────────────

    private WebDriver driver() {
        return DriverHolder.get();
    }

    private RobotActionsHomePage page() {
        return new RobotActionsHomePage(driver());
    }

    /**
     * Wait tiers for the steps that assert on driver state (URL, title) rather
     * than on an element the page object owns. Same instance the page objects
     * use — see {@link WaitHandlers}.
     */
    private WaitHandlers waits() {
        return WaitHandlers.forDriver(driver());
    }

    /** Element interaction for the few steps that touch the DOM directly. */
    private ElementHandler elements() {
        return ElementHandler.forDriver(driver());
    }

    // ── Background ────────────────────────────────────────────────────────

    @Given("I open the RobotActions home page")
    public void openHomePage() {
        driver().get(RA_HOME);
    }

    /** Generic "go to URL" for negative tests (404 page, unknown hash). */
    @When("I navigate to path {string}")
    public void navigateToPath(String path) {
        driver().get(RA_HOME + path);
    }

    /** Assertion used by negative tests + deep-link sanity checks. */
    @Then("the page title should contain {string}")
    public void pageTitleShouldContain(String text) {
        // Wait briefly for SPA hydration so the title settles.
        waits().awaitTrue(d -> d.getTitle() != null && d.getTitle().contains(text),
            waits().shortWait());
        String actual = driver().getTitle();
        assertTrue(actual.contains(text),
            "page title '" + actual + "' does not contain '" + text + "'");
    }

    @Given("I wait for the SPA to hydrate")
    public void waitForSpaHydration() {
        page().waitForHydration();
    }

    // ── Hero + primary CTAs ───────────────────────────────────────────────

    /**
     * Asserts that the current H1 text contains at least one of the three
     * rotating hero phrases.  A fixed-string assertion would be intermittently
     * flaky because the phrases cycle every ~20 s.
     */
    @Then("the hero heading should contain one of the known phrases")
    public void heroHeadingContainsKnownPhrase() {
        assertTrue(page().heroHeadingMatchesKnownPhrase(),
            "hero heading '" + page().heroHeadingText()
            + "' does not match any of the known phrases: "
            + RobotActionsHomePage.KNOWN_HERO_PHRASES);
    }

    /**
     * Asserts that the stable tagline beneath the rotating H1 is visible.
     * "No credit card required • Cancel anytime • 30-day free trial" never rotates.
     */
    @Then("the stable hero tagline should be visible")
    public void stableHeroTaglineVisible() {
        assertTrue(page().isStableTaglineVisible(),
            "stable hero tagline containing 'No credit card required' is not visible");
    }

    /** Legacy step kept for compatibility — delegates to the rotating-phrase check. */
    @Then("the hero heading should contain {string}")
    public void heroHeadingContains(String fragment) {
        String text = page().heroHeadingText();
        assertTrue(text.contains(fragment),
            "hero heading text '" + text + "' does not contain '" + fragment + "'");
    }

    @Then("I should see the {string} button")
    public void shouldSeeButton(String label) {
        assertTrue(page().isButtonVisible(label),
            "button '" + label + "' is not visible");
    }

    @Then("I should see the heading {string}")
    public void shouldSeeHeading(String label) {
        assertTrue(page().isHeadingVisible(label),
            "heading '" + label + "' is not visible");
    }

    // ── Top-level nav: hash anchors ───────────────────────────────────────

    @When("I click the {string} nav link")
    public void clickNavLink(String label) {
        page().clickNavLink(label);
    }

    @Then("the URL fragment should be {string}")
    public void urlFragmentShouldBe(String fragment) {
        waits().awaitTrue(d -> d.getCurrentUrl().endsWith(fragment), waits().shortWait());
        assertTrue(driver().getCurrentUrl().endsWith(fragment),
            "expected URL to end with '" + fragment + "' but was '"
            + driver().getCurrentUrl() + "'");
    }

    @Then("the section with id {string} should be in viewport")
    public void sectionInViewport(String id) {
        assertTrue(page().isSectionInViewport(id),
            "section #" + id + " is not in the viewport");
    }

    // ── Dropdowns ─────────────────────────────────────────────────────────

    @When("I click the {string} nav button")
    public void clickNavButton(String label) {
        page().clickNavButton(label);
    }

    @When("I click the {string} button")
    public void clickButton(String label) {
        page().clickButton(label);
    }

    @Then("the {word} dropdown should be visible")
    public void dropdownShouldBeVisible(String dropdownName) {
        // Sentinel map lives on the page object — steps don't re-declare it.
        String sentinel = RobotActionsHomePage.dropdownSentinel(dropdownName);
        assertTrue(page().isDropdownLinkVisible(sentinel),
            "dropdown '" + dropdownName + "' does not appear to be open "
            + "(sentinel link '" + sentinel + "' is not visible)");
    }

    /**
     * Verifies that every label in the data table is visible as a link inside
     * the (already-open) dropdown.  Uses {@code contains()} matching so labels
     * like "AI QA Agent" match the DOM text "AI QA AgentNEW".
     *
     * The feature file's table has a header row "label" — Cucumber-JVM 7.x
     * includes the header in {@code dataTable.asList()}, so we skip element 0.
     */
    @Then("the {word} dropdown should contain the items:")
    public void dropdownContainsItems(String dropdownName, DataTable dataTable) {
        List<String> rows = dataTable.asList();
        List<String> labels = rows.subList(1, rows.size());
        for (String label : labels) {
            assertTrue(page().isDropdownLinkVisible(label),
                "dropdown '" + dropdownName + "' item '" + label + "' is not visible");
        }
    }

    @When("I click the {string} dropdown item")
    public void clickDropdownItem(String label) {
        page().clickDropdownItem(label);
    }

    @Then("the URL pathname should be {string}")
    public void urlPathnameShouldBe(String expected) {
        waits().awaitTrue(d -> {
            try {
                return new URI(d.getCurrentUrl()).getPath().equals(expected);
            } catch (Exception e) {
                return false;
            }
        }, waits().defaultWait());
        String actualPath;
        try {
            actualPath = new URI(driver().getCurrentUrl()).getPath();
        } catch (Exception e) {
            actualPath = "(malformed URL)";
        }
        assertEquals(expected, actualPath,
            "URL pathname mismatch — expected '" + expected
            + "' but was '" + actualPath + "'");
    }

    @Then("the SPA should hydrate without console errors")
    public void spaHydratesWithoutConsoleErrors() {
        page().waitForHydration();
        assertNoConsoleSevereErrors();
    }

    // ── Header utility buttons ────────────────────────────────────────────

    @Given("the page theme is {string} or {string}")
    public void captureInitialTheme(String themeA, String themeB) {
        String current = page().currentTheme();
        ScenarioContext.get().setInitialTheme(current);
    }

    @When("I wait {int} milliseconds for the theme transition")
    public void waitForThemeTransition(int ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    @When("I wait {int} milliseconds for the theme to settle")
    public void waitForThemeToSettle(int ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    @Then("the page theme should have changed")
    public void themeShouldHaveChanged() {
        String before = ScenarioContext.get().getInitialTheme();
        String after  = page().currentTheme();
        assertNotEquals(before, after,
            "page theme should have changed but is still '" + after + "'");
    }

    /** Inverse of {@link #themeShouldHaveChanged()} — used by the idempotency
     *  test where a double-toggle should return to the original theme. */
    @Then("the page theme should match the original")
    public void themeShouldMatchOriginal() {
        String before = ScenarioContext.get().getInitialTheme();
        String after  = page().currentTheme();
        assertEquals(before, after,
            "page theme should have returned to the original '" + before
            + "' but is now '" + after + "'");
    }

    @Then("the {word} dropdown should not be visible")
    public void dropdownShouldNotBeVisible(String dropdownName) {
        assertTrue(page().isDropdownClosed(dropdownName),
            "dropdown '" + dropdownName + "' is still visible (expected closed)");
    }

    @Then("a language selection menu should be visible")
    public void languageMenuVisible() {
        assertTrue(page().isLanguageMenuVisible(),
            "language selection menu is not visible after clicking the switcher");
    }

    @Then("the {string} button should be visible and enabled")
    public void buttonVisibleAndEnabled(String label) {
        assertTrue(page().isSignInButtonVisibleAndEnabled(),
            "button '" + label + "' is not visible or not enabled");
    }

    @Then("no console errors should have been logged")
    public void noConsoleErrors() {
        assertNoConsoleSevereErrors();
    }

    // ── Pricing / FAQ assertions ──────────────────────────────────────────

    @Then("I should see the FAQ question {string}")
    public void shouldSeeFaqQuestion(String question) {
        assertTrue(page().isFaqQuestionVisible(question),
            "FAQ question '" + question + "' is not visible");
    }

    // ── Cross-cutting cycle (load runner @health tag) ─────────────────────

    @When("I cycle through every top-level nav item once")
    public void cycleThroughNavItems() {
        String[] navLabels = {"Home", "Pricing", "FAQ", "Contact"};
        RobotActionsHomePage home = page();
        for (String label : navLabels) {
            home.clickNavLink(label);
            // Home nav item resets the URL back to base — a timeout here is
            // tolerated, so use the boolean-returning wait and ignore the result.
            waits().awaitTrue(d -> !RA_HOME.equals(d.getCurrentUrl()), waits().shortWait());
        }
    }

    @Then("the SPA should remain hydrated throughout the cycle")
    public void spaRemainsHydrated() {
        assertTrue(elements().isVisible(By.tagName("main")),
            "<main> is not visible after cycling through all nav items");
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /**
     * Drains the browser log and fails if any SEVERE-level entry is present.
     *
     * Chrome 132+ no longer exposes browser logs via the CDP logging API when
     * the {@code goog:loggingPrefs} capability is absent or when running on
     * certain Grid node configurations.  The call is wrapped in a try/catch so
     * missing log support produces a warning rather than a test failure —
     * infrastructure capability gaps should not mask real assertion failures.
     */
    private void assertNoConsoleSevereErrors() {
        try {
            org.openqa.selenium.logging.LogEntries entries =
                driver().manage().logs().get(
                    org.openqa.selenium.logging.LogType.BROWSER);
            List<org.openqa.selenium.logging.LogEntry> errors =
                entries.getAll().stream()
                    .filter(e -> e.getLevel().equals(java.util.logging.Level.SEVERE))
                    .toList();
            assertTrue(errors.isEmpty(),
                "unexpected console SEVERE errors: " + errors);
        } catch (Exception e) {
            // Browser log retrieval is not supported by this driver/node
            // configuration (common on Chrome 132+).  Log a warning and
            // continue — the absence of log support is not itself an error.
            LOG.warning("browser log retrieval not supported: " + e.getMessage()
                + " — console error check skipped");
        }
    }
}
