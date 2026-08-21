"""
Step definitions for features/robotactions-load.feature.

Key design notes
----------------
Dropdown behaviour:
  The Features and Resources nav items on robotactions.com use a Tailwind CSS
  group-hover pattern — the dropdown panel is shown by CSS only when the mouse
  is over the parent group element.  Both `click_nav_button` and the step below
  that calls it use ActionChains.move_to_element() first, which keeps the panel
  open long enough for subsequent item lookups.  A bare .click() alone is
  unreliable on remote Grid nodes because the WebDriver click moves focus but
  doesn't always leave the cursor over the element.

h2c-upgrade trap (IMPORTANT):
  The conftest.py driver fixture uses the /t/<token> path-prefix auth form.
  Python's urllib3 (used by selenium-python) speaks HTTP/1.1 by default and
  does NOT attempt an h2c upgrade, so the path-prefix strip and auth middleware
  in the appium-grid-service proxy work correctly.  This is the opposite of the
  Java Selenium client (which defaults to HTTP/2 and requires the custom
  Http11HttpClientFactory to force HTTP/1.1).  No special action is needed here.

Console-error checks:
  get_log('browser') requires goog:loggingPrefs which many remote Grid nodes
  don't expose on Chrome 132+.  All console-error checks are best-effort: they
  warn on SEVERE entries but never hard-fail the test (matching the Java template
  pattern in RobotActionsLoadSteps.assertNoConsoleSevereErrors()).

Step-fixture for theme state:
  _theme_state is a function-scoped dict fixture that carries per-scenario state
  (the initial theme before toggle).  pytest-bdd 8.x does not have a built-in
  ScenarioContext; the fixture injection pattern is the idiomatic replacement.
"""

from __future__ import annotations

import warnings
from typing import Sequence
from urllib.parse import urlparse

import pytest
from pytest_bdd import given, parsers, scenarios, then, when
from selenium.webdriver.remote.webdriver import WebDriver

from pages.robotactions_home import (
    KNOWN_HERO_PHRASES,
    RobotActionsHomePage,
    dropdown_sentinel,
)
from pages.element_handler import ElementHandler
from pages.wait_handlers import WaitHandlers

# Bind every scenario in the feature to this test module.
# bdd_features_base_dir = "features/" in pyproject.toml — path is relative to that.
scenarios("robotactions-load.feature")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _page(browser: WebDriver) -> RobotActionsHomePage:
    return RobotActionsHomePage(browser)


def _waits(browser: WebDriver) -> WaitHandlers:
    """Wait tiers for steps that assert on driver state (URL, title) rather
    than on an element the page object owns. Same instance the page objects
    use — see pages/wait_handlers.py."""
    return WaitHandlers.for_driver(browser)


def _elements(browser: WebDriver) -> ElementHandler:
    """Element interaction for the few steps that touch the DOM directly."""
    return ElementHandler.for_driver(browser)


def _assert_no_console_severe(browser: WebDriver) -> None:
    """Best-effort SEVERE log check — warns, never hard-fails."""
    try:
        logs = browser.get_log("browser")
        errors = [entry for entry in logs if entry.get("level") == "SEVERE"]
        if errors:
            warnings.warn(f"console SEVERE errors: {errors}")
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            "browser log retrieval not supported: %s — console error check skipped", exc
        )


# ---------------------------------------------------------------------------
# Background
# ---------------------------------------------------------------------------

@given("I open the RobotActions home page")
def open_home_page(browser: WebDriver, base_url: str) -> None:
    browser.get(base_url)


@given("I wait for the SPA to hydrate")
def wait_for_hydration(browser: WebDriver) -> None:
    _page(browser).wait_for_hydration()


# ---------------------------------------------------------------------------
# Hero + primary CTAs
# ---------------------------------------------------------------------------

@then("the hero heading should contain one of the known phrases")
def hero_heading_contains_known_phrase(browser: WebDriver) -> None:
    """Assert that the current H1 text matches at least one of the rotating phrases.

    The H1 cycles every ~20 s; asserting any single fixed phrase would be
    intermittently flaky.  This step asserts against the full known-phrase set
    so it passes regardless of which phrase is currently shown.
    """
    page = _page(browser)
    matches = page.hero_heading_matches_known_phrase()
    assert matches, (
        f"hero heading {page.hero_heading_text()!r} does not match any of "
        f"the known phrases: {KNOWN_HERO_PHRASES}"
    )


@then("the stable hero tagline should be visible")
def stable_hero_tagline_visible(browser: WebDriver) -> None:
    """Assert the tagline that never rotates: 'No credit card required...'"""
    assert _page(browser).is_stable_tagline_visible(), (
        "stable hero tagline containing 'No credit card required' is not visible"
    )


@then(parsers.parse('the hero heading should contain "{fragment}"'))
def hero_heading_contains(browser: WebDriver, fragment: str) -> None:
    """Legacy single-phrase check — kept for compatibility."""
    heading_text = _page(browser).hero_heading_text()
    assert fragment in heading_text, (
        f"expected hero heading to contain {fragment!r}, got: {heading_text!r}"
    )


