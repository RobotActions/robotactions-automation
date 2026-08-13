@smoke @device
Feature: Device automation smoke
  As an automation engineer
  I want to confirm the automation session starts on the device
  So that I know WebDriverAgent (iOS) / UiAutomator2 (Android) is healthy
  before running real tests.

  # None of these scenarios need an app under test. A live session already
  # proves the automation server came up — on iOS 17+/18+ HID devices that
  # means the preinstalled WDA was launched via devicectl with zero xcodebuild
  # (see docs/IOS18_APPIUM_PREINSTALLED_WDA.md in the RemoteDeviceServer repo).
  #
  # They are separate scenarios rather than one, so a failure names the
  # capability that broke instead of collapsing every check into a single
  # red test.

  Background:
    Given an automation session is active

  Scenario: The automation server starts and the session is live
    Then the session reports a device platform

  Scenario: The device reports usable screen dimensions
    Then the device reports a valid screen size

  Scenario: The UI hierarchy can be dumped
    Then the page source is retrievable

  Scenario: The device orientation can be read
    Then the device orientation is readable

  Scenario: The session survives a round-trip command
    Then the device still responds after a second command
