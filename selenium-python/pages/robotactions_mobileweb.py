"""
Page object for https://robotactions.com as rendered in a mobile browser
(Appium on a real handset — ``PLATFORM=mobileweb`` or ``ios-mobileweb``).

Separate from :mod:`pages.robotactions_home` because the mobile layout is a
different page, not a narrower one:

* Every top-level nav link is hidden until the icon-only menu button is tapped —
  at a ~400px viewport ``nav a`` yields 0 visible links, 19 after the tap.
* There is no hover, so the desktop dropdown flows do not exist here.
* The theme control is a *dropdown* (Light / Dark / System), not a one-tap toggle.
* Several controls render twice — a hidden desktop node and a visible mobile one
  — so locators go through ``any_visible`` / ``click_any_visible``, never plain
  ``visible`` (which only inspects the first match and would time out).

All locators are declared at the top of the class: plain tuples for fixed
elements, static factory methods for the text-driven ones. No selector literal
appears inside a page method. Waits come from BasePage (``short_wait`` /
``wait`` / ``long_wait``); this class never constructs a WebDriverWait.
"""

from __future__ import annotations

from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver

from pages.base_page import BasePage
from pages.wait_handlers import Locator

HOME_URL = "https://robotactions.com"

# Sub-tagline beneath the hero heading — stable copy, safe to assert.
HERO_TAGLINE = "No credit card required"

# Synthesises the pointer + mouse sequence a real finger produces, with NO
# trailing click.
#
# The dropdown triggers open on pointerdown; a click afterwards is read as an
# outside-click dismissal and closes the menu again, so the sequence stops at
# mouseup. Measured on a real iPhone inside one safaridriver session
# (2026-08-04) against the language trigger: a WebDriver click, an
# execute_script click, and a W3C Actions touch tap ALL leave the menu closed;
# only this dispatched sequence opens it.
POINTER_TAP_JS = """
const el = arguments[0];
const r = el.getBoundingClientRect();
const o = {bubbles:true, cancelable:true, composed:true,
           clientX:r.x+r.width/2, clientY:r.y+r.height/2, button:0, buttons:1,
           pointerId:1, pointerType:'touch', isPrimary:true};
el.dispatchEvent(new PointerEvent('pointerover', o));
el.dispatchEvent(new PointerEvent('pointerenter', o));
el.dispatchEvent(new PointerEvent('pointerdown', o));
el.dispatchEvent(new MouseEvent('mousedown', o));
el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, {buttons:0})));
el.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, o, {buttons:0})));
"""


