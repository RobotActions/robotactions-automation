package com.example.tests.pages;

import com.example.tests.support.ElementHandler;
import com.example.tests.support.WaitHandlers;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.List;
import java.util.function.Function;

/**
 * Base class for all page objects.
 *
 * <p>Two shared, per-driver handlers are resolved once in this constructor and
 * inherited by every page object — subclasses never construct a
 * {@link WebDriverWait}. {@link WaitHandlers} decides how long to wait
 * ({@link #shortWait} / {@link #wait} / {@link #longWait});
 * {@link ElementHandler} decides what to do with the element. Page methods
 * express intent ({@code isVisible}, {@code click}, {@code awaitTrue}) and
 * pick a tier.
 */
public abstract class BasePage {

    protected final WebDriver driver;
    protected final String baseUrl;

    /** Wait tiers — shared with step definitions via {@code WaitHandlers.forDriver}. */
    protected final WaitHandlers waits;
    /** Element interaction on top of those tiers. */
    protected final ElementHandler elements;

    /** 5 s — negative checks and dropdown/animation polling. */
    protected final WebDriverWait shortWait;
    /** 10 s — the default for element interaction and visibility. */
    protected final WebDriverWait wait;
    /** 15 s — page load and SPA hydration. */
    protected final WebDriverWait longWait;

    protected BasePage(WebDriver driver, String baseUrl) {
        this.driver = driver;
        this.baseUrl = baseUrl == null ? "" : baseUrl;
        this.waits = WaitHandlers.forDriver(driver);
        this.elements = ElementHandler.forDriver(driver);
        this.shortWait = waits.shortWait();
        this.wait = waits.defaultWait();
        this.longWait = waits.longWait();
    }

    /** Handler for a timeout the three tiers don't cover. */
    protected WebDriverWait newWait(Duration timeout) {
        return waits.custom(timeout);
    }

    public void open(String path) {
        driver.get(baseUrl + (path == null ? "" : path));
    }

    // ── Element access ────────────────────────────────────────────────────

    protected WebElement find(By locator) {
        return elements.present(locator);
    }

    protected WebElement find(By locator, WebDriverWait handler) {
        return elements.present(locator, handler);
    }

    protected WebElement waitVisible(By locator) {
        return elements.visible(locator);
    }

    protected WebElement waitVisible(By locator, WebDriverWait handler) {
        return elements.visible(locator, handler);
    }

    protected void click(By locator) {
        elements.click(locator);
    }

    protected void click(By locator, WebDriverWait handler) {
        elements.click(locator, handler);
    }

    protected void type(By locator, String text) {
        elements.type(locator, text);
    }

    protected String text(By locator) {
        return elements.text(locator);
    }

    protected List<WebElement> findAll(By locator) {
        return elements.all(locator);
    }

    // ── Boolean-returning waits ───────────────────────────────────────────

    protected boolean isVisible(By locator) {
        return elements.isVisible(locator);
    }

    protected boolean isVisible(By locator, WebDriverWait handler) {
        return elements.isVisible(locator, handler);
    }

    protected boolean isClickable(By locator, WebDriverWait handler) {
        return elements.isClickable(locator, handler);
    }

    /** First displayed match — use when the locator can also match a hidden duplicate. */
    protected WebElement anyVisible(By locator, WebDriverWait handler) {
        return elements.anyVisible(locator, handler);
    }

    protected boolean isAnyVisible(By locator) {
        return elements.isAnyVisible(locator);
    }

    protected boolean isAnyVisible(By locator, WebDriverWait handler) {
        return elements.isAnyVisible(locator, handler);
    }

    protected void clickAnyVisible(By locator) {
        elements.clickAnyVisible(locator);
    }

    protected void clickAnyVisible(By locator, WebDriverWait handler) {
        elements.clickAnyVisible(locator, handler);
    }

    protected boolean awaitTrue(Function<WebDriver, Boolean> condition, WebDriverWait handler) {
        return waits.awaitTrue(condition, handler);
    }

    protected boolean awaitNotDisplayed(By locator, WebDriverWait handler) {
        return elements.awaitNotDisplayed(locator, handler);
    }

    // ── Scripting ─────────────────────────────────────────────────────────

    protected Object executeScript(String script, Object... args) {
        return elements.executeScript(script, args);
    }

    /** Waits for {@code document.readyState == "complete"}. */
    protected void waitForDocumentReady(WebDriverWait handler) {
        elements.documentReady(handler);
    }

    public String title() {
        return driver.getTitle();
    }

    public String currentUrl() {
        return driver.getCurrentUrl();
    }
}
