"""
BDD step definitions for features/homepage.feature
"""
from playwright.sync_api import expect
from pytest_bdd import scenarios, given, when, then, parsers
from pages.home_page import HomePage

scenarios("homepage.feature")


# ------------------------------------------------------------------ #
# Background
# ------------------------------------------------------------------ #

@given("I am on the robotactions homepage")
def go_to_homepage(home_page: HomePage) -> None:
    home_page.open()


# ------------------------------------------------------------------ #
# Then — title / meta
# ------------------------------------------------------------------ #

@then(parsers.parse('the page title should contain "{text}"'))
def page_title_contains(page, text: str) -> None:
    assert text in page.title(), f"Expected '{text}' in title, got '{page.title()}'"


# ------------------------------------------------------------------ #
# Then — hero
# ------------------------------------------------------------------ #

@then("I should see the stable hero tagline")
def see_hero_tagline(home_page: HomePage) -> None:
    expect(home_page.hero_tagline()).to_be_visible()


@then(parsers.parse('the "{label}" button is visible'))
def cta_button_visible(home_page: HomePage, label: str) -> None:
    if label == "Start Free Trial":
        expect(home_page.start_free_trial_button()).to_be_visible()
    elif label == "Sign in / Sign up":
        expect(home_page.sign_in_button()).to_be_visible()
    else:
        raise ValueError(f"Unknown button label: {label}")


# ------------------------------------------------------------------ #
# Then — navigation
# ------------------------------------------------------------------ #

@then(parsers.parse('the nav contains a link to "{name}"'))
def nav_has_link(home_page: HomePage, name: str) -> None:
    expect(home_page.nav_link(name)).to_be_visible()


# ------------------------------------------------------------------ #
# Then — section anchors
# ------------------------------------------------------------------ #

@then(parsers.parse('the page has a section with id "{section_id}"'))
def page_has_section(page, section_id: str) -> None:
    locator = page.locator(f"#{section_id}")
    assert locator.count() > 0, f"No element with id '{section_id}' found on page"


# ------------------------------------------------------------------ #
# When — scroll helpers
# ------------------------------------------------------------------ #

@when("I scroll to the pricing section")
def scroll_to_pricing(home_page: HomePage) -> None:
    home_page.pricing_section().scroll_into_view_if_needed()


@when("I scroll to the FAQ section")
def scroll_to_faq(home_page: HomePage) -> None:
    home_page.faq_section().scroll_into_view_if_needed()


@when("I scroll to the contact section")
def scroll_to_contact(home_page: HomePage) -> None:
    home_page.contact_section().scroll_into_view_if_needed()


# ------------------------------------------------------------------ #
# Then — pricing
# ------------------------------------------------------------------ #

@then(parsers.parse('the pricing section shows tier "{tier}"'))
def pricing_shows_tier(home_page: HomePage, tier: str) -> None:
    expect(home_page.pricing_tier_heading(tier)).to_be_visible()


# ------------------------------------------------------------------ #
# Then — FAQ
# ------------------------------------------------------------------ #

@then(parsers.parse('the FAQ contains question "{question}"'))
def faq_has_question(home_page: HomePage, question: str) -> None:
    expect(home_page.faq_accordion_button(question)).to_be_visible()


# ------------------------------------------------------------------ #
# Then — contact
# ------------------------------------------------------------------ #

@then("the contact section contains a form")
def contact_has_form(home_page: HomePage) -> None:
    expect(home_page.contact_form()).to_be_visible()


@then("the contact form has a name field")
def contact_has_name_field(home_page: HomePage) -> None:
    expect(home_page.contact_name_input()).to_be_visible()


@then("the contact form has an email field")
def contact_has_email_field(home_page: HomePage) -> None:
    expect(home_page.contact_email_input()).to_be_visible()
