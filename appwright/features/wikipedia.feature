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
  # iOS: Appwright only ships the Simulator build, which a real iPhone cannot
  # run, so the grid repo builds one from source and signs it for the fleet
  # (appium-grid-service scripts/build-wikipedia-ios.sh). Upload the .ipa on
  # the Apps page or with POST /upload, then:
  #
  #   APP_ID=<id>  BUNDLE_ID=org.wikimedia.wikipedia.robotactions  PLATFORM=ios
  #
  # The two scenarios differ because the apps do: the 2022 Android APK has a
  # "Search Wikipedia" bar on its feed, today's iOS app has a Search tab.
  #
  # Both are skipped unless APP_PACKAGE / BUNDLE_ID names Wikipedia, so a
  # project pointed at its own build never runs them by mistake.

  @android @smoke
  Scenario: Searching opens an article (Android)
    Given the Wikipedia app is on its first screen
    When I skip the onboarding
    And I search Wikipedia for "playwright"
    And I tap "Playwright (software)"
    Then "Microsoft" is on screen

  @ios @smoke
  Scenario: Searching opens an article (iOS)
    Given the Wikipedia app is open past its onboarding
    When I open the Search tab
    And I type "playwright" into the search field
    And I tap "Playwright (software)"
    Then "Microsoft" is on screen