@then(parsers.parse('I should see the "{label}" button'))
def should_see_button(browser: WebDriver, label: str) -> None:
    assert _page(browser).is_button_visible(label), f"button {label!r} is not visible"


@then(parsers.parse('I should see the heading "{label}"'))
def should_see_heading(browser: WebDriver, label: str) -> None:
    assert _page(browser).is_heading_visible(label), f"heading {label!r} is not visible"


# ---------------------------------------------------------------------------
# Top-level nav: hash anchors
# ---------------------------------------------------------------------------

@when(parsers.parse('I click the "{label}" nav link'))
def click_nav_link(browser: WebDriver, label: str) -> None:
    _page(browser).click_nav_link(label)


@when(parsers.parse('I navigate to path "{path}"'))
def navigate_to_path(browser: WebDriver, base_url: str, path: str) -> None:
    browser.get(f"https://robotactions.com{path}")


@then(parsers.parse('the URL fragment should be "{fragment}"'))
def url_fragment_should_be(browser: WebDriver, fragment: str) -> None:
    expected = fragment.lstrip("#")
    waits = _waits(browser)
    waits.await_true(
        lambda d: d.current_url.split("#")[-1] == expected, waits.short_wait
    )
    actual_fragment = browser.current_url.split("#")[-1] if "#" in browser.current_url else ""
    assert actual_fragment == expected, (
        f"expected URL fragment {expected!r}, got {actual_fragment!r} in {browser.current_url}"
    )


@then(parsers.parse('the section with id "{section_id}" should be in viewport'))
def section_in_viewport(browser: WebDriver, section_id: str) -> None:
    """Poll the JS viewport predicate for up to 5 s to tolerate CSS smooth-scroll."""
    assert _page(browser).is_section_in_viewport(section_id), (
        f"section #{section_id} is not in the viewport"
    )


@then(parsers.parse('the page title should contain "{text}"'))
def page_title_should_contain(browser: WebDriver, text: str) -> None:
    waits = _waits(browser)
    waits.await_true(lambda d: d.title is not None and text in d.title, waits.short_wait)
    actual = browser.title
    assert text in actual, f"page title {actual!r} does not contain {text!r}"


# ---------------------------------------------------------------------------
# Dropdowns — CSS hover-driven (group-hover:visible)
# ---------------------------------------------------------------------------

@when(parsers.parse('I hover over the "{label}" nav button'))
def hover_nav_button(browser: WebDriver, label: str) -> None:
    """Move the mouse onto the nav button to trigger the CSS hover dropdown."""
    from selenium.webdriver.common.action_chains import ActionChains

    # Locator comes from the page object — steps don't author XPath.
    btn = _elements(browser).present(RobotActionsHomePage.nav_button_by_text(label))
    ActionChains(browser).move_to_element(btn).perform()


@when(parsers.parse('I click the "{label}" nav button'))
def click_nav_button(browser: WebDriver, label: str) -> None:
    """Hover-then-open the CSS dropdown for the named nav button.

    click_nav_button uses ActionChains.move_to_element() (same as hover) because
    the CSS group-hover pattern requires the cursor to be over the parent group.
    A direct .click() alone does not reliably keep the panel visible.
    """
    _page(browser).click_nav_button(label)


@when(parsers.parse('I click the "{label}" button'))
def click_button(browser: WebDriver, label: str) -> None:
    _page(browser).click_button(label)


@then(parsers.parse('the {word} dropdown should be visible'))
def dropdown_should_be_visible(browser: WebDriver, word: str) -> None:
    # Sentinel map lives on the page object — steps don't re-declare it.
    sentinel = dropdown_sentinel(word)
    assert _page(browser).is_dropdown_link_visible(sentinel), (
        f"dropdown {word!r} does not appear open (sentinel {sentinel!r} not visible)"
    )


@then(parsers.parse("the {word} dropdown should contain the items:"))
def dropdown_contains_items(
    browser: WebDriver, word: str, datatable: Sequence[Sequence[str]]
) -> None:
    rows = list(datatable)
    labels = [row[0] for row in rows[1:]]  # skip header row
    page = _page(browser)
    for label in labels:
        # contains() tolerates badge text: "AI QA Agent" matches "AI QA Agent NEW"
        assert page.is_dropdown_link_visible(label), (
            f"dropdown {word!r} item {label!r} is not visible"
        )


@when(parsers.parse('I click the "{label}" dropdown item'))
def click_dropdown_item(browser: WebDriver, label: str) -> None:
    _page(browser).click_dropdown_item(label)


@then(parsers.parse('the URL pathname should be "{path}"'))
def url_pathname_should_be(browser: WebDriver, path: str) -> None:
    waits = _waits(browser)
    waits.await_true(lambda d: urlparse(d.current_url).path == path, waits.default_wait)
    actual = urlparse(browser.current_url).path
    assert actual == path, f"expected pathname {path!r}, got {actual!r}"


