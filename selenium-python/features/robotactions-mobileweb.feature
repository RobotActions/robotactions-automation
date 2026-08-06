@mobileweb
Feature: RobotActions on mobile web (Appium, real device browser)

  Drive the real RobotActions site through the browser on a physical handset via
  Appium + the Selenium Grid. The same scenarios run on both platforms — the
  browser is chosen by PLATFORM, not by the scenario:
  #   PLATFORM=mobileweb      → Chrome on a real Android device
  #   PLATFORM=ios-mobileweb  → Safari on a real iOS device
  # Step wording is deliberately browser-neutral so an iOS run is not labelled
  # as Android in the report.

  # Tag tiers (additive):
  #   @smoke  — critical path: page loads, menu opens, layout doesn't break.
  #   @sanity — broader mobile coverage: navigation, FAQ, pricing, deep links.
  # Run with:
  #   PLATFORM=mobileweb pytest tests/step_defs/test_robotactions_mobileweb.py -m smoke
  #
  # Mobile-only behaviour these scenarios pin down (verified on real devices):
  #   · every top-level nav link is hidden until the hamburger is tapped
  #   · there is no hover, so the desktop dropdown flows do not apply
  #   · the theme control is a dropdown (Light/Dark/System), not a one-tap toggle

  Background:
    Given I open RobotActions in the device browser
    And I wait for the mobile SPA to hydrate

  # ── Page load ────────────────────────────────────────────────────────
  @smoke
  Scenario: Homepage loads in the device browser
    Then the mobile page title should contain "RobotActions"
    And the mobile page should show the "robotactions.com" URL
    And the mobile page text should mention "Appium"

  @smoke
  Scenario: Hero renders on a small viewport
    Then the mobile hero heading should not be empty
    And the mobile hero tagline should be visible
    And I should see the mobile "Start Free Trial" button

  # ── Responsive layout ────────────────────────────────────────────────
  @smoke
  Scenario: Homepage fits the device viewport
    Then the mobile page should not scroll horizontally
    And the mobile viewport meta tag should contain "width=device-width"

  @sanity
  Scenario Outline: Sub-pages fit the device viewport
    When I open the mobile path "<path>"
    Then the mobile page title should contain "<title_fragment>"
    And the mobile page should not scroll horizontally

    Examples:
      | path            | title_fragment    |
      | /integrations   | Integrations      |
      | /about-us       | About Us          |
      | /changelog      | Changelog         |
      | /roi-calculator | Pricing Estimator |

  # ── Mobile menu ──────────────────────────────────────────────────────
  @smoke
  Scenario: Hamburger menu reveals the primary nav
    Then the mobile menu should be closed
    When I tap the mobile menu button
    Then the mobile menu should be open
    And the mobile menu should show the "Home" link
    And the mobile menu should show the "Pricing" link
    And the mobile menu should show the "FAQ" link
    And the mobile menu should show the "Contact" link

  @sanity
  Scenario Outline: Tapping a menu link scrolls to its section and closes the menu
    When I tap the mobile menu button
    And I tap the "<link>" link in the mobile menu
    Then the mobile URL fragment should be "<fragment>"
    And the mobile section with id "<section_id>" should be in viewport
    And the mobile menu should be closed

    Examples:
      | link    | fragment | section_id |
      | Home    | #hero    | hero       |
      | Pricing | #pricing | pricing    |
      | FAQ     | #faq     | faq        |
      | Contact | #contact | contact    |

  @sanity
  Scenario: Sign in / Sign up CTA is reachable from the mobile menu
    When I tap the mobile menu button
    Then the mobile "Sign in / Sign up" button should be visible and enabled

  # ── FAQ accordion (tap-driven, no hover on mobile) ───────────────────
  # Asserts the TRANSITION, not "expanded after tap": the initial state is not
  # deterministic across devices — the first question was already expanded on a
  # real Android handset and collapsed on a real iPhone.
  @sanity
  Scenario Outline: FAQ questions toggle on tap
    When I tap the mobile menu button
    And I tap the "FAQ" link in the mobile menu
    Then I should see the mobile FAQ question "<question>"
    And the mobile FAQ question "<question>" should toggle when tapped

    Examples:
      | question                                  |
      | What is RobotActions Device Farm?         |
      | Do you provide real devices or emulators? |
      | Can I record my test sessions?            |

  # ── Pricing ──────────────────────────────────────────────────────────
  @sanity
  Scenario Outline: Pricing tiers render on mobile
    When I tap the mobile menu button
    And I tap the "Pricing" link in the mobile menu
    Then the mobile "<tier>" pricing tier should be visible

    Examples:
      | tier       |
      | Free       |
      | Manual     |
      | Automation |
      | Enterprise |

  # ── Header controls ──────────────────────────────────────────────────
  # The theme control opens a menu; picking "Dark" sets class="dark" on <html>.
  @sanity
  Scenario: Theme can be switched from the mobile header
    When I select the "Dark" theme on mobile
    Then the mobile theme should be "dark"
    When I select the "Light" theme on mobile
    Then the mobile theme should be "light"

  @sanity
  Scenario: Language switcher opens on mobile
    When I tap the mobile language switcher
    Then the mobile menu item "English" should be visible
    And the mobile menu item "Français" should be visible
