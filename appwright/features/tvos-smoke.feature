@smoke @tvos
Feature: Apple TV remote control
  As an automation engineer
  I want to drive an Apple TV with the Siri Remote
  So that I can navigate tvOS, which has no touchscreen to tap.

  # The rest of the tvOS coverage is features/device-smoke.feature — a tvOS
  # session answers the same platform, screenshot and hierarchy commands as iOS,
  # so those scenarios run unchanged when PLATFORM=tvos. Only input differs, and
  # that is what this file covers.
  #
  # There is no "tap this element" on tvOS: you move a focus ring with the
  # directional pad and press Select on whatever is focused. Presses come from the
  # `remote` fixture (see remote.ts).
  #
  # Skipped unless PLATFORM includes tvos. Needs no app installed.

  Background:
    Given an automation session is live on a device

  Scenario: The remote moves the focus
    When I press "Down" on the remote
    Then the UI hierarchy can be queried

  Scenario: The remote returns to the home screen
    When I press "Home" on the remote
    Then the UI hierarchy can be queried

  Scenario Outline: Every directional button is accepted
    When I press "<button>" on the remote
    Then the UI hierarchy can be queried

    Examples:
      | button |
      | Up     |
      | Down   |
      | Left   |
      | Right  |
