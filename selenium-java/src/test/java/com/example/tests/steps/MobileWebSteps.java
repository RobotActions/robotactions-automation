package com.example.tests.steps;

import com.example.tests.config.DriverHolder;
import com.example.tests.pages.RobotActionsMobileWebPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Mobile-web steps: RobotActions in Chrome on a real Android device via
 * Appium + the Grid's device-node browserName=chrome slot. The driver is built
 * by DriverFactory.createMobileWeb() when PLATFORM=mobileweb (see Hooks).
 *
 * <p>All step text is prefixed "mobile" so it never collides with the desktop
 * glue in {@link RobotActionsLoadSteps} — Cucumber scans the whole
 * {@code com.example.tests.steps} package, and two identical patterns would be
 * a DuplicateStepDefinitionException.
 *
 * <p>Locators live in {@link RobotActionsMobileWebPage}; DOM reads go through
 * the shared element handler, which waits.
 */
public class MobileWebSteps {

    private WebDriver driver() {
        return DriverHolder.get();
    }

    private RobotActionsMobileWebPage page() {
        return new RobotActionsMobileWebPage(driver());
    }

    // ── Navigation ────────────────────────────────────────────────────────

    @Given("I open RobotActions in the device browser")
    public void openMobile() {
        page().openHomePage();
    }

    @Given("I wait for the mobile SPA to hydrate")
    public void waitForMobileHydration() {
        page().waitForHydration();
    }

    @When("I open the mobile path {string}")
    public void openMobilePath(String path) {
        page().openPath(path);
    }

    @Then("the mobile page title should contain {string}")
    public void titleContains(String fragment) {
        RobotActionsMobileWebPage page = page();
        // Waits: on an SPA the title is set by the client router after the
        // navigation resolves, so a bare read can return the previous page's.
        boolean matched = page.awaitTitleContains(fragment);
        assertTrue(matched,
            "title '" + page.title() + "' missing '" + fragment + "'");
    }

    @Then("the mobile page should show the {string} URL")
    public void urlContains(String fragment) {
        String url = page().currentUrl();
        assertTrue(url != null && url.contains(fragment),
            "url '" + url + "' missing '" + fragment + "'");
    }

    @Then("the mobile page text should mention {string}")
    public void textMentions(String word) {
        String body = page().bodyText();
        assertTrue(body.toLowerCase().contains(word.toLowerCase()),
            "page text missing '" + word + "'");
    }

    @Then("the mobile URL fragment should be {string}")
    public void mobileUrlFragmentShouldBe(String fragment) {
        String url = page().currentUrl();
        assertTrue(url.endsWith(fragment),
            "expected URL to end with '" + fragment + "' but was '" + url + "'");
    }

    // ── Mobile menu ───────────────────────────────────────────────────────

    @When("I tap the mobile menu button")
    public void tapMenuButton() {
        page().openMobileMenu();
    }

    @Then("the mobile menu should be open")
    public void mobileMenuOpen() {
        assertTrue(page().isMobileMenuOpen(),
            "mobile menu did not open (no nav link is visible after tapping the trigger)");
    }

    @Then("the mobile menu should be closed")
    public void mobileMenuClosed() {
        assertTrue(page().isMobileMenuClosed(),
            "mobile menu is still open (a nav link is still visible)");
    }

    @Then("the mobile menu should show the {string} link")
    public void mobileMenuShowsLink(String label) {
        assertTrue(page().isMenuLinkVisible(label),
            "mobile menu link '" + label + "' is not visible");
    }

    @When("I tap the {string} link in the mobile menu")
    public void tapMenuLink(String label) {
        page().tapMenuLink(label);
    }

    // ── Layout ────────────────────────────────────────────────────────────

    @Then("the mobile page should not scroll horizontally")
    public void noHorizontalScroll() {
        // A couple of pixels of slack: device pixel-ratio rounding can leave a
        // sub-pixel difference that is not a real layout overflow.
        long overflow = page().horizontalOverflowPx();
        assertTrue(overflow <= 2,
            "page overflows the viewport horizontally by " + overflow + "px");
    }

