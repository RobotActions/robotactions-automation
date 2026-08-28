package com.example.tests.runners;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.example.tests.steps")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
    // FailureCapture is what lets the After hook report WHY a scenario failed
    // rather than echoing its name — registered as a plugin because that is the
    // only place Cucumber exposes a step's throwable.
    value = "pretty, summary, html:reports/cucumber.html, json:reports/cucumber.json, junit:reports/junit.xml,"
          + " com.example.tests.support.FailureCapture")
public class RunCucumberTest {
}
