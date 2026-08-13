package com.example.tests.support;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.util.List;

/**
 * Element interaction — find, click, visibility — expressed on top of the
 * shared {@link WaitHandlers}.
 *
 * <p>Split from {@code WaitHandlers} deliberately: that class decides
 * <em>how long</em> to wait, this one decides <em>what to do</em> with the
 * element once it is there. A page object or step that needs a raw handler
 * reaches through {@link #waits()}.
 *
 * <p>Every method takes an explicit {@link WebDriverWait} or falls back to the
 * default 10 s tier. The {@code is*} methods swallow the timeout and return
 * false so callers can assert on the result.
 */
public final class ElementHandler {

    private static final ThreadLocal<ElementHandler> CACHE = new ThreadLocal<>();

    private final WebDriver driver;
    private final WaitHandlers waits;

    public ElementHandler(WebDriver driver) {
        this.driver = driver;
        this.waits = WaitHandlers.forDriver(driver);
    }

    /** This thread's handler, rebuilt when the thread's driver is replaced. */
    public static ElementHandler forDriver(WebDriver driver) {
        ElementHandler cached = CACHE.get();
        if (cached == null || cached.driver != driver) {
            cached = new ElementHandler(driver);
            CACHE.set(cached);
        }
        return cached;
    }

    /** Drops this thread's handler — called from the Cucumber @After hook. */
    public static void clear() {
        CACHE.remove();
    }

    public WaitHandlers waits() {
        return waits;
    }

    public WebDriver driver() {
        return driver;
    }

    // ── Element access ────────────────────────────────────────────────────

    public WebElement present(By locator) {
        return present(locator, waits.defaultWait());
    }

    public WebElement present(By locator, WebDriverWait handler) {
        return handler.until(ExpectedConditions.presenceOfElementLocated(locator));
    }

    public WebElement visible(By locator) {
        return visible(locator, waits.defaultWait());
    }

    public WebElement visible(By locator, WebDriverWait handler) {
        return handler.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    public List<WebElement> all(By locator) {
        return driver.findElements(locator);
    }

    /**
     * First <em>displayed</em> element matching {@code locator}, ignoring hidden
     * matches earlier in the DOM.
     *
     * <p>Needed on the responsive site: several controls (theme toggle, language
     * switcher) render twice — a desktop node that stays hidden at mobile widths
     * and a mobile node that is visible. {@link #visible(By, WebDriverWait)} uses
     * {@code findElement}, which only ever inspects the FIRST match, so it times
     * out on exactly those controls. Use this whenever a locator can match a
     * hidden duplicate.
     */
    public WebElement anyVisible(By locator) {
        return anyVisible(locator, waits.defaultWait());
    }

    public WebElement anyVisible(By locator, WebDriverWait handler) {
        return handler.until(d -> d.findElements(locator).stream()
            .filter(WebElement::isDisplayed)
            .findFirst()
            .orElse(null));
    }

    public boolean isAnyVisible(By locator) {
        return isAnyVisible(locator, waits.defaultWait());
    }

    public boolean isAnyVisible(By locator, WebDriverWait handler) {
        try {
            return anyVisible(locator, handler) != null;
        } catch (Exception e) {
            return false;
        }
    }

    /** Clicks the first displayed match — the click counterpart of {@link #anyVisible}. */
    public void clickAnyVisible(By locator) {
        clickAnyVisible(locator, waits.defaultWait());
    }

    public void clickAnyVisible(By locator, WebDriverWait handler) {
        anyVisible(locator, handler).click();
    }

    public void click(By locator) {
        click(locator, waits.defaultWait());
    }

    public void click(By locator, WebDriverWait handler) {
        handler.until(ExpectedConditions.elementToBeClickable(locator)).click();
    }

    public void type(By locator, String text) {
        WebElement el = present(locator);
        el.clear();
        el.sendKeys(text);
    }

    public String text(By locator) {
        return present(locator).getText();
    }

    // ── Boolean-returning checks ──────────────────────────────────────────

    public boolean isVisible(By locator) {
        return isVisible(locator, waits.defaultWait());
    }

    public boolean isVisible(By locator, WebDriverWait handler) {
        try {
            return visible(locator, handler) != null;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean isClickable(By locator, WebDriverWait handler) {
        try {
            return handler.until(ExpectedConditions.elementToBeClickable(locator)) != null;
        } catch (Exception e) {
            return false;
        }
    }

    /** Polls until no element matching {@code locator} is displayed. */
    public boolean awaitNotDisplayed(By locator, WebDriverWait handler) {
        return waits.awaitTrue(d -> {
            List<WebElement> matches = d.findElements(locator);
            return matches.isEmpty() || matches.stream().noneMatch(WebElement::isDisplayed);
        }, handler);
    }

    // ── Scripting ─────────────────────────────────────────────────────────

    public Object executeScript(String script, Object... args) {
        return ((JavascriptExecutor) driver).executeScript(script, args);
    }

    /** Waits for {@code document.readyState == "complete"}. */
    public void documentReady(WebDriverWait handler) {
        waits.awaitTrue(d -> "complete".equals(
            ((JavascriptExecutor) d).executeScript("return document.readyState")), handler);
    }
}
