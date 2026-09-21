@app @wikipedia
Feature: Wikipedia sample app
  As an automation engineer
  I want a real, open-source app I can install from the App Library
  So that I can see an install-and-drive run before wiring up my own build.

  # This is the same app and the same scenario as Appwright's own example
  # (github.com/empirical-run/appwright, example/), installed from your
  # RobotActions App Library rather than a local file. Once, import it:
  #
  #   curl -X POST https://<rds-host>/apps/import-url \
  #        -H "Authorization: Bearer $AUTH_TOKEN" -H "Content-Type: application/json" \
  #        -d '{"url":"https://github.com/empirical-run/appwright/raw/main/example/builds/wikipedia.apk"}'
  #
  # then put the returned id in .env and run the suite:
  #
  #   APP_ID=<id>  APP_PACKAGE=org.wikipedia  PLATFORM=android
  #   npm run test:app
  #
  # It is skipped unless APP_PACKAGE is org.wikipedia, so a project pointed at
  # its own build never runs it by mistake. Android only — Appwright ships the
  # iOS build for the Simulator, which a real iPhone cannot run.

  Background:
    Given the Wikipedia app is on its first screen

  @smoke
  Scenario: Searching opens an article
    When I skip the onboarding
    And I search Wikipedia for "playwright"
    And I tap "Playwright (software)"
    Then "Microsoft" is on screen
