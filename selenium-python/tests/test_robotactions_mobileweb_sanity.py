"""
Mobile-web SANITY suite against https://robotactions.com — drives the real
marketing site through **Chrome on a physical Android device** (default) or
**Safari on a physical iOS device** via Appium + the Selenium Grid.

Mirrors the desktop sanity slice (features/robotactions-load.feature @sanity)
but adapted for a mobile viewport: assertions lean on stable text / section
ids rather than the desktop nav bar (which collapses into a hamburger menu on
mobile), so they hold regardless of nav layout.

Select the platform with RA_MOBILE_PLATFORM (default: android):
  RA_MOBILE_PLATFORM=android  → browserName=chrome,  platformName=Android, UiAutomator2
  RA_MOBILE_PLATFORM=ios      → browserName=safari,  platformName=iOS,     XCUITest

Every test maps onto the dashboard's Reports + Tests tabs:
  - ra:testsuite  → sessions.test_suite   (per-suite rollup card)
  - ra:testName   → sessions.test_name    (human label on the session)
  - ra:testId     → sessions.test_id      (per-test history page)
  - ra:releaseId  → release grouping
  - ra:job-result → pass/fail + failure reason (screenshot + video on fail)

Run Android Chrome (sanity slice):
    RA_MOBILE_PLATFORM=android pytest tests/test_robotactions_mobileweb_sanity.py \\
        -k "homepage or hero or pricing" -v

Run iOS Safari (robust subset only — 2 tests to stay within device budget):
    RA_MOBILE_PLATFORM=ios pytest tests/test_robotactions_mobileweb_sanity.py \\
        -k "homepage or hero" -v
"""
import itertools
import os
from typing import Any, Dict

import pytest
from selenium import webdriver
from selenium.webdriver.common.options import ArgOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = os.environ.get("BASE_URL", "https://robotactions.com")
RELEASE_ID = os.environ.get("RA_RELEASE_ID", os.environ.get("CI_BUILD_VERSION", "v2.4.0"))
# Suite name leads with the framework so the Reports tab groups runs by stack
# (Selenium Python / WebdriverIO / Java Selenium / ...). Override per-run with
# the RA_TESTSUITE env var.
SUITE = os.environ.get("RA_TESTSUITE", "Selenium Python — RobotActions mobile-web sanity")

# Target platform: "android" (default) or "ios". Drives cap selection in
# the mobile_web fixture. Physical devices only — never boot simulators/emulators.
_MOBILE_PLATFORM = os.environ.get("RA_MOBILE_PLATFORM", "android").lower()

# Mark every test in this module as sanity + android + robotactions so a tag
# filter (`-m sanity`) selects the slice and the platform intent is explicit.
# The "android" marker is intentional for tag filtering — the fixture handles
# iOS when RA_MOBILE_PLATFORM=ios without requiring a new marker.
pytestmark = [pytest.mark.sanity, pytest.mark.android, pytest.mark.robotactions]

# Optional: pin sessions to specific physical Android devices by udid. The grid
# also exposes k8s container chrome slots whose stereotype is platformName=any,
# which can poach a mobile-web request and fail session creation. Setting
# RA_DEVICE_UDIDS=udid1,udid2,... routes each test to a real device (round-robin)
# via appium:udid, guaranteeing physical-device execution. Unset → generic
# Android-chrome routing (any free slot).
_DEVICE_UDIDS = [u.strip() for u in os.environ.get("RA_DEVICE_UDIDS", "").split(",") if u.strip()]
_udid_cycle = itertools.cycle(_DEVICE_UDIDS) if _DEVICE_UDIDS else None

# Physical iOS device udids — same round-robin pattern. Set RA_IOS_UDIDS=udid1,udid2,...
# to guarantee physical-device routing for Safari sessions.
_IOS_UDIDS = [u.strip() for u in os.environ.get("RA_IOS_UDIDS", "").split(",") if u.strip()]
_ios_udid_cycle = itertools.cycle(_IOS_UDIDS) if _IOS_UDIDS else None


class _MobileWebCaps(ArgOptions):
    """Bare options bag for a mobile-web (Appium Chrome) session — avoids
    ChromeOptions' desktop default_capabilities leaking onto the Android slot.
    Mirrors features step-def `_MobileWebCaps`."""

    @property
    def default_capabilities(self):
        return {}