class RobotActionsMobileWebPage(BasePage):
    # ── Static locators ───────────────────────────────────────────────────

    MAIN: Locator = (By.TAG_NAME, "main")
    BODY: Locator = (By.TAG_NAME, "body")
    HTML: Locator = (By.TAG_NAME, "html")
    HERO_HEADING: Locator = (By.TAG_NAME, "h1")
    VIEWPORT_META: Locator = (By.CSS_SELECTOR, "meta[name=viewport]")

    # The hamburger. It carries no text and no aria-label — only an inline SVG —
    # which is what distinguishes it from the other two header buttons (they hold
    # the sr-only text "Toggle theme" / "Switch language", so normalize-space()
    # is non-empty for them). [last()] picks the rightmost in the header row.
    MENU_TRIGGER: Locator = (
        By.XPATH,
        "(//header//button[not(normalize-space(.))][.//*[local-name()='svg']]"
        " | //nav//button[not(normalize-space(.))][.//*[local-name()='svg']])[last()]",
    )

    THEME_TRIGGER: Locator = (By.XPATH, "//button[normalize-space()='Toggle theme']")
    LANGUAGE_TRIGGER: Locator = (By.XPATH, "//button[normalize-space()='Switch language']")
    SIGN_IN_CTA: Locator = (
        By.XPATH,
        '//button[normalize-space()="Sign in / Sign up"]'
        ' | //a[normalize-space()="Sign in / Sign up"]',
    )

    # contains(text(), ...) — NOT contains(normalize-space(), ...). The latter
    # also matches every ancestor holding the text, so it resolves <html> first
    # and the assertion passes without the tagline ever rendering.
    HERO_TAGLINE_TEXT: Locator = (
        By.XPATH, f'//*[contains(text(), "{HERO_TAGLINE}")]')

    # Any dropdown item — the "is this menu actually open" sentinel.
    ANY_MENU_ITEM: Locator = (By.XPATH, '//*[@role="menuitem" or @role="option"]')

    # ── Parameterised locators ────────────────────────────────────────────

    @staticmethod
    def menu_link(label: str) -> Locator:
        """Nav link inside the (open) mobile menu."""
        return (
            By.XPATH,
            f'//nav//a[normalize-space()="{label}"]'
            f' | //header//a[normalize-space()="{label}"]',
        )

    @staticmethod
    def button_by_text(label: str) -> Locator:
        return (By.XPATH, f'//button[normalize-space()="{label}"]')

    @staticmethod
    def menu_item(label: str) -> Locator:
        """Item inside an open Radix dropdown (theme / language menus)."""
        return (
            By.XPATH,
            f'//*[@role="menuitem" or @role="option"][normalize-space()="{label}"]',
        )

    @staticmethod
    def section_by_id(section_id: str) -> Locator:
        """Section anchor.

        XPath, not ``By.ID``: "id" is not a W3C location strategy. The plain
        Selenium client silently rewrites ``By.ID`` into a CSS selector, but the
        **Appium** client passes it through verbatim and chromedriver rejects it
        with ``InvalidArgumentException: invalid locator``. Anything reached
        through the Appium driver must use a W3C-native strategy.
        """
        return (By.XPATH, f'//*[@id="{section_id}"]')

    @staticmethod
    def faq_question(question: str) -> Locator:
        """FAQ accordion trigger, scoped to the #faq section."""
        return (
            By.XPATH,
            f'//*[@id="faq"]//button[contains(normalize-space(), "{question}")]',
        )

    @staticmethod
    def pricing_tier(name: str) -> Locator:
        return (
            By.XPATH,
            f'//*[@id="pricing"]//*[self::h2 or self::h3][normalize-space()="{name}"]',
        )

    @staticmethod
    def heading_containing(text: str) -> Locator:
        return (
            By.XPATH,
            "//*[self::h1 or self::h2 or self::h3]"
            f'[contains(normalize-space(), "{text}")]',
        )

    def __init__(self, driver: WebDriver) -> None:
        super().__init__(driver, HOME_URL)

    # ── Navigation ────────────────────────────────────────────────────────

    def open_home_page(self) -> None:
        self.driver.get(HOME_URL)

    def open_path(self, path: str) -> None:
        self.open(path)

    def await_title_contains(self, fragment: str) -> bool:
        """Wait for the document title to contain ``fragment``.

        The site is an SPA: after a deep-link navigation the title is set by the
        client router, so reading ``driver.title`` straight away can still
        return the previous page's title. Asserting without this wait fails
        intermittently under load.
        """
        return self.await_true(lambda d: fragment in (d.title or ""), self.wait)

    def wait_for_hydration(self) -> None:
        self.wait_visible(self.MAIN, self.long_wait)
        self.wait_for_document_ready(self.long_wait)

    # ── Mobile menu ───────────────────────────────────────────────────────

    def open_mobile_menu(self) -> None:
        """Open the hamburger menu, not returning until a nav link is on screen.

        The hamburger is the same Radix dropdown pattern as the theme and
        language triggers, so it needs the same treatment `_open_dropdown`
        already gives those: click, VERIFY, and fall back to the dispatched
        pointer sequence when the click did nothing.

        This used to be a bare click that returned immediately whether or not
        the menu opened. Every menu-dependent scenario then failed in its NEXT
        step with a bare TimeoutException naming a nav link — which reads as
        "the site is missing a Pricing link" rather than "the menu never
        opened". It accounted for essentially every mobile-web failure on both
        iOS and Android.

        The sentinel is a nav link rather than ANY_MENU_ITEM: the mobile nav
        renders plain anchors, not role="menuitem" elements.
        """
        self.click_any_visible(self.MENU_TRIGGER)
        if self.is_mobile_menu_open():
            return
        # Click was swallowed (iOS Safari does this reliably; Android
        # intermittently under parallel load). Synthesise the real finger.
        self.execute_script(
            POINTER_TAP_JS, self.any_visible(self.MENU_TRIGGER, self.short_wait)
        )
        self.is_mobile_menu_open()

    def is_mobile_menu_open(self) -> bool:
        return self.is_any_visible(self.menu_link("Home"), self.short_wait)

    def is_mobile_menu_closed(self) -> bool:
        return self.await_not_displayed(self.menu_link("Home"), self.short_wait)

    def is_menu_link_visible(self, label: str) -> bool:
        return self.is_any_visible(self.menu_link(label), self.short_wait)

    def tap_menu_link(self, label: str) -> None:
        self.click_any_visible(self.menu_link(label))

    # ── Layout / responsiveness ───────────────────────────────────────────

    def horizontal_overflow_px(self) -> int:
        value = self.execute_script(
            "return document.documentElement.scrollWidth - window.innerWidth;")
        return int(value or 0)

    def viewport_meta_content(self) -> str:
        return self.find(self.VIEWPORT_META).get_attribute("content")

    def is_section_in_viewport(self, section_id: str) -> bool:
        section = self.find(self.section_by_id(section_id), self.long_wait)
        return self.await_true(
            lambda d: bool(self.execute_script(
                "var r = arguments[0].getBoundingClientRect();"
                "return r.top < window.innerHeight && r.bottom > 0;", section)),
            self.short_wait,
        )

    # ── Hero ──────────────────────────────────────────────────────────────

    def hero_heading_text(self) -> str:
        return self.wait_visible(self.HERO_HEADING).text

    def is_hero_tagline_visible(self) -> bool:
        return self.is_any_visible(self.HERO_TAGLINE_TEXT)

    def is_button_visible(self, label: str) -> bool:
        return self.is_any_visible(self.button_by_text(label))

    def is_heading_visible(self, text: str) -> bool:
        return self.is_any_visible(self.heading_containing(text))

    # ── FAQ accordion ─────────────────────────────────────────────────────

    def is_faq_question_visible(self, question: str) -> bool:
        return self.is_any_visible(self.faq_question(question))

    def tap_faq_question(self, question: str) -> None:
        """Tap an FAQ trigger after centring it in the viewport.

        The deepest question sits well below the fold. Tapping it without
        scrolling first cost a full 300 s client timeout on iOS and a no-op
        toggle on Android — the same Examples row failed in both the Java and
        Python templates. Centring first makes the tap land on the trigger.
        """
        trigger = self.any_visible(self.faq_question(question))
        self.execute_script("arguments[0].scrollIntoView({block:'center'});", trigger)
        trigger.click()

    def _faq_expanded_state(self, question: str):
        for el in self.find_all(self.faq_question(question)):
            if el.is_displayed():
                return el.get_attribute("aria-expanded")
        return None

    def faq_question_toggles_on_tap(self, question: str) -> bool:
        """Tap the question and return True once aria-expanded flips.

        Asserts a *transition*, not an absolute state: the initial state is not
        deterministic across devices — on a real Android handset the first FAQ
        item was already expanded, on a real iPhone it was collapsed. Asserting
        "expanded after tap" would pass on one and fail on the other.
        """
        before = self._faq_expanded_state(question)
        self.tap_faq_question(question)
        return self.await_true(
            lambda d: (self._faq_expanded_state(question) or before) != before,
            self.short_wait,
        )

    # ── Pricing ───────────────────────────────────────────────────────────

    def is_pricing_tier_visible(self, name: str) -> bool:
        return self.is_any_visible(self.pricing_tier(name))

    # ── Header controls ───────────────────────────────────────────────────

    def _open_dropdown(self, trigger: Locator) -> None:
        """Open a Radix dropdown, not returning until an item is on screen.

        A plain click is enough on Android but does nothing at all on iOS
        Safari, so the fallback dispatches the pointer sequence (see
        POINTER_TAP_JS). On Android the first click succeeds and the fallback
        never runs.
        """
        self.click_any_visible(trigger)
        if self.is_any_visible(self.ANY_MENU_ITEM, self.short_wait):
            return
        self.execute_script(POINTER_TAP_JS, self.any_visible(trigger, self.short_wait))
        self.is_any_visible(self.ANY_MENU_ITEM, self.short_wait)

    def select_theme(self, choice: str) -> None:
        """Open the theme dropdown and pick Light / Dark / System."""
        self._open_dropdown(self.THEME_TRIGGER)
        self.click_any_visible(self.menu_item(choice), self.short_wait)

    def open_language_menu(self) -> None:
        self._open_dropdown(self.LANGUAGE_TRIGGER)

    def is_menu_item_visible(self, label: str) -> bool:
        return self.is_any_visible(self.menu_item(label), self.short_wait)

    def current_theme(self) -> str:
        cls = self.find(self.HTML).get_attribute("class") or ""
        return "dark" if "dark" in cls else "light"

    def is_sign_in_visible_and_enabled(self) -> bool:
        try:
            return self.any_visible(self.SIGN_IN_CTA).is_enabled()
        except Exception:
            return False

    # ── Page text ─────────────────────────────────────────────────────────

    def body_text(self) -> str:
        return self.get_text(self.BODY)
