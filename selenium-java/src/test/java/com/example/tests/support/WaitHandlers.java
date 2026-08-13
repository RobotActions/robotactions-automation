package com.example.tests.support;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.function.Function;

/**
 * Owns the waits, and nothing else — the single place a {@link WebDriverWait}
 * is constructed.
 *
 * <p>Three tiers are built once per driver and reused for the driver's whole
 * lifetime: {@link #shortWait()} (5 s, negative checks and animation polling),
 * {@link #defaultWait()} (10 s, element interaction), {@link #longWait()}
 * (15 s, page load and SPA hydration). Anything needing another budget calls
 * {@link #custom(Duration)}.
 *
 * <p>Element interaction lives in {@link ElementHandler}, which takes its
 * handlers from here. Page objects and step definitions should use one of the
 * two — never {@code new WebDriverWait(...)}.
 */
public final class WaitHandlers {

    /** Timeout tiers. */
    public static final Duration SHORT_TIMEOUT = Duration.ofSeconds(5);
    public static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(10);
    public static final Duration LONG_TIMEOUT = Duration.ofSeconds(15);

    /** Poll interval applied to every handler — the Selenium default is 500 ms. */
    public static final Duration POLL_INTERVAL = Duration.ofMillis(100);

    /**
     * Per-thread cache. Cucumber runs one scenario per thread with its own
     * driver (see {@code DriverHolder}), so the handlers live exactly as long
     * as the driver does.
     */
    private static final ThreadLocal<WaitHandlers> CACHE = new ThreadLocal<>();

    private final WebDriver driver;
    private final WebDriverWait shortWait;
    private final WebDriverWait defaultWait;
    private final WebDriverWait longWait;

    public WaitHandlers(WebDriver driver) {
        this.driver = driver;
        this.shortWait = custom(SHORT_TIMEOUT);
        this.defaultWait = custom(DEFAULT_TIMEOUT);
        this.longWait = custom(LONG_TIMEOUT);
    }

    /**
     * Returns this thread's handlers, rebuilding them if the thread is now
     * bound to a different driver (new scenario).
     */
    public static WaitHandlers forDriver(WebDriver driver) {
        WaitHandlers cached = CACHE.get();
        if (cached == null || cached.driver != driver) {
            cached = new WaitHandlers(driver);
            CACHE.set(cached);
        }
        return cached;
    }

    /** Drops this thread's handlers — called from the Cucumber @After hook. */
    public static void clear() {
        CACHE.remove();
    }

    public WebDriver driver() {
        return driver;
    }

    // ── Handlers ──────────────────────────────────────────────────────────

    public WebDriverWait shortWait() {
        return shortWait;
    }

    public WebDriverWait defaultWait() {
        return defaultWait;
    }

    public WebDriverWait longWait() {
        return longWait;
    }

    /** One-off handler for a timeout the tiers don't cover. */
    public WebDriverWait custom(Duration timeout) {
        WebDriverWait w = new WebDriverWait(driver, timeout);
        w.pollingEvery(POLL_INTERVAL);
        return w;
    }

    // ── Polling ───────────────────────────────────────────────────────────

    /**
     * Polls {@code condition} until it returns true; false on timeout. Callers
     * assert on the result instead of catching TimeoutException at every site.
     */
    public boolean awaitTrue(Function<WebDriver, Boolean> condition, WebDriverWait handler) {
        try {
            return Boolean.TRUE.equals(handler.until(condition));
        } catch (Exception e) {
            return false;
        }
    }

    /** Same, on the default 10 s tier. */
    public boolean awaitTrue(Function<WebDriver, Boolean> condition) {
        return awaitTrue(condition, defaultWait);
    }
}