def _extract_failure_message(rep) -> str:
    """Human-readable first line from a pytest TestReport (for ra:job-result)."""
    if not rep or not rep.longrepr:
        return "test failed"
    try:
        crash = getattr(rep.longrepr, "reprcrash", None)
        if crash is not None:
            msg = getattr(crash, "message", None)
            if msg:
                first_line = str(msg).strip().splitlines()[0]
                if first_line:
                    return first_line[:200]
    except Exception:
        pass
    for line in str(rep.longrepr).splitlines():
        s = line.strip()
        if not s or (s.startswith("_") and s.endswith("_")):
            continue
        return s[:200]
    return "test failed"


def _executor_url(grid_url: str, auth_token: str) -> str:
    """Path-prefix auth: /t/<token> stripped by the grid proxy before forwarding."""
    if auth_token and auth_token != "{{AUTH_TOKEN}}":
        return f"{grid_url.rstrip('/')}/t/{auth_token}"
    return grid_url


@pytest.fixture
def mobile_web(request, grid_url: str, auth_token: str):
    """Per-test mobile-web driver — platform-aware via RA_MOBILE_PLATFORM.

    android (default): Appium Chrome on a real Android device via UiAutomator2.
    ios:               Appium Safari on a real iOS device via XCUITest.

    Both paths tag every session with ra:test* metadata from the test's `meta`
    marker and report pass/fail via ra:job-result in teardown.
    """
    marker = request.node.get_closest_marker("meta")
    meta: Dict[str, Any] = marker.kwargs if marker else {}
    test_id = meta.get("test_id", "ROBOT-MWEB-UNKNOWN")
    test_name = meta.get("test_name", request.node.name)

    opts = _MobileWebCaps()
    opts.set_capability("appium:newCommandTimeout", 180)

    if _MOBILE_PLATFORM == "ios":
        opts.set_capability("browserName", "safari")
        opts.set_capability("platformName", "iOS")
        opts.set_capability("appium:automationName", "XCUITest")
        if _ios_udid_cycle is not None:
            opts.set_capability("appium:udid", next(_ios_udid_cycle))
    else:  # android (default)
        opts.set_capability("browserName", "chrome")
        opts.set_capability("platformName", "Android")
        opts.set_capability("appium:automationName", "UiAutomator2")
        if _udid_cycle is not None:
            opts.set_capability("appium:udid", next(_udid_cycle))

    opts.set_capability("ra:testName", test_name)
    opts.set_capability("ra:testId", test_id)
    opts.set_capability("ra:testsuite", SUITE)
    opts.set_capability("ra:releaseId", RELEASE_ID)

    drv = webdriver.Remote(
        command_executor=_executor_url(grid_url, auth_token),
        options=opts,
    )
    drv.implicitly_wait(5)

    yield drv

    try:
        rep_call = getattr(request.node, "rep_call", None)
        rep_setup = getattr(request.node, "rep_setup", None)
        failed = (rep_call is not None and rep_call.failed) or (
            rep_setup is not None and rep_setup.failed
        )
        if failed:
            rep = rep_call if (rep_call and rep_call.failed) else rep_setup
            drv.execute_script(f"ra:job-result=failed:{_extract_failure_message(rep)}")
        else:
            drv.execute_script("ra:job-result=passed")
    except Exception as e:
        print(f"[teardown] result report failed: {e}")
    finally:
        try:
            drv.quit()
        except Exception:
            pass


def _open_home(drv):
    drv.get(BASE_URL)
    WebDriverWait(drv, 20).until(EC.presence_of_element_located((By.TAG_NAME, "body")))


def _scroll_to(drv, element):
    drv.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)


# ─────────────────────────────────────────────────────────────────────
# Sanity coverage — stable text + section-id assertions (mobile-safe)
# ─────────────────────────────────────────────────────────────────────

@pytest.mark.meta(test_id="ROBOT-MWEB-HOME-001",
                  test_name="Homepage loads in mobile Chrome with correct title + URL")
def test_homepage_title_and_url(mobile_web):
    _open_home(mobile_web)
    assert "RobotActions" in mobile_web.title, f"title {mobile_web.title!r} missing 'RobotActions'"
    assert "robotactions.com" in mobile_web.current_url, mobile_web.current_url


@pytest.mark.meta(test_id="ROBOT-MWEB-HERO-001",
                  test_name="Hero renders an h1 and the stable tagline")
