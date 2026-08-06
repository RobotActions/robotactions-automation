"""The single place this template reads the environment.

Nothing else — not ``conftest.py``, not a page object, not a test — should call
``os.environ`` directly. Keeping one reader is what stops the grid wiring from
drifting between entry points (which is exactly how the sibling templates ended
up with two different, and one broken, auth paths).
"""

from __future__ import annotations

import os
from urllib.parse import quote

from dotenv import load_dotenv

load_dotenv()

LOOPBACK = ("localhost", "127.0.0.1", "0.0.0.0", "[::1]")


def _str(name: str, fallback: str = "") -> str:
    value = os.environ.get(name)
    return fallback if value is None or value == "" else value


def is_ci() -> bool:
    """True when running on CI — drives headless."""
    value = _str("CI").lower()
    return value not in ("", "false", "0")


def base_url() -> str:
    """Application under test."""
    return _str("BASE_URL", "https://robotactions.com")


def suite_name() -> str:
    """Suite label persisted by the grid as ``sessions.test_suite``."""
    return _str("RA_TESTSUITE", "Playwright Python")


def grid_browser() -> str:
    """Which browser the grid's Playwright endpoint should hand back."""
    return _str("PW_GRID_BROWSER", "chromium")


def _endpoint() -> tuple[str, bool] | None:
    """Return ``(host:port, secure)`` for the grid, or None when unset.

    The scheme is inferred rather than hardcoded: locally the grid is plain
    ws:// on ``localhost:4444``; the public endpoint used from CI is wss:// on
    443. Hardcoding ``ws://`` would send cleartext to a TLS endpoint.
    """
    raw = _str("GRID_URL") or _str("GRID_HOST")
    if not raw:
        return None

    secure: bool | None = None
    host_port = raw
    for scheme in ("https://", "wss://", "http://", "ws://"):
        if raw.startswith(scheme):
            secure = scheme in ("https://", "wss://")
            host_port = raw[len(scheme):]
            break

    host_port = host_port.rstrip("/")
    # A GRID_URL may already carry the /playwright/<browser> path — keep only
    # the authority; the path is rebuilt below so both env vars behave alike.
    host_port = host_port.split("/")[0]
    hostname, _, port = host_port.partition(":")
    loopback = hostname.startswith(LOOPBACK)

    if secure is None:
        secure = port == "443" or (not loopback and not port)
    return host_port, secure


def grid_ws_endpoint() -> str | None:
    """Full ws endpoint for ``chromium.connect``, or None to launch locally.

    The token goes in the query string, NOT in ``headers``: Playwright drops
    custom HTTP headers on a ws:// upgrade, so a header-authenticated connect
    is rejected by the grid's auth gate with 401. The server accepts
    ``?token=`` on the upgrade.
    """
    target = _endpoint()
    if target is None:
        return None
    host_port, secure = target
    token = _str("AUTH_TOKEN")
    query = f"?token={quote(token, safe='')}" if token else ""
    scheme = "wss" if secure else "ws"
    return f"{scheme}://{host_port}/playwright/{grid_browser()}{query}"


def describe_target() -> str:
    """One-line description of where tests will run — printed at session start.

    A missing GRID_HOST silently falls back to a LOCAL browser, and a green run
    then proves nothing about the grid; saying so out loud avoids that trap.
    """
    endpoint = grid_ws_endpoint()
    if endpoint is None:
        return "local browser (no GRID_HOST/GRID_URL set)"
    # Never print the token.
    return endpoint.split("?")[0]
