package com.example.tests.steps;

/**
 * Thin per-scenario state bag — holds values that must survive across step
 * definition method calls within a single scenario.
 *
 * Pattern: ThreadLocal so each parallel Surefire fork gets its own isolated
 * copy.  Hooks.resetContext() is called in @Before to guarantee clean state at
 * the start of every scenario even when forks are reused (reuseForks=true).
 */
public final class ScenarioContext {

    private static final ThreadLocal<ScenarioContext> CURRENT =
        ThreadLocal.withInitial(ScenarioContext::new);

    /** The theme observed at the start of the theme-toggle scenario. */
    private String initialTheme;

    private ScenarioContext() {}

    public static ScenarioContext get() {
        return CURRENT.get();
    }

    /** Called from Hooks @Before to wipe state between scenarios. */
    public static void reset() {
        CURRENT.set(new ScenarioContext());
    }

    public String getInitialTheme() {
        return initialTheme;
    }

    public void setInitialTheme(String theme) {
        this.initialTheme = theme;
    }
}