    @Then("the mobile viewport meta tag should contain {string}")
    public void viewportMetaContains(String fragment) {
        String content = page().viewportMetaContent();
        assertTrue(content != null && content.contains(fragment),
            "viewport meta '" + content + "' does not contain '" + fragment + "'");
    }

    @Then("the mobile section with id {string} should be in viewport")
    public void mobileSectionInViewport(String id) {
        assertTrue(page().isSectionInViewport(id),
            "section #" + id + " is not in the viewport");
    }

    // ── Content assertions ────────────────────────────────────────────────

    @Then("the mobile hero tagline should be visible")
    public void mobileHeroTagline() {
        assertTrue(page().isHeroTaglineVisible(),
            "hero tagline containing '" + RobotActionsMobileWebPage.HERO_TAGLINE
            + "' is not visible");
    }

    @Then("the mobile hero heading should not be empty")
    public void mobileHeroHeadingNotEmpty() {
        String text = page().heroHeadingText();
        assertTrue(text != null && text.trim().length() > 3,
            "hero heading is empty or too short: '" + text + "'");
    }

    @Then("I should see the mobile {string} button")
    public void shouldSeeMobileButton(String label) {
        assertTrue(page().isButtonVisible(label),
            "button '" + label + "' is not visible on mobile");
    }

    @Then("I should see the mobile heading {string}")
    public void shouldSeeMobileHeading(String text) {
        assertTrue(page().isHeadingVisible(text),
            "heading '" + text + "' is not visible on mobile");
    }

    @Then("the mobile {string} pricing tier should be visible")
    public void pricingTierVisible(String name) {
        assertTrue(page().isPricingTierVisible(name),
            "pricing tier '" + name + "' is not visible on mobile");
    }

    // ── FAQ accordion ─────────────────────────────────────────────────────

    @Then("I should see the mobile FAQ question {string}")
    public void mobileFaqQuestionVisible(String question) {
        assertTrue(page().isFaqQuestionVisible(question),
            "FAQ question '" + question + "' is not visible on mobile");
    }

    @When("I tap the mobile FAQ question {string}")
    public void tapFaqQuestion(String question) {
        page().tapFaqQuestion(question);
    }

    /**
     * Asserts the accordion responds to the tap by flipping {@code aria-expanded},
     * rather than asserting it ends up expanded — the initial state differs
     * between devices (see {@code RobotActionsMobileWebPage#faqQuestionTogglesOnTap}).
     */
    @Then("the mobile FAQ question {string} should toggle when tapped")
    public void faqQuestionToggles(String question) {
        assertTrue(page().faqQuestionTogglesOnTap(question),
            "FAQ question '" + question + "' did not toggle on tap (aria-expanded never changed)");
    }

    // ── Header controls ───────────────────────────────────────────────────

    @Given("the mobile theme is recorded")
    public void recordMobileTheme() {
        ScenarioContext.get().setInitialTheme(page().currentTheme());
    }

    @When("I select the {string} theme on mobile")
    public void selectMobileTheme(String choice) {
        page().selectTheme(choice);
    }

    @Then("the mobile theme should be {string}")
    public void mobileThemeShouldBe(String expected) {
        assertEquals(expected, page().currentTheme(),
            "mobile theme did not switch to '" + expected + "'");
    }

    @Then("the mobile theme should differ from the recorded one")
    public void mobileThemeChanged() {
        assertNotEquals(ScenarioContext.get().getInitialTheme(), page().currentTheme(),
            "mobile theme did not change");
    }

    @When("I tap the mobile language switcher")
    public void tapLanguageSwitcher() {
        page().openLanguageMenu();
    }

    @Then("the mobile menu item {string} should be visible")
    public void menuItemVisible(String label) {
        assertTrue(page().isMenuItemVisible(label),
            "menu item '" + label + "' is not visible");
    }

    @Then("the mobile {string} button should be visible and enabled")
    public void mobileSignInEnabled(String label) {
        assertTrue(page().isSignInVisibleAndEnabled(),
            "button '" + label + "' is not visible or not enabled on mobile");
    }
}
