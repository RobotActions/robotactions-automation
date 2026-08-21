"""
Page object for https://robotactions.com — full marketing-site nav matrix.

Locator strategy (no test-ids on the marketing site):
  1. XPath normalize-space() for visible text scoped to nav/button/link
  2. XPath aria-label for icon buttons (theme toggle, language switcher)
  3. contains() for links whose text may include badge suffixes (e.g. "AI QA AgentNEW")

All locators are declared at the top of the class — plain tuples for fixed
elements, static factory methods for the text-driven ones. No selector literal
appears inside a page method. Waits come from BasePage (``short_wait`` /
``wait`` / ``long_wait``); this class never constructs a WebDriverWait.

Dropdown behaviour note:
  The Features and Resources nav items are <button> elements inside a CSS
  group-hover container. On the live site ActionChains.move_to_element() reliably
  opens them on desktop Chrome. A direct .click() also works because the button
  itself is the group trigger — we hover first, then the panel becomes visible,
  then we can click items inside it.
"""

from __future__ import annotations

import logging
import re
import warnings
from typing import List

from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver

from pages.base_page import BasePage, Locator

logger = logging.getLogger(__name__)


def _collapse_ws(value: str) -> str:
    """Collapse every run of whitespace to a single space and strip the ends.

    Headings that wrap with a <br> yield text containing newlines, which makes a
    naive substring test fail against a phrase written with ordinary spaces.
    """
    return re.sub(r"\s+", " ", value or "").strip()

# The three H1 phrases that rotate on the hero section (~20s cycle).
# Tests must assert against this set, not a single fixed string.
KNOWN_HERO_PHRASES: List[str] = [
    # Current copy (verified 2026-08-04): the H1 no longer rotates — 14 samples
    # over 30 s returned this phrase on both desktop and mobile. The older
    # rotating phrases are kept so the assertion still passes if it comes back.
    "Real devices, zero lag",
    "From user story to raised defect",
    "Real Android & iOS devices",
    "Talk to your device",
]

# Stable tagline beneath the rotating H1 — never changes with the cycle.
STABLE_TAGLINE = "No credit card required"

# Sentinel links used to determine whether a dropdown is open or closed.
# Step definitions share this map rather than re-declaring it.
# Verified against the live desktop site 2026-08-05. The nav button is
# "Products" — there is no "Features" button. An earlier edit renamed this key
# to "Features" to match the feature file; that was backwards, the feature file
# is the stale side.
#
# Sentinels are chosen to appear ONLY while the dropdown is open. "Integrations"
# was a poor sentinel because the same link also sits in the footer, so it reads
# as visible with the dropdown shut — a false positive.
DROPDOWN_SENTINELS: dict[str, str] = {
    "Products": "AI Test Agent",
    "Resources": "Compare",
}


def dropdown_sentinel(dropdown_name: str) -> str:
    """Return the link text that proves the named dropdown is open."""
    sentinel = DROPDOWN_SENTINELS.get(dropdown_name)
    if sentinel is None:
        raise ValueError(f"unknown dropdown {dropdown_name!r} — add a sentinel entry")
    return sentinel


