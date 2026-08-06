from playwright.sync_api import Page, Locator, expect
from pages.base_page import BasePage


# Stable H1 rotation set — any one of these may be displayed at load time
# The hero H1 is a rotation, so this stays a list — but the three phrases the
# template shipped with are no longer served. Re-probed 2026-08-05 over five
# loads and only this one appeared; add variants here as they reappear rather
# than asserting a single string.
HERO_H1_VARIANTS = [
    "Real devices, zero lag.",
]

HERO_TAGLINE = "No credit card required • Cancel anytime • 30-day free trial"


class HomePage(BasePage):
    """Page object for the robotactions.com marketing homepage.

    Every selector lives in the block below; the accessors underneath build
    Playwright locators from them. No selector string appears inside a method.
    """

    # ── Selectors ─────────────────────────────────────────────────────────
    HERO_HEADING = "h1"
    SERVICES_SECTION = "#services"
    PRICING_SECTION = "#pricing"
    FAQ_SECTION = "#faq"
    CONTACT_SECTION = "#contact"
    CONTACT_FORM = "#contact form"

    # Accessible names / placeholders used as locator arguments.
    SIGN_IN_NAME = "Sign in / Sign up"
    START_TRIAL_NAME = "Start Free Trial"
    CONTACT_NAME_PLACEHOLDER = "Enter your name"
    CONTACT_EMAIL_PLACEHOLDER = "Enter your email address"

    def __init__(self, page: Page, base_url: str = "") -> None:
        super().__init__(page, base_url)

    def open(self) -> None:
        super().open("/")

    # ------------------------------------------------------------------ #
    # Navigation
    # ------------------------------------------------------------------ #

    def nav_link(self, name: str) -> Locator:
        """Return the visible nav <a> with the given link text."""
        return self.page.get_by_role("navigation").get_by_role("link", name=name)

    def sign_in_button(self) -> Locator:
        """Visible 'Sign in / Sign up' button (may be in nav or mobile menu)."""
        # There are two in DOM (desktop + mobile variants); pick the visible one.
        return self.page.get_by_role("button", name=self.SIGN_IN_NAME).last

    def start_free_trial_button(self) -> Locator:
        return self.page.get_by_role("button", name=self.START_TRIAL_NAME)

    # ------------------------------------------------------------------ #
    # Hero section
    # ------------------------------------------------------------------ #

    def hero_tagline(self) -> Locator:
        """Stable sub-tagline that never rotates."""
        return self.page.get_by_text(HERO_TAGLINE, exact=True)

    def hero_h1_is_one_of_variants(self) -> bool:
        """Return True if the current H1 text matches one of the known rotation variants."""
        h1 = self.page.locator(self.HERO_HEADING).first
        current = h1.inner_text().replace("\n", "")
        return any(variant.replace("\n", "") in current.replace(" ", "") or
                   current.replace(" ", "") in variant.replace(" ", "")
                   for variant in HERO_H1_VARIANTS)

    # ------------------------------------------------------------------ #
    # Section anchors
    # ------------------------------------------------------------------ #

    def services_section(self) -> Locator:
        return self.page.locator(self.SERVICES_SECTION)

    def pricing_section(self) -> Locator:
        return self.page.locator(self.PRICING_SECTION)

    def faq_section(self) -> Locator:
        return self.page.locator(self.FAQ_SECTION)

    def contact_section(self) -> Locator:
        return self.page.locator(self.CONTACT_SECTION)

    # ------------------------------------------------------------------ #
    # Pricing
    # ------------------------------------------------------------------ #

    def pricing_tier_heading(self, name: str) -> Locator:
        return self.pricing_section().get_by_role("heading", name=name, level=3)

    # ------------------------------------------------------------------ #
    # FAQ
    # ------------------------------------------------------------------ #

    def faq_accordion_button(self, question: str) -> Locator:
        return self.faq_section().get_by_role("button", name=question)

    # ------------------------------------------------------------------ #
    # Contact form
    # ------------------------------------------------------------------ #

    def contact_form(self) -> Locator:
        return self.page.locator(self.CONTACT_FORM)

    def contact_name_input(self) -> Locator:
        return self.page.get_by_placeholder(self.CONTACT_NAME_PLACEHOLDER)

    def contact_email_input(self) -> Locator:
        return self.page.get_by_placeholder(self.CONTACT_EMAIL_PLACEHOLDER)
