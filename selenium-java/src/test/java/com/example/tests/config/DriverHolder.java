package com.example.tests.config;

import org.openqa.selenium.WebDriver;

public final class DriverHolder {

    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    private DriverHolder() {}

    public static void set(WebDriver driver) {
        DRIVER.set(driver);
    }

    public static WebDriver get() {
        WebDriver driver = DRIVER.get();
        if (driver == null) {
            throw new IllegalStateException(
                "No WebDriver bound to this thread. Did the Cucumber Hooks @Before run?");
        }
        return driver;
    }

    public static void quit() {
        WebDriver driver = DRIVER.get();
        if (driver != null) {
            try { driver.quit(); } finally { DRIVER.remove(); }
        }
    }
}
