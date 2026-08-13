package com.example.tests.steps;

import com.example.tests.config.DriverFactory;
import com.example.tests.config.DriverHolder;
import com.example.tests.support.ElementHandler;
import com.example.tests.support.WaitHandlers;
import io.cucumber.java.Before;
import io.cucumber.java.After;
import io.cucumber.java.Scenario;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

public class Hooks {

    @Before
    public void start(Scenario scenario) {
        ScenarioContext.reset();
        DriverHolder.set(DriverFactory.create());
        // Annotate the Grid session with the Cucumber scenario name so the
        // RobotActions dashboard shows the test name against each session.
        // The ra:job-name= magic verb is processed by the appium-session-plugin
        // and stored in sessions.test_name via executeScript interception.
        WebDriver driver = DriverHolder.get();
        ((JavascriptExecutor) driver).executeScript("ra:job-name=" + scenario.getName());
    }

    @After
    public void stop(Scenario scenario) {
        // Report pass/fail on the same Grid session before quitting so
        // sessions.result is populated alongside test_name. ra:job-result is a
        // magic verb intercepted by the appium-session-plugin (not forwarded to
        // the browser). Best-effort — never let reporting fail the teardown.
        try {
            WebDriver driver = DriverHolder.get();
            if (driver != null) {
                String verb = scenario.isFailed()
                        ? "ra:job-result=failed:" + truncate(scenario.getName())
                        : "ra:job-result=passed";
                ((JavascriptExecutor) driver).executeScript(verb);
            }
        } catch (Exception ignored) {
            // reporting is best-effort
        }
        DriverHolder.quit();
        // Drop this thread's handlers along with the driver they wrap.
        ElementHandler.clear();
        WaitHandlers.clear();
    }

    private static String truncate(String s) {
        if (s == null) return "scenario failed";
        return s.length() > 200 ? s.substring(0, 200) : s;
    }
}
