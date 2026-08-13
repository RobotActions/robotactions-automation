package com.example

import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.espresso.matcher.ViewMatchers.withText
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Minimal, standard Espresso instrumented test (no third-party test DSLs).
 * Runs ON the device via AndroidJUnitRunner. Several methods so the runner
 * has something to distribute across a device pool.
 */
@RunWith(AndroidJUnit4::class)
class MainActivityTest {

    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    @Test
    fun editText_isDisplayed() {
        onView(withId(R.id.edittext)).check(matches(isDisplayed()))
    }

    @Test
    fun editText_showsExpectedText() {
        onView(withId(R.id.edittext)).check(matches(withText("Test")))
    }

    @Test
    fun editText_isDisplayed_again() {
        onView(withId(R.id.edittext)).check(matches(isDisplayed()))
    }

    @Test
    fun editText_showsExpectedText_again() {
        onView(withId(R.id.edittext)).check(matches(withText("Test")))
    }
}
