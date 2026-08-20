import base64
import json
import os
import time
from dotenv import load_dotenv
load_dotenv()

import allure
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.remote.webdriver import WebDriver


# Stash each test phase's outcome onto the item so fixture finalizers can
# detect pass/fail. The fixture finalizer runs DURING the teardown phase but
# only AFTER setup/call makereport hooks have fired — so reading rep_call
# in the finalizer works. Defined in conftest.py so it's discovered
# globally for every test file under this directory tree.
#
# On a failed call phase we also attach a screenshot + page source + browser
# console log to the active Allure scenario. Requires the `driver` fixture
# to be function-scoped so attachments bind to the correct scenario
# (allure-pytest-bdd #475).
@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{call.when}", rep)
    if rep.when == "call" and rep.failed:
        driver = item.funcargs.get("driver")
        if driver is not None:
            try:
                allure.attach(
                    driver.get_screenshot_as_png(),
                    name="screenshot-on-failure",
                    attachment_type=allure.attachment_type.PNG,
                )
            except Exception as e:
                allure.attach(str(e), name="screenshot-error", attachment_type=allure.attachment_type.TEXT)
            try:
                allure.attach(
                    driver.page_source,
                    name="page-source",
                    attachment_type=allure.attachment_type.HTML,
                )
            except Exception as e:
                allure.attach(str(e), name="page-source-error", attachment_type=allure.attachment_type.TEXT)
            try:
                logs = driver.get_log("browser")
                allure.attach(
                    "\n".join(repr(entry) for entry in logs),
                    name="browser-console.log",
                    attachment_type=allure.attachment_type.TEXT,
                )
            except Exception:
                pass


def _apply_chrome_args(options) -> None:
    """Append extra Chrome flags from RA_CHROME_ARGS.

    Space-separated, e.g. RA_CHROME_ARGS="--lang=fr-FR --window-size=414,896".
    Lets a CI run vary browser flags without editing the template — the
    workflow exposes it as a dispatch input. Silent no-op when unset.
    """
    extra = os.environ.get("RA_CHROME_ARGS", "").strip()
    for arg in extra.split():
        options.add_argument(arg)


def _apply_ra_testsuite(options) -> None:
    """Attach the ra:testsuite vendor cap so the grid persists it on
    sessions.test_suite — drives the Reports tab's Test Suite filter +
    per-suite rollup cards. Override per-run with the RA_TESTSUITE env var
    (e.g. RA_TESTSUITE=smoke-build-42). Silent no-op when unset.
    """
    suite = os.environ.get("RA_TESTSUITE")
    if suite:
        options.set_capability("ra:testsuite", suite)


# ─── Result reporting ────────────────────────────────────────────────────────
# The grid cannot infer a verdict: at the WebDriver layer a passing suite and a
# failing one are the same command stream. Unless the test SAYS so, the session
# lands with result=NULL and the dashboard can only show "COMPLETED" — which is
# how a suite that silently stopped asserting still looks healthy.
#
# This lived only in tests/test_robotactions_mobileweb_sanity.py, which builds
# its own driver. Everything under tests/step_defs/ — i.e. everything load.sh
# and run-*.sh actually run — used the shared fixtures below and reported
# nothing. Hoisted here so every scenario reports by default.
#
# Outcome comes from `rep_<phase>` attributes set by the existing
# pytest_runtest_makereport hook above; a fixture finalizer cannot otherwise
# see whether its test passed.


def _ra_report_result(driver, item) -> None:
    """Tell the grid how the test ended, via the ra:job-result magic script.

    Best-effort by design: a reporting failure must never turn a passing test
    red, and the driver may already be dead if the session crashed.
    """
    if driver is None or item is None:
        return
    # `rep_<phase>` is set by the module's existing
    # pytest_runtest_makereport hook (the one that also attaches Allure
    # screenshots). Reused rather than adding a second hook — a duplicate
    # definition would shadow it and silently drop those attachments.
    setup = getattr(item, "rep_setup", None)
    call = getattr(item, "rep_call", None)
    failed = (setup is not None and setup.failed) or (call is not None and call.failed)

    try:
        if failed:
            rep = call if (call is not None and call.failed) else setup
            reason = ""
            if rep is not None and rep.longrepr is not None:
                # Prefer pytest's own crash message — it is the assertion or
                # exception line, already distilled. Taking the last line of
                # longreprtext instead yields garbage whenever the failure
                # carries a native stack ("#20 0xffffa9362de8 <unknown>" from a
                # browser crash), which is exactly when a readable reason
                # matters most.
                crash = getattr(rep.longrepr, "reprcrash", None)
                if crash is not None and getattr(crash, "message", None):
                    reason = str(crash.message).strip().split("\n")[0][:180]
                else:
                    reason = str(rep.longreprtext).strip().split("\n")[-1][:180]
            driver.execute_script(f"ra:job-result=failed:{reason}" if reason else "ra:job-result=failed")
        else:
            driver.execute_script("ra:job-result=passed")
    except Exception:
        pass


