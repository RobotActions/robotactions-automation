"""Mobile-web BDD: RobotActions in the browser on a real handset via Appium.

Uses the shared platform-aware ``driver`` fixture from conftest, so one env var
picks the browser — ``PLATFORM=mobileweb`` (Chrome/Android) or
``PLATFORM=ios-mobileweb`` (Safari/iOS). The session is built with
``appium:browserName`` rather than the W3C ``browserName``; see conftest for why
the W3C form matches no grid slot.

Locators live in :class:`pages.robotactions_mobileweb.RobotActionsMobileWebPage`
— never in this file. Step text is prefixed "mobile" so it cannot collide with
the desktop glue, and is browser-neutral so an iOS run is not reported as
Android.
"""

from __future__ import annotations

import pytest
from pytest_bdd import given, parsers, scenarios, then, when
from selenium.webdriver.remote.webdriver import WebDriver

from pages.robotactions_mobileweb import HERO_TAGLINE, RobotActionsMobileWebPage

scenarios("robotactions-mobileweb.feature")


@pytest.fixture()
def page(driver: WebDriver) -> RobotActionsMobileWebPage:
    """Mobile page object bound to the platform-aware driver."""
    return RobotActionsMobileWebPage(driver)


@pytest.fixture()
def theme_state() -> dict:
    """Per-scenario carrier for the theme observed before any toggle."""
    return {"value": None}


# ── Navigation ────────────────────────────────────────────────────────────

@given("I open RobotActions in the device browser")
def open_device_browser(page: RobotActionsMobileWebPage) -> None:
    page.open_home_page()


@given("I wait for the mobile SPA to hydrate")
def wait_for_hydration(page: RobotActionsMobileWebPage) -> None:
    page.wait_for_hydration()


@when(parsers.parse('I open the mobile path "{path}"'))
def open_mobile_path(page: RobotActionsMobileWebPage, path: str) -> None:
    page.open_path(path)


@then(parsers.parse('the mobile page title should contain "{fragment}"'))
def title_contains(page: RobotActionsMobileWebPage, fragment: str) -> None:
    # Waits: on an SPA the title is set by the client router after the
    # navigation resolves, so a bare read can return the previous page's.
    assert page.await_title_contains(fragment), (
        f"title {page.title!r} missing {fragment!r}")


@then(parsers.parse('the mobile page should show the "{fragment}" URL'))
def url_contains(page: RobotActionsMobileWebPage, fragment: str) -> None:
    assert fragment in page.current_url, (
        f"url {page.current_url!r} missing {fragment!r}")


@then(parsers.parse('the mobile page text should mention "{word}"'))
def text_mentions(page: RobotActionsMobileWebPage, word: str) -> None:
    body = page.body_text()
    assert word.lower() in body.lower(), f"page text missing {word!r}"


@then(parsers.parse('the mobile URL fragment should be "{fragment}"'))
def url_fragment_is(page: RobotActionsMobileWebPage, fragment: str) -> None:
    assert page.current_url.endswith(fragment), (
        f"expected URL to end with {fragment!r}, got {page.current_url!r}")


# ── Mobile menu ───────────────────────────────────────────────────────────

@when("I tap the mobile menu button")
def tap_menu_button(page: RobotActionsMobileWebPage) -> None:
    page.open_mobile_menu()


@then("the mobile menu should be open")
def menu_open(page: RobotActionsMobileWebPage) -> None:
    assert page.is_mobile_menu_open(), (
        "mobile menu did not open (no nav link visible after tapping the trigger)")


@then("the mobile menu should be closed")
def menu_closed(page: RobotActionsMobileWebPage) -> None:
    assert page.is_mobile_menu_closed(), (
        "mobile menu is still open (a nav link is still visible)")


@then(parsers.parse('the mobile menu should show the "{label}" link'))
def menu_shows_link(page: RobotActionsMobileWebPage, label: str) -> None:
    assert page.is_menu_link_visible(label), f"menu link {label!r} is not visible"


@when(parsers.parse('I tap the "{label}" link in the mobile menu'))
def tap_menu_link(page: RobotActionsMobileWebPage, label: str) -> None:
    page.tap_menu_link(label)


