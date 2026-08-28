package com.example.tests.config;

import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.options.UiAutomator2Options;
import io.appium.java_client.ios.IOSDriver;
import io.appium.java_client.ios.options.XCUITestOptions;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.HttpCommandExecutor;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.openqa.selenium.remote.http.AddSeleniumUserAgent;
import org.openqa.selenium.remote.http.ClientConfig;
import org.openqa.selenium.remote.http.Filter;
import org.openqa.selenium.remote.http.HttpRequest;

import java.net.URI;
import java.net.URL;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

public final class DriverFactory {

    /**
     * Session-creation timeout. On KEDA-scaled grids the chrome-148 deployment
     * starts at min=2 pods and scales up only after the scaler's pollingInterval
     * (~20 s) plus pod startup (~30-60 s on cold image cache). A burst of N
     * concurrent createSession calls where N &gt; current ready pods will queue
     * in the hub for that scale-up window. 300 s safely covers both polling +
     * startup at the upper end. Below this value, parallel sanity/regression
     * runs intermittently fail with HttpTimeoutException on the very first
     * commands of each scenario before KEDA can react.
     */
    private static final Duration SESSION_TIMEOUT = Duration.ofSeconds(300);

    /** Read-timeout for in-session commands (navigate, click, find, etc.). */
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(60);

    /**
     * Read-timeout for the Appium platforms.
     *
     * <p>{@link Http11HttpClientFactory} applies {@code ClientConfig.readTimeout}
     * to EVERY request, {@code POST /session} included — {@code connectionTimeout}
     * only bounds the TCP connect, not the wait for a response. Creating a
     * mobile-web session on a real handset routinely exceeds 60 s (UiAutomator2
     * server install, Chrome cold start, chromedriver version match), so the web
     * value fails every scenario with {@code HttpTimeoutException} before the
     * device is ready. 300 s matches the grid node's own sessionTimeout.
     */
    private static final Duration MOBILE_READ_TIMEOUT = Duration.ofSeconds(300);

    private DriverFactory() {}

    public static WebDriver create() {
        String platform = Env.platform();
        return switch (platform) {
            case "web"            -> createWeb();
            case "mobileweb"      -> createMobileWeb();
            case "ios-mobileweb"  -> createIosMobileWeb();
            case "android"        -> createAndroid();
            case "ios"            -> createIos();
            default               -> throw new IllegalArgumentException(
                "Unknown PLATFORM=" + platform
                    + " (expected web|mobileweb|ios-mobileweb|android|ios)");
        };
    }

    // ── URL helpers ────────────────────────────────────────────────────────

    private static URL executorUrl() {
        // Token is sent via Authorization: Bearer header (see authHeaderFilter),
        // NOT via /t/<token> path prefix. Selenium's JdkHttpClient composes
        // per-command URIs as `config.baseUrl().toString() + request.getUri()`,
        // and on Selenium 4.27 the request.getUri for in-session commands is
        // absolute (e.g. /session/<id>/url) — when concatenated against a
        // baseUrl whose path already contains `/t/<token>`, the proxy receives
        // the prefix but the k8s Selenium router (4.44) silently mis-routes
        // some POSTs (returns RouteNotFoundException). Header-based auth is
        // the documented alternative for Selenium clients that can set custom
        // headers — only Appium Inspector + WebdriverIO require the path form.
        try {
            return URI.create(Env.gridUrl()).toURL();
        } catch (Exception e) {
            throw new RuntimeException("Bad grid URL: " + Env.gridUrl(), e);
        }
    }

    /** Filter that adds {@code Authorization: Bearer <token>} to every
     *  WebDriver request when AUTH_TOKEN is set. Skipped when the placeholder
     *  literal is in place (template clone-time substitution didn't happen). */
    private static Filter authHeaderFilter() {
        String token = Env.authToken();
        boolean hasToken = token != null && !token.isBlank() && !token.equals("{{AUTH_TOKEN}}");
        return next -> req -> {
            if (hasToken) {
                req.addHeader("Authorization", "Bearer " + token);
            }
            return next.execute(req);
        };
    }

    /**
     * Build a {@link HttpCommandExecutor} with extended timeouts.
     *
     * <p>The default Selenium 4 JDK HTTP client uses a ~30 s timeout for ALL
     * requests including session creation.  When the Grid is busy it can queue
     * a new-session request for up to 90 s, causing spurious
     * {@code SessionNotCreatedException: TimeoutException} failures on the first
     * step of every Cucumber scenario.  Raising the read timeout to 120 s covers
     * that window without masking real hangs.
     */
    private static HttpCommandExecutor buildExecutor() {
        return buildExecutor(READ_TIMEOUT);
    }