def _ra_tag_test(driver, item) -> None:
    """Name the session after the test so dashboard rows are identifiable.

    Without this every row reads as an anonymous session and the Reports tab
    cannot group anything.
    """
    if driver is None or item is None:
        return
    try:
        driver.execute_script(f"ra:job-name={item.name[:180]}")
    except Exception:
        pass


@pytest.fixture(scope="session")
def grid_url() -> str:
    """Selenium / Appium Grid URL — built from GRID_HOST or GRID_URL env var."""
    if os.environ.get("GRID_URL"):
        return os.environ["GRID_URL"]
    grid_host = os.environ.get("GRID_HOST", "localhost:5555")
    return f"http://{grid_host}"


@pytest.fixture(scope="session")
def auth_token() -> str:
    """Auth token for Grid proxy.

    Fails fast on an expired token. Without this check an expired token
    produces `WebDriverException: Authorization Required` on EVERY test — dozens
    of red results whose message says nothing about the actual cause. That
    happened here: a token that expired days earlier wiped a full run and looked
    like a grid outage.

    Decode-only, no signature check — this is a usability guard, not auth. The
    grid still verifies the token properly; we are only reading `exp` so the
    failure names itself.
    """
    token = os.environ.get("AUTH_TOKEN", "{{AUTH_TOKEN}}")
    _assert_token_not_expired(token)
    return token


def _assert_token_not_expired(token: str) -> None:
    """Raise with a readable message if the JWT's `exp` is in the past."""
    if not token or token.startswith("{{"):
        return  # unset / placeholder — the no-grid local path handles this
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload))
    except Exception:
        return  # opaque or non-JWT token — nothing to check, let the grid decide
    exp = claims.get("exp")
    if not isinstance(exp, (int, float)):
        return
    if exp < time.time():
        when = time.strftime("%Y-%m-%d %H:%M", time.localtime(exp))
        raise pytest.UsageError(
            f"AUTH_TOKEN expired on {when} (user: {claims.get('email', 'unknown')}).\n"
            "Every test would fail with 'Authorization Required'. "
            "Generate a new token from the RobotActions dashboard and update .env."
        )


@pytest.fixture(scope="session")
def base_url() -> str:
    """Base URL of application under test (web only)."""
    return os.environ.get("BASE_URL", "{{BASE_URL}}")


@pytest.fixture(scope="session")
def platform() -> str:
    """Target platform: web | android | ios."""
    return os.environ.get("PLATFORM", "web").lower()


def _executor_url(grid_url: str, auth_token: str) -> str:
    """Build the remote executor URL using the appium-grid-service path-prefix
    auth pattern: the token is embedded as `/t/<token>` in the URL and the
    proxy strips it before forwarding to the Hub. Works for Selenium Grid and
    for Appium servers fronted by the same proxy."""
    if auth_token and auth_token != "{{AUTH_TOKEN}}":
        return f"{grid_url.rstrip('/')}/t/{auth_token}"
    return grid_url


@pytest.fixture(scope="function")
def browser(request, grid_url: str, auth_token: str) -> WebDriver:
    """Remote Chrome WebDriver via Selenium Grid (browser-only).

    Use this fixture in browser scenarios. For platform-aware steps that
    must work for both web and mobile, depend on `driver` instead.

    Notes:
    - Window size is set via --window-size Chrome flag at launch (not via
      maximize_window()) to avoid a race on the first in-session command when
      the Grid session→node route hasn't been registered yet.
    - goog:loggingPrefs enables browser-console log retrieval for "no console
      errors" assertions. Chrome 132+ Grid nodes may not support this; all
      consumer steps wrap get_log('browser') in try/except and warn rather than
      fail when the capability is missing.
    - No implicit_wait — all waits use explicit WebDriverWait to avoid masking
      real timing issues with the implicit-wait shadow.
    """
    options = ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    _apply_chrome_args(options)
    _apply_ra_testsuite(options)

    if os.environ.get("CI"):
        options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")

    # Pin sessions to the k8s chrome-148 stereotype. KEDA's selenium-grid
    # scaler for chrome-148 filters on browserVersion=148 — requests that
    # omit browserVersion do not match the trigger, so the autoscaler
    # never sees the demand and chrome-148 stays at min replicas. Setting
    # it here guarantees KEDA reacts to load from this client. Override
    # by setting RA_BROWSER_VERSION env var (e.g. "147" to target chrome-147).
    options.browser_version = os.environ.get("RA_BROWSER_VERSION", "148")

    # Enable browser-console log retrieval.  Chrome 132+ Grid nodes may drop
    # this CDP path; all consumer steps handle the missing-capability gracefully.
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    executor_url = _executor_url(grid_url, auth_token)
    driver = webdriver.Remote(command_executor=executor_url, options=options)

    # Implicit wait set to 0 — all waits in step defs use explicit WebDriverWait.
    # Implicit + explicit together can cause double-timeout; keeping at 0 avoids that.
    driver.implicitly_wait(0)

    _ra_tag_test(driver, request.node)

    yield driver

    _ra_report_result(driver, request.node)
    try:
        driver.quit()
    except Exception:
        pass


