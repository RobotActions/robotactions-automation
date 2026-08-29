@smoke @device
Feature: Device automation smoke
  As an automation engineer
  I want to confirm the automation session starts on the device
  So that I know the device automation stack is healthy
  before running real tests.

  # None of these scenarios need an app under test. A live session already
  # proves the automation server came up — including on iOS 17+/18+ devices,
  # where a preinstalled runner is used instead of building one per session.
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
