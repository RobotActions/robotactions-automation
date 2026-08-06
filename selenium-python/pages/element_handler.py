"""Element interaction — find, click, visibility — on top of the shared
:class:`~pages.wait_handlers.WaitHandlers`.

Split from ``WaitHandlers`` deliberately: that module decides *how long* to
wait, this one decides *what to do* with the element once it is there. A page
object or step that needs a raw handler reaches through ``.waits``.

Every method takes an optional ``WebDriverWait`` or falls back to the default
10 s tier. The ``is_*`` methods swallow the timeout and return False so callers
can assert on the result.
"""

from __future__ import annotations

from typing import Any, List, Optional

from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from pages.wait_handlers import Locator, WaitHandlers

_CACHE_ATTR = "_ra_element_handler"


class ElementHandler:
    """DOM interaction bound to one driver, waiting via ``WaitHandlers``."""

    def __init__(self, driver: WebDriver) -> None:
        self.driver = driver
        self.waits = WaitHandlers.for_driver(driver)

    @classmethod
    def for_driver(cls, driver: WebDriver) -> "ElementHandler":
        """Return the handler cached on ``driver``, building it on first use."""
        cached = getattr(driver, _CACHE_ATTR, None)
        if cached is None:
            cached = cls(driver)
            setattr(driver, _CACHE_ATTR, cached)
        return cached

    # ── Element access ────────────────────────────────────────────────────

    def present(self, locator: Locator, handler: Optional[WebDriverWait] = None) -> WebElement:
        return self.waits.handler(handler).until(EC.presence_of_element_located(locator))

    def visible(self, locator: Locator, handler: Optional[WebDriverWait] = None) -> WebElement:
        return self.waits.handler(handler).until(EC.visibility_of_element_located(locator))

    def any_visible(
        self, locator: Locator, handler: Optional[WebDriverWait] = None
    ) -> WebElement:
        """First *displayed* match, ignoring hidden matches earlier in the DOM.

        Needed on the responsive site: several controls (theme toggle, language
        switcher, sign-in CTA) render twice — a desktop node that stays hidden at
        mobile widths and a visible mobile node. ``visible()`` resolves through
        ``find_element``, which only ever inspects the FIRST match, so it times
        out on exactly those controls. Use this whenever a locator can match a
        hidden duplicate.
        """
        def _first_displayed(d):
            for el in d.find_elements(*locator):
                if el.is_displayed():
                    return el
            return None

        return self.waits.handler(handler).until(_first_displayed)

    def is_any_visible(
        self, locator: Locator, handler: Optional[WebDriverWait] = None
    ) -> bool:
        try:
            return self.any_visible(locator, handler) is not None
        except Exception:
            return False

    def click_any_visible(
        self, locator: Locator, handler: Optional[WebDriverWait] = None
    ) -> None:
        """Click counterpart of :meth:`any_visible`."""
        self.any_visible(locator, handler).click()

    def all(self, locator: Locator) -> List[WebElement]:
        return self.driver.find_elements(*locator)

    def click(self, locator: Locator, handler: Optional[WebDriverWait] = None) -> None:
        self.waits.handler(handler).until(EC.element_to_be_clickable(locator)).click()

    def type_text(self, locator: Locator, text: str) -> None:
        element = self.present(locator)
        element.clear()
        element.send_keys(text)

    def text(self, locator: Locator) -> str:
        return self.present(locator).text

    # ── Boolean-returning checks ──────────────────────────────────────────

    def is_visible(self, locator: Locator, handler: Optional[WebDriverWait] = None) -> bool:
        try:
            return self.visible(locator, handler) is not None
        except Exception:
            return False

    def is_clickable(self, locator: Locator, handler: Optional[WebDriverWait] = None) -> bool:
        try:
            return self.waits.handler(handler).until(
                EC.element_to_be_clickable(locator)
            ) is not None
        except Exception:
            return False

    def await_not_displayed(
        self, locator: Locator, handler: Optional[WebDriverWait] = None
    ) -> bool:
        """Poll until no element matching ``locator`` is displayed."""
        return self.waits.await_true(
            lambda d: all(not el.is_displayed() for el in d.find_elements(*locator)),
            handler,
        )

    # ── Scripting ─────────────────────────────────────────────────────────

    def execute_script(self, script: str, *args: Any) -> Any:
        return self.driver.execute_script(script, *args)

    def document_ready(self, handler: Optional[WebDriverWait] = None) -> bool:
        """Wait for ``document.readyState == 'complete'``."""
        return self.waits.await_true(
            lambda d: d.execute_script("return document.readyState") == "complete",
            handler,
        )
