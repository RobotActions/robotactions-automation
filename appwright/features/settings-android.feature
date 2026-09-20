@settings @android
Feature: Settings app walkthrough (Android)
  As an automation engineer
  I want to drive a real app without installing a build first
  So that I can prove the locators, taps and scrolling work on this device.

  # Every device already has Settings, so this exercises the whole API against a
  # real app with no APK to upload. Read-only throughout: it navigates and
  # asserts, and never changes a setting.
  #
  # Opt in with RUN_SETTINGS_WALKTHROUGH=true. It is off by default because the
  # labels below are stock Android's — OEM skins rename them ("Network and
  # Internet" is "Connections" on Samsung) — so pin DEVICE_UDID to a stock
  # handset when running it.
  #
  # The steps behind this are generic (steps/settings.steps.ts): the labels live
  # here in the feature, so the same steps drive your own app.

  Background:
    Given the Settings app is open

  Scenario: Top-level entries are on screen
    Then "Network and Internet" is on screen
    And the text of "Battery" is "Battery"

  Scenario: An element can be found by xpath
    Then the element at xpath "//android.widget.TextView[@text='Settings']" is on screen

  Scenario: Scrolling reaches an entry further down the list
    When I scroll until "About phone" is on screen
    Then "About phone" is on screen

  Scenario: Tapping an entry opens its screen
    When I scroll until "About phone" is on screen
    And I tap "About phone"
    Then "Device name" is on screen
