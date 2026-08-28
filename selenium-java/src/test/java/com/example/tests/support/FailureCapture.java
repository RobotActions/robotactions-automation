package com.example.tests.support;

import io.cucumber.plugin.ConcurrentEventListener;
import io.cucumber.plugin.event.EventPublisher;
import io.cucumber.plugin.event.TestStepFinished;

/**
 * Captures the throwable from the step that actually failed, so the
 * {@code @After} hook can report WHY a scenario failed rather than just that
 * it did.
 *
 * Cucumber-JVM's {@code Scenario} exposes {@code isFailed()} but no error, so
 * Hooks previously sent the SCENARIO NAME as the failure reason:
 *
 *   ra:job-result=failed:Hero section renders headline
 *
 * which restated the test's own title. The dashboard's failure column read as
 * a list of test names and told you nothing about the cause.
 *
 * Ordering is what makes this work. {@code TestStepFinished} fires after every
 * step, including the failing one, and the {@code @After} hook is itself a
 * later step — so by the time the hook runs, the error is already stashed.
 * ({@code TestCaseFinished} carries the error too, but fires AFTER the hooks,
 * by which point the driver is gone.)
 *
 * ThreadLocal because Cucumber runs scenarios in parallel and the driver is
 * already held per-thread; a shared field would cross-report reasons between
 * concurrently failing scenarios.
 */
public class FailureCapture implements ConcurrentEventListener {

    private static final ThreadLocal<Throwable> LAST_ERROR = new ThreadLocal<>();

    @Override
    public void setEventPublisher(EventPublisher publisher) {
        publisher.registerHandlerFor(TestStepFinished.class, (TestStepFinished event) -> {
            Throwable error = event.getResult().getError();
            // Only overwrite on a real error: the passing steps that follow a
            // failure (hooks, cleanup) must not erase the reason.
            if (error != null) {
                LAST_ERROR.set(error);
            }
        });
    }

    /** Error from the failing step of the current scenario, or null. */
    public static Throwable last() {
        return LAST_ERROR.get();
    }

    /** Cleared in the Before hook so a reason never leaks into the next scenario. */
    public static void clear() {
        LAST_ERROR.remove();
    }
}
