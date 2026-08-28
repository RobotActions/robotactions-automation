package com.example.tests.steps;

import com.example.tests.config.DriverFactory;
import com.example.tests.config.DriverHolder;
import com.example.tests.support.ElementHandler;
import com.example.tests.support.WaitHandlers;
import io.cucumber.java.Before;
import io.cucumber.java.After;
import io.cucumber.java.Scenario;
import com.example.tests.support.FailureCapture;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

public class Hooks {

    @Before
    public void start(Scenario scenario) {
        ScenarioContext.reset();
        // Drop any error captured by the previous scenario on this thread —
        // otherwise a passing scenario could inherit the last failure's reason.
        FailureCapture.clear();
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
                        ? "ra:job-result=failed:" + failureReason(scenario)
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

    /**
     * Why the scenario failed, for {@code ra:job-result=failed:<reason>}.
     *
     * Cucumber's Scenario carries no error, so this used to send the scenario
     * NAME — restating the test's own title and telling you nothing about the
     * cause. FailureCapture stashes the failing step's throwable; the name is
     * kept only as a last resort.
     *
     * MUST be a single line. The reason is interpolated into a magic string
     * the grid proxy matches with an anchored pattern, and a raw exception
     * message can be multi-line — an unsanitised one used to fall through the
     * intercept, reach the browser as literal JavaScript, and lose the verdict
     * entirely. (The proxy tolerates newlines now, but emitting one line is
     * still the client's job.) A stack's first line is the message, so taking
     * it loses nothing.
     */
    private static String failureReason(Scenario scenario) {
        Throwable error = FailureCapture.last();
        String raw = null;
        if (error != null) {
            raw = error.getMessage();
            // Some assertion errors carry no message — the class name at least
            // says what kind of failure it was.
            if (raw == null || raw.trim().isEmpty()) {
                raw = error.getClass().getSimpleName();
            }
        }
        if (raw == null || raw.trim().isEmpty()) {
            raw = scenario.getName();
        }
        return truncate(singleLine(raw));
    }

    /** First line, whitespace collapsed. */
    private static String singleLine(String s) {
        if (s == null) return "scenario failed";
        int nl = s.indexOf('\n');
        String first = nl >= 0 ? s.substring(0, nl) : s;
        first = first.replaceAll("\\s+", " ").trim();
        return first.isEmpty() ? "scenario failed" : first;
    }

    private static String truncate(String s) {
        if (s == null) return "scenario failed";
        return s.length() > 200 ? s.substring(0, 200) : s;
    }
}
