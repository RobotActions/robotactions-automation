# Environment is read only in ./config.py — never os.environ directly here.
import config

import pytest
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page


def pytest_sessionstart(session):
    """Announce where tests will run.

    A missing GRID_HOST silently falls back to a LOCAL browser, and a green
    run then proves nothing about the grid — so say it out loud once.
    """
    print(f"\n[playwright-python] target: {config.describe_target()}")


@pytest.fixture(scope="session")
def base_url() -> str:
    """Base URL of application under test."""
    return config.base_url()


@pytest.fixture(scope="function")
def browser_instance(base_url: str):
    """Playwright browser per test — grid when configured, else local.

    FUNCTION-scoped, deliberately. The grid allocates a **container per
    Playwright session**, and that container tears down when the first
    context closes — so a session-scoped browser shared across tests dies
    after test #1. Observed 2026-08-05: test 1 passed, its teardown errored,
    and every later test failed or hung indefinitely (the sync API waits
    forever on a half-open ws connection, so the run never even printed its
    summary). One connection per test costs a session each but is the only
    shape that matches container-per-session semantics.

    The grid endpoint (scheme, path and token placement) is resolved in
    config.py. The token must travel in the query string: Playwright drops
    custom HTTP headers on a ws:// upgrade, so the previous ``headers=``
    form was rejected by the grid's auth gate with 401.
    """
    with sync_playwright() as p:
        endpoint = config.grid_ws_endpoint()

        if endpoint:
            browser = p.chromium.connect(endpoint)
        else:
            browser = p.chromium.launch(
                headless=config.is_ci(),
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
        yield browser
        # Never let teardown fail or hang the run: the remote container may
        # already be gone, in which case close() raises or blocks.
        try:
            browser.close()
        except Exception:
            pass


@pytest.fixture(scope="function")
def context(browser_instance: Browser) -> BrowserContext:
    """Fresh browser context per test."""
    ctx = browser_instance.new_context(
        viewport={"width": 1280, "height": 720},
        ignore_https_errors=True,
    )
    ctx.set_default_timeout(15000)
    ctx.set_default_navigation_timeout(30000)
    yield ctx
    ctx.close()


@pytest.fixture(scope="function")
def page(context: BrowserContext) -> Page:
    """Fresh page per test."""
    pg = context.new_page()
    yield pg
    pg.close()
