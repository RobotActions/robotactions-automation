"""Base class for all page objects.

Two shared, per-driver handlers are resolved once in ``__init__`` and inherited
by every page object — subclasses never construct a ``WebDriverWait``.
:class:`~pages.wait_handlers.WaitHandlers` decides how long to wait
(``short_wait`` / ``wait`` / ``long_wait``);
:class:`~pages.element_handler.ElementHandler` decides what to do with the
element. Page methods express intent (``is_visible``, ``click``,
``await_true``) and pick a tier.
"""

from __future__ import annotations

from typing import Any, Callable, List, Optional

from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support.ui import WebDriverWait

from pages.element_handler import ElementHandler
from pages.wait_handlers import Locator, WaitHandlers


class BasePage:
    """Base class for all page objects."""

    def __init__(self, driver: WebDriver, base_url: str = "") -> None:
        self.driver = driver
        self.base_url = base_url
        # Shared, per-driver handlers — also used directly by step definitions.
        self.waits = WaitHandlers.for_driver(driver)      # how long to wait
        self.elements = ElementHandler.for_driver(driver)  # what to do with the element
        self.short_wait = self.waits.short_wait      # 5 s  — negative checks, animation
        self.wait = self.waits.default_wait          # 10 s — element interaction
        self.long_wait = self.waits.long_wait        # 15 s — page load, SPA hydration

    def new_wait(self, timeout: float) -> WebDriverWait:
        """Handler for a timeout the three tiers don't cover."""
        return self.waits.custom(timeout)

    def open(self, path: str = "") -> None:
        self.driver.get(f"{self.base_url}{path}")

    # ── Element access ────────────────────────────────────────────────────

    def find(self, locator: Locator, handler: Optional[WebDriverWait] = None) -> WebElement:
        return self.elements.present(locator, handler)

    def find_all(self, locator: Locator) -> List[WebElement]:
        return self.elements.all(locator)

    def wait_visible(self, locator: Locator, handler: Optional[WebDriverWait] = None) -> WebElement:
        return self.elements.visible(locator, handler)

    def click(self, locator: Locator, handler: Optional[WebDriverWait] = None) -> None:
        self.elements.click(locator, handler)

    def type_text(self, locator: Locator, text: str) -> None:
        self.elements.type_text(locator, text)

    def get_text(self, locator: Locator) -> str:
        return self.elements.text(locator)

    # ── Boolean-returning waits ───────────────────────────────────────────

    def is_visible(self, locator: Locator, handler: Optional[WebDriverWait] = None) -> bool:
        return self.elements.is_visible(locator, handler)

    def is_clickable(self, locator: Locator, handler: Optional[WebDriverWait] = None) -> bool:
        return self.elements.is_clickable(locator, handler)

    def any_visible(
        self, locator: Locator, handler: Optional[WebDriverWait] = None
    ) -> WebElement:
        """First displayed match — use when the locator can match a hidden duplicate."""
        return self.elements.any_visible(locator, handler)

    def is_any_visible(
        self, locator: Locator, handler: Optional[WebDriverWait] = None
    ) -> bool:
        return self.elements.is_any_visible(locator, handler)

    def click_any_visible(
        self, locator: Locator, handler: Optional[WebDriverWait] = None
    ) -> None:
        self.elements.click_any_visible(locator, handler)

    def await_true(
        self,
        condition: Callable[[WebDriver], Any],
        handler: Optional[WebDriverWait] = None,
    ) -> bool:
        return self.waits.await_true(condition, handler)

    def await_not_displayed(
        self, locator: Locator, handler: Optional[WebDriverWait] = None
    ) -> bool:
        return self.elements.await_not_displayed(locator, handler)

    # ── Scripting ─────────────────────────────────────────────────────────

    def execute_script(self, script: str, *args: Any) -> Any:
        return self.elements.execute_script(script, *args)

    def wait_for_document_ready(self, handler: Optional[WebDriverWait] = None) -> None:
        self.elements.document_ready(handler)

    @property
    def title(self) -> str:
        return self.driver.title

    @property
    def current_url(self) -> str:
        return self.driver.current_url
