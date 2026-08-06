@smoke @device
Feature: Device automation smoke
  As an automation engineer
  I want to confirm the automation session starts on the device
  So that I know WebDriverAgent (iOS) / UiAutomator2 (Android) is healthy
  before running real tests.

  # This scenario needs no app under test — a live session means the underlying
  # automation server (WDA on iOS, launched with zero xcodebuild when
  # USE_PREINSTALLED_WDA=true) came up and the device is reachable.
  # See docs/IOS18_APPIUM_PREINSTALLED_WDA.md in the RemoteDeviceServer repo.

  Scenario: Automation server starts and the device is reachable
    Given an automation session is active
    Then the device reports a valid screen size
    And the page source is retrievable
    And the device orientation is readable