    private static HttpCommandExecutor buildExecutor(Duration readTimeout) {
        ClientConfig cfg = ClientConfig.defaultConfig()
            .baseUrl(executorUrl())
            .readTimeout(readTimeout)
            .connectionTimeout(SESSION_TIMEOUT)
            .withFilter(authHeaderFilter().andThen(new AddSeleniumUserAgent()));
        // HTTP/1.1-only client — see Http11HttpClientFactory javadoc for the
        // h2c-upgrade incompatibility with the appium-grid-service proxy.
        // Use the (Map, ClientConfig, Factory) constructor — Selenium 4.27
        // doesn't offer a (Map, URL, ClientConfig, Factory) overload, but
        // ClientConfig.baseUrl() carries the URL.
        return new HttpCommandExecutor(Map.of(), cfg, new Http11HttpClientFactory());
    }

    // ── Platform factories ─────────────────────────────────────────────────

    private static WebDriver createWeb() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--no-sandbox", "--disable-dev-shm-usage", "--window-size=1920,1080");
        if (Env.ci()) {
            options.addArguments("--headless=new", "--disable-gpu");
        }
        // Pin sessions to the k8s chrome-148 stereotype (browserName=chrome,
        // browserVersion=148, platformName=any). This prevents the Selenium hub
        // from routing the session to a local-Mac Appium Android Chrome slot
        // if one ever appears in the stereotype set — we want the cloud k8s
        // chrome-148 pods (KEDA-scaled) every time.
        options.setBrowserVersion("148");
        // Enable browser-console log retrieval for "no console errors" assertions.
        // Chrome 132+ may not support this; RobotActionsLoadSteps.assertNoConsoleSevereErrors()
        // wraps the call in try/catch so missing log support produces a warning, not a failure.
        Map<String, Object> logPrefs = new HashMap<>();
        logPrefs.put("browser", "ALL");
        options.setCapability("goog:loggingPrefs", logPrefs);
        // Group this run in the dashboard. Both mobile paths below already set
        // this; the desktop path did not, so every web session landed with an
        // empty Suite column and could not be filtered or rolled up — it was
        // indistinguishable from the untagged internal traffic.
        options.setCapability("ra:testsuite", Env.testSuite());

