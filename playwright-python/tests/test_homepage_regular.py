"""
Regular pytest tests (non-BDD) for the robotactions.com homepage.
Run with: pytest tests/test_homepage_regular.py -v
"""
import pytest
from playwright.sync_api import Page, expect

from pages.home_page import HomePage, HERO_H1_VARIANTS, HERO_TAGLINE


BASE_URL = "https://robotactions.com"


class TestHomepageDesktop:
    """Desktop viewport (1280x720) tests."""

    def test_page_title(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        assert "RobotActions" in page.title()

    def test_hero_tagline_visible(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        expect(hp.hero_tagline()).to_be_visible()

    def test_hero_h1_is_known_variant(self, page: Page, base_url: str) -> None:
        """H1 rotates — verify it is one of the three known phrases."""
        hp = HomePage(page, base_url)
        hp.open()
        h1_text = page.locator("h1").first.inner_text().replace("\n", "").replace(" ", "")
        normalized_variants = [v.replace("\n", "").replace(" ", "") for v in HERO_H1_VARIANTS]
        assert any(h1_text in v or v in h1_text for v in normalized_variants), (
            f"H1 text '{h1_text}' is not one of the known rotation variants"
        )

    def test_start_free_trial_button_visible(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        expect(hp.start_free_trial_button()).to_be_visible()

    def test_sign_in_button_visible(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        expect(hp.sign_in_button()).to_be_visible()

    def test_nav_links_present(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        for name in ("Home", "Pricing", "FAQ", "Contact"):
            expect(hp.nav_link(name)).to_be_visible(), f"Nav link '{name}' not visible"

    def test_all_section_anchors_exist(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        for section_id in ("#hero", "#services", "#pricing", "#faq", "#contact"):
            assert page.locator(section_id).count() > 0, f"Section '{section_id}' not found"

    def test_services_section_heading(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        hp.services_section().scroll_into_view_if_needed()
        # Stable h2 confirmed in site audit
        expect(page.locator("#services").get_by_role("heading", name="Test on Any Device, Any Platform")).to_be_visible()

    def test_pricing_free_tier(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        hp.pricing_section().scroll_into_view_if_needed()
        expect(hp.pricing_tier_heading("Free")).to_be_visible()

    def test_pricing_automation_tier(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        hp.pricing_section().scroll_into_view_if_needed()
        expect(hp.pricing_tier_heading("Automation")).to_be_visible()

    def test_pricing_enterprise_tier(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        hp.pricing_section().scroll_into_view_if_needed()
        expect(hp.pricing_tier_heading("Enterprise")).to_be_visible()

    def test_faq_first_question(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        hp.faq_section().scroll_into_view_if_needed()
        expect(hp.faq_accordion_button("What is RobotActions Device Farm?")).to_be_visible()

    def test_faq_second_question(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        hp.faq_section().scroll_into_view_if_needed()
        expect(hp.faq_accordion_button("How many devices can I test on simultaneously?")).to_be_visible()

    def test_faq_third_question(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        hp.faq_section().scroll_into_view_if_needed()
        expect(hp.faq_accordion_button("Do you provide real devices or emulators?")).to_be_visible()

    def test_contact_form_visible(self, page: Page, base_url: str) -> None:
        hp = HomePage(page, base_url)
        hp.open()
        hp.contact_section().scroll_into_view_if_needed()
        expect(hp.contact_form()).to_be_visible()
        expect(hp.contact_name_input()).to_be_visible()
        expect(hp.contact_email_input()).to_be_visible()


class TestHomepageMobile:
    """
    Mobile viewport (360x740) tests.
    pytest-playwright does not support per-class viewport overrides directly;
    we use a new context with the desired viewport inside each test.
    """

    @pytest.fixture(autouse=True)
    def mobile_page(self, context):
        """Override page fixture with a 360x740 viewport page."""
        mobile_ctx = context.browser.new_context(
            viewport={"width": 360, "height": 740},
            ignore_https_errors=True,
        )
        mobile_ctx.set_default_timeout(15000)
        mobile_ctx.set_default_navigation_timeout(30000)
        pg = mobile_ctx.new_page()
        self._mobile_page = pg
        yield pg
        pg.close()
        mobile_ctx.close()

    def test_page_loads_on_mobile(self, base_url: str) -> None:
        pg = self._mobile_page
        hp = HomePage(pg, base_url)
        hp.open()
        assert "RobotActions" in pg.title()

    def test_hero_tagline_visible_on_mobile(self, base_url: str) -> None:
        pg = self._mobile_page
        hp = HomePage(pg, base_url)
        hp.open()
        expect(hp.hero_tagline()).to_be_visible()

    def test_start_free_trial_visible_on_mobile(self, base_url: str) -> None:
        pg = self._mobile_page
        hp = HomePage(pg, base_url)
        hp.open()
        expect(hp.start_free_trial_button()).to_be_visible()

    def test_sign_in_not_surfaced_on_mobile(self, base_url: str) -> None:
        """Sign in / Sign up is a desktop-header affordance only.

        At 390px the header drops it — `Start Free Trial` is the mobile CTA
        (covered by the test above). Asserted rather than deleted so the
        breakpoint difference stays documented: if sign-in ever returns to the
        mobile header, this test fails and the coverage gets revisited.
        """
        pg = self._mobile_page
        hp = HomePage(pg, base_url)
        hp.open()
        expect(hp.sign_in_button()).to_have_count(0)