# ── Layout ────────────────────────────────────────────────────────────────

@then("the mobile page should not scroll horizontally")
def no_horizontal_scroll(page: RobotActionsMobileWebPage) -> None:
    # A couple of pixels of slack: device pixel-ratio rounding can leave a
    # sub-pixel difference that is not a real layout overflow.
    overflow = page.horizontal_overflow_px()
    assert overflow <= 2, f"page overflows the viewport horizontally by {overflow}px"


@then(parsers.parse('the mobile viewport meta tag should contain "{fragment}"'))
def viewport_meta_contains(page: RobotActionsMobileWebPage, fragment: str) -> None:
    content = page.viewport_meta_content()
    assert content and fragment in content, (
        f"viewport meta {content!r} does not contain {fragment!r}")


@then(parsers.parse('the mobile section with id "{section_id}" should be in viewport'))
def section_in_viewport(page: RobotActionsMobileWebPage, section_id: str) -> None:
    assert page.is_section_in_viewport(section_id), (
        f"section #{section_id} is not in the viewport")


# ── Content ───────────────────────────────────────────────────────────────

@then("the mobile hero heading should not be empty")
def hero_heading_not_empty(page: RobotActionsMobileWebPage) -> None:
    text = page.hero_heading_text()
    assert text and len(text.strip()) > 3, f"hero heading is empty or too short: {text!r}"


@then("the mobile hero tagline should be visible")
def hero_tagline_visible(page: RobotActionsMobileWebPage) -> None:
    assert page.is_hero_tagline_visible(), (
        f"hero tagline containing {HERO_TAGLINE!r} is not visible")


@then(parsers.parse('I should see the mobile "{label}" button'))
def mobile_button_visible(page: RobotActionsMobileWebPage, label: str) -> None:
    assert page.is_button_visible(label), f"button {label!r} is not visible on mobile"


@then(parsers.parse('the mobile "{tier}" pricing tier should be visible'))
def pricing_tier_visible(page: RobotActionsMobileWebPage, tier: str) -> None:
    assert page.is_pricing_tier_visible(tier), (
        f"pricing tier {tier!r} is not visible on mobile")


# ── FAQ accordion ─────────────────────────────────────────────────────────

@then(parsers.parse('I should see the mobile FAQ question "{question}"'))
def faq_question_visible(page: RobotActionsMobileWebPage, question: str) -> None:
    assert page.is_faq_question_visible(question), (
        f"FAQ question {question!r} is not visible on mobile")


@then(parsers.parse('the mobile FAQ question "{question}" should toggle when tapped'))
def faq_question_toggles(page: RobotActionsMobileWebPage, question: str) -> None:
    assert page.faq_question_toggles_on_tap(question), (
        f"FAQ question {question!r} did not toggle on tap (aria-expanded never changed)")


# ── Header controls ───────────────────────────────────────────────────────

@when(parsers.parse('I select the "{choice}" theme on mobile'))
def select_theme(page: RobotActionsMobileWebPage, theme_state: dict, choice: str) -> None:
    theme_state["value"] = page.current_theme()
    page.select_theme(choice)


@then(parsers.parse('the mobile theme should be "{expected}"'))
def theme_should_be(page: RobotActionsMobileWebPage, expected: str) -> None:
    assert page.current_theme() == expected, (
        f"mobile theme did not switch to {expected!r}")


@when("I tap the mobile language switcher")
def tap_language_switcher(page: RobotActionsMobileWebPage) -> None:
    page.open_language_menu()


@then(parsers.parse('the mobile menu item "{label}" should be visible'))
def menu_item_visible(page: RobotActionsMobileWebPage, label: str) -> None:
    assert page.is_menu_item_visible(label), f"menu item {label!r} is not visible"


@then(parsers.parse('the mobile "{label}" button should be visible and enabled'))
def sign_in_visible_enabled(page: RobotActionsMobileWebPage, label: str) -> None:
    assert page.is_sign_in_visible_and_enabled(), (
        f"button {label!r} is not visible or not enabled on mobile")
