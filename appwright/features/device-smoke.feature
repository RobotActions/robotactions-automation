@smoke @device
Feature: Device automation smoke
  As an automation engineer
  I want to confirm an Appwright session starts on a real device on the grid
  So that I know the stack is healthy before running app tests.

  # None of these scenarios need an app under test, which is why a fresh clone
  # is green: a live session already proves the grid handed out a device and the
  # automation server came up on it.
  #
  # They are separate scenarios rather than one, so a failure names the
  # capability that broke instead of collapsing every check into a single red
  # test.

  Background:
    Given an automation session is live on a device

  Scenario: The device matches the platform that was requested
    Then the session runs on the requested platform

  Scenario: A screenshot can be captured from the device
    Then a screenshot can be captured

  Scenario: The UI hierarchy is queryable
    Then the UI hierarchy can be queried

  Scenario: The session survives a round trip
    Then the device still responds after a second command
