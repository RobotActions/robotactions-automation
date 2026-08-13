"""
Realistic test suite against https://robotactions.com — exercises the homepage
end-to-end with multiple per-test runs, mixed pass/fail outcomes, proper
test_id / test_name / test_suite / release_id grouping, and the failure-evidence
panel (screenshot + inline video) on every failed run.

All tests share the same suite tag so they roll up together on the Reports tab.
Each test has a unique test_id for its own per-test history page on the Tests tab.
One test is an intentional fail so operators can see the screenshot + auto-seeked
video inline.

Run:
    GRID_URL=http://localhost:5555 \\
    AUTH_TOKEN=<jwt> \\
    pytest tests/test_robotactions_suite.py -v

Each iteration of this suite produces 7 sessions in the dashboard:
  - 6 passes (hero / nav / contact / careers / pricing / faq)
  - 1 intentional fail (asserts a missing selector — realistic regression demo)
"""
import os
import time
from typing import Any, Dict

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = os.environ.get("BASE_URL", "https://robotactions.com")
RELEASE_ID = os.environ.get("CI_BUILD_VERSION", "v2.4.0")
SUITE = "RobotActions homepage validation"


def _extract_failure_message(rep) -> str:
    """Extract a human-readable failure message from a pytest TestReport."""
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
        if not s:
            continue
        if s.startswith("_") and s.endswith("_"):
            continue
        return s[:200]
    return "test failed"


def _executor_url(grid_url: str, auth_token: str) -> str:
    if auth_token and auth_token != "{{AUTH_TOKEN}}":
        return f"{grid_url.rstrip('/')}/t/{auth_token}"
    return grid_url


@pytest.fixture
def driver(request, grid_url: str, auth_token: str):
    """Per-test driver that tags the session with ra:test* metadata derived
    from the pytest test node, then reports pass/fail in teardown."""
    marker = request.node.get_closest_marker("meta")
    meta: Dict[str, Any] = marker.kwargs if marker else {}
    test_id = meta.get("test_id", "ROBOT-UNKNOWN")
    test_name = meta.get("test_name", request.node.name)

    options = ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--headless=new")
    options.set_capability("ra:testName", test_name)
    options.set_capability("ra:testId", test_id)
    options.set_capability("ra:testsuite", SUITE)
    options.set_capability("ra:releaseId", RELEASE_ID)

    drv = webdriver.Remote(
        command_executor=_executor_url(grid_url, auth_token),
        options=options,
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
            err_text = _extract_failure_message(rep)
            drv.execute_script(f"ra:job-result=failed:{err_text}")
        else:
            drv.execute_script("ra:job-result=passed")
    except Exception as e:
        print(f"[teardown] result report failed: {e}")
    finally:
        try:
            drv.quit()
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────
# Passing tests — exercise real sections of robotactions.com
# ─────────────────────────────────────────────────────────────────────

@pytest.mark.meta(test_id="ROBOT-HERO-001", test_name="Hero section renders headline and stable tagline")
def test_hero_section_visible(driver):
    """Hero h1 rotates through 3 phrases; assert on stable tagline instead."""
    driver.get(BASE_URL)
    WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.TAG_NAME, "main")))
    # h1 exists and is non-empty
    headings = driver.find_elements(By.CSS_SELECTOR, "h1")
    assert len(headings) > 0, "expected h1 on the homepage"
    h1_text = headings[0].text
    assert len(h1_text) > 10, f"h1 text suspiciously short: {h1_text!r}"
    # Stable tagline never rotates
    tagline = WebDriverWait(driver, 10).until(
        EC.visibility_of_element_located(
            (By.XPATH, '//*[contains(normalize-space(), "No credit card required")]')
        )
    )
    assert tagline.is_displayed(), "stable tagline not visible"


@pytest.mark.meta(test_id="ROBOT-NAV-001", test_name="Top navigation has all 5 anchor links")
def test_navigation_links(driver):
    driver.get(BASE_URL)
    WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.TAG_NAME, "nav")))
    for label in ["Home", "Products", "Pricing", "FAQ", "Contact"]:
        link = WebDriverWait(driver, 5).until(
            EC.presence_of_element_located(
                (By.XPATH, f'//nav//a[normalize-space()="{label}"]')
            )
        )
        assert link is not None, f"nav link {label!r} not found"


@pytest.mark.meta(test_id="ROBOT-PRICING-001", test_name="Pricing section has Free, Shared, Enterprise tiers")
def test_pricing_tiers(driver):
    driver.get(BASE_URL)
    pricing = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "pricing"))
    )
    pricing_text = pricing.text
    for tier in ["Free", "Shared", "Enterprise"]:
        assert tier in pricing_text, f"pricing tier {tier!r} not found in #pricing section"


@pytest.mark.meta(test_id="ROBOT-FAQ-001", test_name="FAQ section renders first accordion question")
def test_faq_section(driver):
    driver.get(BASE_URL)
    faq = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "faq"))
    )
    first_q = WebDriverWait(driver, 5).until(
        EC.presence_of_element_located(
            (By.XPATH, '//section[@id="faq"]//button[contains(normalize-space(), "What is RobotActions")]')
        )
    )
    assert first_q is not None, "first FAQ question not found"


@pytest.mark.meta(test_id="ROBOT-CONTACT-001", test_name="Contact section is present on homepage")
def test_contact_section(driver):
    driver.get(BASE_URL)
    contact = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "contact"))
    )
    assert contact is not None, "#contact section not found"
    body = driver.find_element(By.TAG_NAME, "body").text
    assert len(body) > 200, f"body text suspiciously short: {len(body)}b"


@pytest.mark.meta(test_id="ROBOT-CAREERS-001", test_name="Careers page is reachable")
def test_careers_reachable(driver):
    driver.get(f"{BASE_URL.rstrip('/')}/careers")
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    body = driver.find_element(By.TAG_NAME, "body").text
    assert len(body) > 100, f"careers page body suspiciously short: {len(body)}b"


@pytest.mark.meta(test_id="ROBOT-SERVICES-001", test_name="Services section contains Selenium/Appium/Playwright text")
def test_services_section(driver):
    driver.get(BASE_URL)
    services = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "services"))
    )
    services_text = services.text
    assert "Selenium" in services_text or "Appium" in services_text or "Playwright" in services_text, (
        "services section should mention at least one framework"
    )


# ─────────────────────────────────────────────────────────────────────
# Intentional fail — realistic regression demo for the failure-evidence panel.
# This test looks for a CSS id that was removed in a fictitious refactor.
# It is EXPECTED to fail — it validates the dashboard's screenshot + video
# capture on failure. Do not fix this test.
# ─────────────────────────────────────────────────────────────────────

@pytest.mark.meta(test_id="ROBOT-CTA-001", test_name="Hero CTA #get-started (intentional fail — regression demo)")
def test_hero_primary_cta_intentional_fail(driver):
    """Intentional fail — the CTA button on robotactions.com uses a different
    selector than #get-started. This mimics a realistic regression where devs
    renamed a button ID without updating the test suite. Expected to fail and
    appear in the dashboard's failure-evidence panel with screenshot + video."""
    driver.get(BASE_URL)
    time.sleep(2)
    cta = driver.find_element(By.ID, "get-started")  # NoSuchElementException — by design
    cta.click()
    assert "/signup" in driver.current_url or "/demo" in driver.current_url, (
        "click on #get-started should navigate to signup or demo"
    )