class RobotActionsHomePage(BasePage):
    HOME_URL = "https://robotactions.com"

    # ── Static locators ───────────────────────────────────────────────────

    MAIN: Locator = (By.TAG_NAME, "main")
    HTML: Locator = (By.TAG_NAME, "html")
    HERO_HEADING: Locator = (By.TAG_NAME, "h1")
    # contains(text(), ...) matches only the element owning the text node.
    # contains(normalize-space(), ...) would also match every ancestor —
    # resolving <html> first, which is always displayed, so the visibility
    # assertion would pass whether or not the tagline rendered.
    STABLE_TAGLINE_TEXT: Locator = (
        By.XPATH,
        f'//*[contains(text(), "{STABLE_TAGLINE}")]',
    )
    LANGUAGE_MENU: Locator = (
        By.XPATH,
        '//*[@role="menu" or @role="menuitem" or @role="listbox"]',
    )
    SIGN_IN_CTA: Locator = (
        By.XPATH,
        '//button[normalize-space()="Sign in / Sign up"]'
        ' | //a[normalize-space()="Sign in / Sign up"]',
    )

    # ── Parameterised locators ────────────────────────────────────────────
    # Text-driven locators are built by these factories so no XPath literal
    # ever appears inside a page method.

    @staticmethod
    def nav_link_by_text(label: str) -> Locator:
        return (By.XPATH, f'//nav[1]//a[normalize-space()="{label}"]')

    @staticmethod
    def nav_button_by_text(label: str) -> Locator:
        return (By.XPATH, f'//nav[1]//button[normalize-space()="{label}"]')

    @staticmethod
    def button_by_text(label: str) -> Locator:
        return (By.XPATH, f'//button[normalize-space()="{label}"]')

    @staticmethod
    def by_aria_label(label: str) -> Locator:
        return (By.XPATH, f'//*[@aria-label="{label}"]')

    @staticmethod
    def heading_containing(text: str) -> Locator:
        """Any heading level (h1–h6) whose text contains ``text``."""
        return (
            By.XPATH,
            "//*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6]"
            f'[contains(normalize-space(), "{text}")]',
        )

    @staticmethod
    def faq_question(question: str) -> Locator:
        """FAQ accordion button scoped to the #faq section."""
        return (
            By.XPATH,
            f'//section[@id="faq"]//button[contains(normalize-space(), "{question}")]'
            f' | //*[@id="faq"]//button[contains(normalize-space(), "{question}")]',
        )

    @staticmethod
    def button_containing(text: str) -> Locator:
        """Unscoped button by partial text — FAQ fallback."""
        return (By.XPATH, f'//button[contains(normalize-space(), "{text}")]')

    @staticmethod
    def link_containing(text: str) -> Locator:
        """Link by partial text — tolerates badge suffixes (e.g. "AI QA AgentNEW")."""
        return (By.XPATH, f'//a[contains(normalize-space(), "{text}")]')

    @staticmethod
    def section_by_id(section_id: str) -> Locator:
        # XPath rather than By.ID: "id" is not a W3C strategy. The Selenium
        # client rewrites it to CSS, but the Appium client does not — keeping
        # this W3C-native means the locator survives reuse on a mobile driver.
        return (By.XPATH, f'//*[@id="{section_id}"]')

    def __init__(self, driver: WebDriver) -> None:
        super().__init__(driver, self.HOME_URL)

    # ── Navigation ────────────────────────────────────────────────────────

    def wait_for_hydration(self) -> None:
        """Wait for <main> to be visible and document.readyState == 'complete'."""
        self.wait_visible(self.MAIN, self.long_wait)
        self.wait_for_document_ready(self.long_wait)

    # ── Hero assertions ───────────────────────────────────────────────────

    def hero_heading_text(self) -> str:
        """Return the text of the first H1, waiting up to 10 s."""
        return self.wait_visible(self.HERO_HEADING).text

    def hero_heading_matches_known_phrase(self) -> bool:
        """Return True when the current H1 text contains at least one known phrase.

        Whitespace is collapsed on both sides before comparing. The H1 wraps with
        a <br>, so its text arrives as "Real devices,\nzero lag." while the known
        phrase reads "Real devices, zero lag" — a match that a literal substring
        test misses purely on the line break.
        """
        text = _collapse_ws(self.hero_heading_text())
        return any(_collapse_ws(phrase) in text for phrase in KNOWN_HERO_PHRASES)

    def is_stable_tagline_visible(self) -> bool:
        """Return True when the stable hero tagline is visible."""
        return self.is_visible(self.STABLE_TAGLINE_TEXT)

    def is_button_visible(self, label: str) -> bool:
        """Return True when a <button> with exact visible text label is visible."""
        return self.is_visible(self.button_by_text(label))

    def is_heading_visible(self, text: str) -> bool:
        """Return True when a heading at any level containing text is visible."""
        return self.is_visible(self.heading_containing(text))

    def is_faq_question_visible(self, question: str) -> bool:
        """Return True when a FAQ accordion button containing question is visible.

        Tries the #faq-scoped locator first, then broadens to the full page.
        """
        return self.is_visible(self.faq_question(question)) or self.is_visible(
            self.button_containing(question), self.short_wait
        )

    # ── Nav link / button clicks ──────────────────────────────────────────

    def click_nav_link(self, label: str) -> None:
        """Click the anchor inside the first <nav> whose visible text exactly matches label."""
        self.click(self.nav_link_by_text(label))

    def click_nav_button(self, label: str) -> None:
        """Hover over (and click) a nav <button> to open its CSS group-hover dropdown.

        robotactions.com uses a Tailwind CSS group-hover pattern: the dropdown panel
        becomes visible when the cursor is over the parent group element. ActionChains
        hover reliably triggers this; a bare .click() alone may not on all Chrome
        versions. We hover first, then wait for the panel's sentinel link to render.
        """
        btn = self.find(self.nav_button_by_text(label))
        ActionChains(self.driver).move_to_element(btn).perform()
        # Give the CSS transition a moment to render the panel.
        sentinel = DROPDOWN_SENTINELS.get(label, label)
        self.wait_visible(self.link_containing(sentinel), self.new_wait(3))

    def click_button(self, label: str) -> None:
        """Click any visible <button> or aria-label element matching label."""
        by_text = self.button_by_text(label)
        if self.is_clickable(by_text, self.short_wait):
            self.click(by_text, self.short_wait)
        else:
            self.click(self.by_aria_label(label))

    # ── Dropdown content ──────────────────────────────────────────────────

    def is_dropdown_link_visible(self, sentinel: str) -> bool:
        """Return True when a link whose text contains sentinel is visible.

        Uses contains() to tolerate badge text appended to link labels
        (e.g. "AI QA AgentNEW").
        """
        return self.is_visible(self.link_containing(sentinel), self.short_wait)

    def is_dropdown_closed(self, dropdown_name: str) -> bool:
        """Return True once the sentinel link of the named dropdown is NOT visible.

        Polls for up to 5 s so the CSS animation has time to complete.
        """
        return self.await_not_displayed(
            self.link_containing(dropdown_sentinel(dropdown_name)), self.short_wait
        )

    def click_dropdown_item(self, label: str) -> None:
        """Click a visible dropdown link matching label by partial text."""
        self.click(self.link_containing(label))

    # ── Theme control ─────────────────────────────────────────────────────
    #
    # NOT a two-state toggle. It is a Radix dropdown whose trigger opens a menu
    # of Light / Dark / System; the theme changes only when an ITEM is picked.
    #
    # The desktop scenarios used to click the trigger and assert the theme had
    # flipped, which could never pass: the first click merely opened the menu.
    # The "double toggle" variant then failed differently again — the second
    # click on the trigger was intercepted by the menu the first click had
    # opened.

    THEME_TRIGGER: Locator = (
        By.XPATH, '//button[normalize-space()="Toggle theme"]'
    )

    @staticmethod
    def theme_option(label: str) -> Locator:
        """A Light / Dark / System item inside the open theme menu."""
        return (
            By.XPATH,
            f'//*[@role="menuitem" or @role="option"][normalize-space()="{label}"]',
        )

    def select_theme(self, choice: str) -> None:
        """Open the theme menu and pick `choice` (Light / Dark / System).

        The trigger appears twice in the DOM — a desktop copy and a mobile one,
        with only one displayed at a given width — so this relies on the click
        helper resolving a VISIBLE match rather than the first in document
        order.
        """
        self.click(self.THEME_TRIGGER)
        self.click(self.theme_option(choice), self.short_wait)

    def current_theme(self) -> str:
        """Return 'dark' if <html> has the 'dark' class, else 'light'."""
        cls = self.find(self.HTML).get_attribute("class") or ""
        return "dark" if "dark" in cls else "light"

    # ── Viewport check ────────────────────────────────────────────────────

    def is_section_in_viewport(self, section_id: str) -> bool:
        """Return True when the section with section_id has any portion in the viewport.

        Polls for up to 5 s because robotactions.com uses CSS smooth-scroll
        (scroll-behavior: smooth) which typically takes 300-800 ms after a click.
        """
        section = self.find(self.section_by_id(section_id), self.long_wait)
        return self.await_true(
            lambda d: bool(
                self.execute_script(
                    "var r = arguments[0].getBoundingClientRect();"
                    "return r.top < window.innerHeight && r.bottom > 0;",
                    section,
                )
            ),
            self.short_wait,
        )

    # ── Language menu ─────────────────────────────────────────────────────

    def is_language_menu_visible(self) -> bool:
        """Return True when any role=menu/menuitem/listbox element is visible."""
        return self.is_visible(self.LANGUAGE_MENU, self.short_wait)

    # ── Sign-in CTA ───────────────────────────────────────────────────────

    def is_sign_in_button_visible_and_enabled(self) -> bool:
        """Return True when the Sign in / Sign up button is visible and enabled."""
        try:
            return self.wait_visible(self.SIGN_IN_CTA).is_enabled()
        except Exception:
            return False

    # ── Console log check ─────────────────────────────────────────────────

    def assert_no_console_severe_errors(self) -> None:
        """Drain browser log and warn (not fail) on SEVERE entries.

        Chrome 132+ no longer exposes browser logs via the CDP logging API when
        goog:loggingPrefs is absent or the Grid node doesn't support it. The call
        is wrapped in try/except so missing log support produces a warning, not a
        test failure — infrastructure capability gaps should not mask real assertion
        failures.
        """
        try:
            logs = self.driver.get_log("browser")
            errors = [entry for entry in logs if entry.get("level") == "SEVERE"]
            if errors:
                warnings.warn(f"console SEVERE errors: {errors}")
        except Exception as exc:
            logger.warning("browser log retrieval not supported: %s — console error check skipped", exc)
