@smoke @tv
Feature: TV remote control
  As an automation engineer
  I want to drive a set-top device with its remote
  So that I can navigate a TV UI, which has no touchscreen to tap.

  # Runs on both TV platforms — PLATFORM=tvos (Apple TV) and PLATFORM=androidtv
  # (Android TV, Google TV, Chromecast) — from this one file. The button names are
  # neutral on purpose: "back" is Menu on an Apple TV and Back on Android TV, and
  # naming the intent rather than the vendor's label is what lets the scenarios be
  # shared. remote.ts maps them to `mobile: pressButton` names or Android keycodes.
  #
  # The rest of the TV coverage is features/device-smoke.feature: a TV session
  # answers the same platform, screenshot and hierarchy commands as a phone, so
  # those scenarios run unchanged. Only input differs, and that is this file.
  #
  # Skipped unless PLATFORM is a TV. Needs no app installed.

  Background:
    Given an automation session is live on a device

  Scenario: The remote moves the focus
    When I press "down" on the remote
    Then the UI hierarchy can be queried

  Scenario: The remote returns to the home screen
    When I press "home" on the remote
    Then the UI hierarchy can be queried

  Scenario: The remote can go back
    When I press "down" on the remote
    And I press "back" on the remote
    Then the UI hierarchy can be queried

  Scenario Outline: Every directional button is accepted
    When I press "<button>" on the remote
    Then the UI hierarchy can be queried

    Examples:
      | button |
      | up     |
      | down   |
      | left   |
      | right  |
      | select |
