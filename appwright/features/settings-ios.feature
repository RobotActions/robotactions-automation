@settings @ios
Feature: Settings app walkthrough (iOS)
  As an automation engineer
  I want to drive a real app without installing a build first
  So that I can prove the locators, taps and scrolling work on this device.

  # The iOS counterpart of settings-android.feature. Read-only throughout, and
  # opt-in via RUN_SETTINGS_WALKTHROUGH=true for the same reason: these are
  # stock iPadOS labels and identifiers.

  Background:
    Given the Settings app is open

  Scenario: Sidebar entries are on screen
    Then "Accessibility" is on screen
    And the text of "Battery" is "Battery"

  Scenario: An element can be found by its identifier
    # getById is an -ios predicate on `name`, i.e. the accessibilityIdentifier.
    Then the element with id "com.apple.settings.general" is on screen

  Scenario: Tapping a sidebar entry opens its pane
    When I tap the element with id "com.apple.settings.accessibility"
    Then "VoiceOver" is on screen

  Scenario: Scrolling reaches content below the fold
    When I tap the element with id "com.apple.settings.general"
    And I scroll the screen
    Then "Transfer or Reset iPad" is on screen