def test_hero_section(mobile_web):
    _open_home(mobile_web)
    headings = mobile_web.find_elements(By.CSS_SELECTOR, "h1")
    assert headings, "expected an h1 on the homepage"
    assert len(headings[0].text) > 8, f"h1 text suspiciously short: {headings[0].text!r}"
    tagline = WebDriverWait(mobile_web, 15).until(
        EC.presence_of_element_located(
            (By.XPATH, '//*[contains(normalize-space(), "No credit card required")]')
        )
    )
    assert tagline is not None, "stable hero tagline not found"


@pytest.mark.meta(test_id="ROBOT-MWEB-PRICING-001",
                  test_name="Pricing section shows Free / Shared / Enterprise tiers")
def test_pricing_tiers(mobile_web):
    _open_home(mobile_web)
    pricing = WebDriverWait(mobile_web, 15).until(
        EC.presence_of_element_located((By.XPATH, \'//*[@id="pricing"]\'))
    )
    _scroll_to(mobile_web, pricing)
    text = pricing.text
    for tier in ["Free", "Shared", "Enterprise"]:
        assert tier in text, f"pricing tier {tier!r} not found in #pricing"


@pytest.mark.meta(test_id="ROBOT-MWEB-FAQ-001",
                  test_name="FAQ section renders a known accordion question")
def test_faq_section(mobile_web):
    _open_home(mobile_web)
    faq = WebDriverWait(mobile_web, 15).until(EC.presence_of_element_located((By.XPATH, \'//*[@id="faq"]\')))
    _scroll_to(mobile_web, faq)
    assert "RobotActions" in faq.text, "FAQ section missing expected content"


@pytest.mark.meta(test_id="ROBOT-MWEB-SERVICES-001",
                  test_name="Services section renders the real-device value prop")
def test_services_section(mobile_web):
    # On mobile the #services section is the real-device-farm block
    # ("Test on Any Device, Any Platform" — devices / tablets / browsers),
    # not a frameworks list. Assert its stable device-testing copy.
    _open_home(mobile_web)
    services = WebDriverWait(mobile_web, 15).until(
        EC.presence_of_element_located((By.XPATH, \'//*[@id="services"]\'))
    )
    _scroll_to(mobile_web, services)
    text = services.text
    assert len(text) > 80, f"services section text suspiciously short: {len(text)}b"
    assert "Device" in text and "Test" in text, (
        "services section should describe the real-device testing value prop"
    )


@pytest.mark.meta(test_id="ROBOT-MWEB-CONTACT-001",
                  test_name="Contact section is present on the homepage")
def test_contact_section(mobile_web):
    _open_home(mobile_web)
    contact = WebDriverWait(mobile_web, 15).until(
        EC.presence_of_element_located((By.XPATH, \'//*[@id="contact"]\'))
    )
    assert contact is not None, "#contact section not found"


@pytest.mark.meta(test_id="ROBOT-MWEB-CAREERS-001",
                  test_name="Careers page is reachable on mobile")
def test_careers_reachable(mobile_web):
    mobile_web.get(f"{BASE_URL.rstrip('/')}/careers")
    WebDriverWait(mobile_web, 20).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    body = mobile_web.find_element(By.TAG_NAME, "body").text
    assert len(body) > 80, f"careers page body suspiciously short: {len(body)}b"


@pytest.mark.meta(test_id="ROBOT-MWEB-404-001",
                  test_name="Unknown route renders a 404 page (negative)")
def test_unknown_route_404(mobile_web):
    mobile_web.get(f"{BASE_URL.rstrip('/')}/this-route-does-not-exist-xyz")
    WebDriverWait(mobile_web, 20).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    assert "404" in mobile_web.title or "404" in mobile_web.find_element(By.TAG_NAME, "body").text, (
        "expected a 404 indicator on an unknown route"
    )


@pytest.mark.meta(test_id="ROBOT-MWEB-DEEPLINK-001",
                  test_name="Direct visit to /features/appium renders without crash")
def test_feature_subpage_deeplink(mobile_web):
    mobile_web.get(f"{BASE_URL.rstrip('/')}/features/appium")
    WebDriverWait(mobile_web, 20).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    assert "RobotActions" in mobile_web.title, f"title {mobile_web.title!r} missing 'RobotActions'"