@pytest.fixture(scope="function")
def driver(platform: str, grid_url: str, auth_token: str) -> WebDriver:
    """Platform-aware WebDriver — Chrome (web), UiAutomator2 (android), or
    XCUITest (ios). Selected by the PLATFORM env var. Uses the same /t/<token>
    auth pattern across all three.
    """
    executor_url = _executor_url(grid_url, auth_token)

    if platform == "web":
        options = ChromeOptions()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        # Same k8s chrome-148 pin as the browser fixture — see comment there.
        options.browser_version = os.environ.get("RA_BROWSER_VERSION", "148")
        _apply_chrome_args(options)
        _apply_ra_testsuite(options)
        if os.environ.get("CI"):
            options.add_argument("--headless")
            options.add_argument("--disable-gpu")
        drv = webdriver.Remote(command_executor=executor_url, options=options)
        drv.implicitly_wait(10)
        drv.maximize_window()
        yield drv
        drv.quit()
        return

    if platform in ("mobileweb", "ios-mobileweb"):
        # Mobile web: the browser on a real handset via Appium.
        #
        # The browser is requested as appium:browserName, NOT the top-level W3C
        # browserName. Device slots advertise a native stereotype only
        # ({platformName: ANDROID, appium:automationName: uiautomator2, …}) with
        # no browserName at all, and Grid's slot matcher requires a browserName
        # match whenever one is requested — so the W3C form matches ZERO slots
        # and the hub queues the request until it times out. The appium: form is
        # invisible to the matcher, routes to the native slot, and the driver
        # opens the browser from inside the session.
        #
        # No udid: the grid distributes to any free device. Pinning one would
        # serialise every test onto a single handset.
        from appium import webdriver as appium_webdriver
        from appium.options.common import AppiumOptions

        is_ios = platform == "ios-mobileweb"
        options = AppiumOptions()
        options.set_capability("platformName", "iOS" if is_ios else "Android")
        options.set_capability(
            "appium:automationName", "XCUITest" if is_ios else "UiAutomator2")
        options.set_capability("appium:browserName", "safari" if is_ios else "chrome")
        options.set_capability("appium:newCommandTimeout", 180)
        _apply_ra_testsuite(options)

        drv = appium_webdriver.Remote(command_executor=executor_url, options=options)
        # Explicit waits only — see the browser fixture for why implicit is 0.
        drv.implicitly_wait(0)
        yield drv
        try:
            drv.quit()
        except Exception:
            pass
        return

    if platform == "android":
        from appium import webdriver as appium_webdriver
        from appium.options.android import UiAutomator2Options

        options = UiAutomator2Options()
        options.platform_name = "Android"
        options.automation_name = "UiAutomator2"
        options.device_name = os.environ.get("DEVICE_NAME", "Android Device")
        options.udid = os.environ.get("DEVICE_UDID", "{{DEVICE_UDID}}")
        app = os.environ.get("APP_PATH")
        if app and app != "{{APP_PATH}}":
            options.app = app
        version = os.environ.get("PLATFORM_VERSION")
        if version:
            options.platform_version = version

        drv = appium_webdriver.Remote(command_executor=executor_url, options=options)
        drv.implicitly_wait(10)
        yield drv
        drv.quit()
        return

    if platform == "ios":
        from appium import webdriver as appium_webdriver
        from appium.options.ios import XCUITestOptions

        options = XCUITestOptions()
        options.platform_name = "iOS"
        options.automation_name = "XCUITest"
        options.device_name = os.environ.get("DEVICE_NAME", "iPhone Simulator")
        options.udid = os.environ.get("DEVICE_UDID", "{{DEVICE_UDID}}")
        app = os.environ.get("APP_PATH")
        if app and app != "{{APP_PATH}}":
            options.app = app
        bundle_id = os.environ.get("BUNDLE_ID")
        if bundle_id:
            options.bundle_id = bundle_id
        version = os.environ.get("PLATFORM_VERSION")
        if version:
            options.platform_version = version

        drv = appium_webdriver.Remote(command_executor=executor_url, options=options)
        drv.implicitly_wait(10)
        yield drv
        drv.quit()
        return

    raise ValueError(
        f"Unknown PLATFORM={platform!r} "
        "(expected web|mobileweb|ios-mobileweb|android|ios)")
