"""Owns the waits, and nothing else — the single place a ``WebDriverWait`` is
constructed.

Three tiers are built once per driver and reused for the driver's whole
lifetime: ``short_wait`` (5 s, negative checks and animation polling),
``default_wait`` (10 s, element interaction), ``long_wait`` (15 s, page load
and SPA hydration). Anything needing another budget calls ``custom(seconds)``.

Element interaction lives in :mod:`pages.element_handler`, which takes its
handlers from here. Page objects and step definitions should use one of the
two — never ``WebDriverWait(...)`` directly.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support.ui import WebDriverWait

Locator = tuple[str, str]

# Timeout tiers, in seconds.
SHORT_TIMEOUT = 5
DEFAULT_TIMEOUT = 10
LONG_TIMEOUT = 15

# Poll interval applied to every handler — the Selenium default is 0.5 s.
POLL_INTERVAL = 0.1

_CACHE_ATTR = "_ra_wait_handlers"


class WaitHandlers:
    """Tiered, reusable explicit waits bound to one driver."""

    def __init__(self, driver: WebDriver) -> None:
        self.driver = driver
        self.short_wait = self.custom(SHORT_TIMEOUT)
        self.default_wait = self.custom(DEFAULT_TIMEOUT)
        self.long_wait = self.custom(LONG_TIMEOUT)

    @classmethod
    def for_driver(cls, driver: WebDriver) -> "WaitHandlers":
        """Return the handlers cached on ``driver``, building them on first use.

        The cache lives on the driver object, so it is discarded with the
        driver at the end of each scenario — no stale handler can outlive the
        session it wraps.
        """
        cached = getattr(driver, _CACHE_ATTR, None)
        if cached is None:
            cached = cls(driver)
            setattr(driver, _CACHE_ATTR, cached)
        return cached

    def custom(self, timeout: float) -> WebDriverWait:
        """One-off handler for a timeout the three tiers don't cover."""
        return WebDriverWait(self.driver, timeout=timeout, poll_frequency=POLL_INTERVAL)

    def handler(self, handler: Optional[WebDriverWait] = None) -> WebDriverWait:
        """Resolve an optional handler to the default 10 s tier."""
        return handler if handler is not None else self.default_wait

    # ── Polling ───────────────────────────────────────────────────────────

    def await_true(
        self,
        condition: Callable[[WebDriver], Any],
        handler: Optional[WebDriverWait] = None,
    ) -> bool:
        """Poll ``condition`` until it returns truthy; False on timeout.

        Callers assert on the result instead of catching TimeoutException at
        every call site.
        """
        try:
            return bool(self.handler(handler).until(condition))
        except Exception:
            return False