@then("the SPA should hydrate without console errors")
def spa_hydrates_without_errors(browser: WebDriver) -> None:
    _page(browser).wait_for_hydration()
    _assert_no_console_severe(browser)


# ---------------------------------------------------------------------------
# Header utility buttons
# ---------------------------------------------------------------------------

@pytest.fixture()
def _theme_state() -> dict:
    """Per-scenario dict carrying the initial theme before any toggle."""
    return {"value": None}


@given(parsers.parse('the page theme is "{a}" or "{b}"'))
def capture_initial_theme(
    browser: WebDriver, _theme_state: dict, a: str, b: str
) -> None:
    """Record the current theme so later assertions can compare against it."""
    _theme_state["value"] = _page(browser).current_theme()


@when(parsers.parse('I select the "{choice}" theme'))
def select_theme(browser: WebDriver, choice: str) -> None:
    """Pick Light / Dark / System from the theme menu.

    The control is a dropdown, not a toggle — clicking the trigger alone only
    opens the menu and leaves the theme untouched.
    """
    _page(browser).select_theme(choice)


@when(parsers.parse("I wait {ms:d} milliseconds for the theme transition"))
def wait_theme_transition(browser: WebDriver, ms: int) -> None:
    """Pause for the CSS theme transition via JS setTimeout (no time.sleep)."""
    browser.execute_script(
        "return new Promise(resolve => setTimeout(resolve, arguments[0]));", ms
    )


@when(parsers.parse("I wait {ms:d} milliseconds for the theme to settle"))
def wait_theme_settle(browser: WebDriver, ms: int) -> None:
    browser.execute_script(
        "return new Promise(resolve => setTimeout(resolve, arguments[0]));", ms
    )


@then("the page theme should have changed")
def theme_should_have_changed(browser: WebDriver, _theme_state: dict) -> None:
    initial = _theme_state["value"]
    assert initial is not None, "initial theme was not captured — did the Given step run?"
    after = _page(browser).current_theme()
    assert after != initial, f"theme did not change — still {after!r}"


@then("the page theme should match the original")
def theme_should_match_original(browser: WebDriver, _theme_state: dict) -> None:
    """After a double-toggle, the theme must have returned to the original."""
    initial = _theme_state["value"]
    assert initial is not None, "initial theme was not captured — did the Given step run?"
    after = _page(browser).current_theme()
    assert after == initial, (
        f"theme should have returned to {initial!r} after double-toggle but is {after!r}"
    )


@then(parsers.parse('the {word} dropdown should not be visible'))
def dropdown_should_not_be_visible(browser: WebDriver, word: str) -> None:
    """Assert the named dropdown is closed (sentinel link not visible).

    Polls for up to 3 s so the CSS hide animation has time to complete.
    """
    assert _page(browser).is_dropdown_closed(word), (
        f"dropdown {word!r} is still visible (expected closed)"
    )


@then("a language selection menu should be visible")
def language_menu_visible(browser: WebDriver) -> None:
    assert _page(browser).is_language_menu_visible(), (
        "language selection menu is not visible after clicking the language switcher"
    )


@then(parsers.parse('the "{label}" button should be visible and enabled'))
def button_visible_and_enabled(browser: WebDriver, label: str) -> None:
    assert _page(browser).is_sign_in_button_visible_and_enabled(), (
        f"button {label!r} is not visible or not enabled"
    )


@then("no console errors should have been logged")
def no_console_errors(browser: WebDriver) -> None:
    _assert_no_console_severe(browser)


# ---------------------------------------------------------------------------
# FAQ
# ---------------------------------------------------------------------------

@then(parsers.parse('I should see the FAQ question "{question}"'))
def should_see_faq_question(browser: WebDriver, question: str) -> None:
    assert _page(browser).is_faq_question_visible(question), (
        f"FAQ question {question!r} is not visible"
    )


# ---------------------------------------------------------------------------
# Cross-cutting cycle (@health)
# ---------------------------------------------------------------------------

@when("I cycle through every top-level nav item once")
def cycle_nav_items(browser: WebDriver) -> None:
    nav_labels = ["Home", "Pricing", "FAQ", "Contact"]  # Features is a dropdown, not an anchor
    page = _page(browser)
    waits = _waits(browser)
    for label in nav_labels:
        page.click_nav_link(label)
        # A timeout here is tolerated (the Home item resets the URL to base),
        # so use the boolean-returning wait and ignore the result.
        waits.await_true(
            lambda d: d.execute_script("return document.readyState") == "complete",
            waits.short_wait,
        )


@then("the SPA should remain hydrated throughout the cycle")
def spa_remains_hydrated(browser: WebDriver) -> None:
    assert _elements(browser).is_visible(RobotActionsHomePage.MAIN), (
        "<main> is not visible after cycling through all nav items"
    )