        // One-shot retry on createSession failure for two known-transient
        // proxy responses:
        //   1. "Auth service unavailable" — the appium-grid-service proxy's
        //      remote validate against RemoteDeviceServer has a 5s timeout
        //      and the validate endpoint occasionally exceeds that on the
        //      first cold call of a run. Subsequent calls within 60s hit
        //      the proxy's in-memory token cache and never re-validate, so
        //      a single retry effectively pre-warms the cache.
        //   2. "Concurrency limit reached" — proxy per-identity semaphore.
        //      A short pause lets in-flight createSessions release their
        //      slots (or fail and be reaped). Retries do not loop indefinitely;
        //      one attempt is enough for both transients we've actually seen.
        RemoteWebDriver driver;
        try {
            driver = new RemoteWebDriver(buildExecutor(), options);
        } catch (org.openqa.selenium.SessionNotCreatedException e) {
            String msg = e.getMessage() == null ? "" : e.getMessage();
            boolean transientProxyReject =
                msg.contains("Auth service unavailable")
                    || msg.contains("Concurrency limit reached");
            if (!transientProxyReject) throw e;
            try { Thread.sleep(2000); } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw e;
            }
            driver = new RemoteWebDriver(buildExecutor(), options);
        }
        // Window size is set via the --window-size Chrome flag at launch instead of
        // a post-create maximize() call. The /t/<token>-prefixed proxy intermittently
        // returns "Unable to find handler" for the very first in-session command when
        // the k8s Selenium router hasn't yet registered the session→node route — using
        // a launch flag sidesteps that race entirely. Explicit WebDriverWait is used
        // throughout page objects, so no implicit wait either.
        return driver;
    }

    /**
     * Mobile web: Chrome on a real Android device via Appium.
     *
     * <p>Requests the browser with {@code appium:browserName} — the Appium
     * extension cap — NOT plain W3C {@code browserName}. The grid's device
     * nodes advertise a single native stereotype carrying only
     * {@code platformName: ANDROID} plus {@code appium:*} keys; the mobile-web
     * second-stereotype that used to advertise {@code browserName: chrome} was
     * removed from appium-grid-service's TOML generator (src/generators/toml.ts,
     * 2026-06-21) because it added a second slot per handset and let the
     * distributor hand out two concurrent sessions to one device.
     *
     * <p>Selenium's DefaultSlotMatcher compares only W3C {@code browserName};
     * sending it here matches no slot at all, so the hub queues the request
     * until the client read-timeout and every scenario dies with
     * {@code SessionNotCreatedException: HttpTimeoutException}. The
     * {@code appium:}-prefixed form is invisible to the matcher, so the native
     * slot matches on platformName and uiautomator2 opens Chrome via
     * chromedriver from inside the session.
     *
     * <p>{@link ChromeOptions} cannot express this — it always stamps W3C
     * {@code browserName: chrome} — hence plain DesiredCapabilities.
     *
     * <p>No {@code appium:udid}: the grid distributes the session to any free
     * Android slot. Pinning a udid would serialise every scenario onto one
     * handset and fail outright whenever that handset is busy or offline.
     * chromedriver is auto-managed by the uiautomator2 driver server-side.
     */
    private static WebDriver createMobileWeb() {
        org.openqa.selenium.remote.DesiredCapabilities caps =
            new org.openqa.selenium.remote.DesiredCapabilities();
        caps.setCapability("platformName", "Android");
        caps.setCapability("appium:automationName", "UiAutomator2");
        caps.setCapability("appium:browserName", "chrome");
        caps.setCapability("appium:newCommandTimeout", 180);
        caps.setCapability("ra:testsuite", Env.testSuite());
        return new RemoteWebDriver(buildExecutor(MOBILE_READ_TIMEOUT), caps);
    }

    /**
     * iOS Safari mobile-web: Safari on a real iOS device via Appium XCUITest.
     *
     * <p>Uses {@code appium:browserName} rather than W3C {@code browserName}
     * for the same routing reason as {@link #createMobileWeb()} — the iOS
     * device nodes advertise only {@code platformName: IOS} plus
     * {@code appium:*} keys, so a W3C browserName matches no slot and the
     * request queues until timeout.
     *
     * <p>Device prereq: Settings → Safari → Advanced → Web Inspector and
     * Remote Automation both enabled.
     *
     * <p>No {@code appium:udid} — same reasoning as {@link #createMobileWeb()}:
     * the grid distributes to any free iOS slot.
     */
    private static WebDriver createIosMobileWeb() {
        // The XCUITest driver handles the WebDriverAgent + safaridriver bridge
        // automatically once appium:browserName selects Safari.
        org.openqa.selenium.remote.DesiredCapabilities caps =
            new org.openqa.selenium.remote.DesiredCapabilities();
        caps.setCapability("appium:browserName", "safari");
        caps.setCapability("platformName", "iOS");
        caps.setCapability("appium:automationName", "XCUITest");
        caps.setCapability("appium:newCommandTimeout", 180);
        caps.setCapability("ra:testsuite", Env.testSuite());
        return new RemoteWebDriver(buildExecutor(MOBILE_READ_TIMEOUT), caps);
    }

    private static WebDriver createAndroid() {
        UiAutomator2Options options = new UiAutomator2Options()
            .setPlatformName("Android")
            .setAutomationName("UiAutomator2")
            .setDeviceName(Env.get("DEVICE_NAME", "Android Device"))
            .setUdid(Env.get("DEVICE_UDID", "{{DEVICE_UDID}}"));

        String app = Env.get("APP_PATH", null);
        if (app != null && !app.equals("{{APP_PATH}}")) {
            options.setApp(app);
        }
        String version = Env.get("PLATFORM_VERSION", null);
        if (version != null) options.setPlatformVersion(version);

        AndroidDriver driver = new AndroidDriver(executorUrl(), options);
        return driver;
    }

    private static WebDriver createIos() {
        XCUITestOptions options = new XCUITestOptions()
            .setPlatformName("iOS")
            .setAutomationName("XCUITest")
            .setDeviceName(Env.get("DEVICE_NAME", "iPhone Simulator"))
            .setUdid(Env.get("DEVICE_UDID", "{{DEVICE_UDID}}"));

        String app = Env.get("APP_PATH", null);
        if (app != null && !app.equals("{{APP_PATH}}")) {
            options.setApp(app);
        }
        String bundleId = Env.get("BUNDLE_ID", null);
        if (bundleId != null) options.setBundleId(bundleId);
        String version = Env.get("PLATFORM_VERSION", null);
        if (version != null) options.setPlatformVersion(version);

        IOSDriver driver = new IOSDriver(executorUrl(), options);
        return driver;
    }
}
