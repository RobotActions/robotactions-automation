@robotactions @load @regression
Feature: RobotActions homepage — full nav coverage + load profile
  As an SRE running grid load tests
  I want a repeatable browser scenario that exercises every nav item on robotactions.com
  So that I can observe grid behaviour under concurrent session pressure
  AND verify the marketing site's full nav matrix doesn't regress

  # Tag tiers (additive — each scenario carries every tier it belongs to):
  #   @smoke      — 4 fast, critical-path checks. Runs in ~25s. Must always pass.
  #   @sanity     — broader functional coverage. Includes every @smoke scenario.
  #   @regression — full coverage (default Feature tag). Includes everything.
  # Run with:   -k smoke   (or sanity, regression)

  Background:
    Given I open the RobotActions home page
    And I wait for the SPA to hydrate

  # ── Hero + primary CTAs ─────────────────────────────────────────────
  # The H1 rotates through 3 phrases on a ~20s cycle; assert the stable tagline instead.
  # "See how it works" collapses below 600px viewport width — omitted from CTA assertions.
  @smoke @sanity
  Scenario: Hero section renders stable tagline + primary CTAs
    Then the hero heading should contain one of the known phrases
    And the stable hero tagline should be visible
    And I should see the "Start Free Trial" button
    And I should see the "Sign in / Sign up" button

  # ── Top-level nav: hash anchors ─────────────────────────────────────
  @sanity
  Scenario Outline: Top-level nav anchors scroll to the right section
    When I click the "<link>" nav link
    Then the URL fragment should be "<fragment>"
    And the section with id "<id>" should be in viewport

    Examples:
      | link    | fragment  | id       |
      | Home    | #hero     | hero     |
      | Pricing | #pricing  | pricing  |
      | FAQ     | #faq      | faq      |
      | Contact | #contact  | contact  |

  # ── Products dropdown ───────────────────────────────────────────────
  # Verified against the live site 2026-08-05. The nav button is "Products"
  # (it was "Features"), and its items are section anchors on the home page —
  # they no longer navigate to dedicated /features/* pages.
  @sanity
  Scenario: Products dropdown opens on click and renders all its items
    When I click the "Products" nav button
    Then the Products dropdown should be visible
    And the Products dropdown should contain the items:
      | label                   |
      | AI Test Agent           |
      | Chat AI Agent           |
      | MCP Server              |
      | Device & Browser Farm   |
      | Automation & Frameworks |
      | Audio & Video           |
      | Migration & Coverage    |

  @sanity
  Scenario Outline: Each Products dropdown item scrolls to its section
    When I click the "Products" nav button
    And I click the "<label>" dropdown item
    Then the URL fragment should be "<fragment>"
    And the section with id "<id>" should be in viewport

    Examples:
      | label                   | fragment             | id                  |
      | AI Test Agent           | #ai-test-agent       | ai-test-agent       |
      | Chat AI Agent           | #ai-chat             | ai-chat             |
      | MCP Server              | #mcp                 | mcp                 |
      | Device & Browser Farm   | #services            | services            |
      | Automation & Frameworks | #automation-browsers | automation-browsers |
      | Audio & Video           | #audio               | audio               |
      | Migration & Coverage    | #services-help       | services-help       |

  # ── Resources dropdown ──────────────────────────────────────────────
  @sanity
  Scenario: Resources dropdown opens on click and renders all 6 items
    When I click the "Resources" nav button
    Then the Resources dropdown should be visible
    And the Resources dropdown should contain the items:
      | label          |
      | Integrations   |
      | About Us       |
      | Careers        |
      | Changelog      |
      | Compare        |
      | Pricing estimator |

  Scenario Outline: Each Resources dropdown item navigates to its dedicated page
    When I click the "Resources" nav button
    And I click the "<label>" dropdown item
    Then the URL pathname should be "<path>"
    And the SPA should hydrate without console errors

    Examples:
      | label          | path             |
      | Integrations   | /integrations    |
      | About Us       | /about-us        |
      | Careers        | /careers         |
      | Changelog      | /changelog       |
      | Compare        | /compare         |
      | Pricing estimator | /roi-calculator  |

  # ── Header utility buttons ──────────────────────────────────────────
  @sanity
  # The theme control is a dropdown (Light / Dark / System), not a two-state
  # toggle — clicking the trigger only opens the menu. These scenarios used to
  # click the trigger and assert a flip, which could never pass.
  Scenario: Theme selection flips dark/light without console errors
    Given the page theme is "light" or "dark"
    When I select the "Dark" theme
    And I wait 500 milliseconds for the theme transition
    Then the page theme should have changed
    And no console errors should have been logged

  @sanity
  Scenario: Language switcher opens
    When I click the "Switch language" button
    Then a language selection menu should be visible

  @smoke @sanity
  Scenario: Sign in / Sign up CTA is reachable
    Then the "Sign in / Sign up" button should be visible and enabled

  # ── Pricing section headings ─────────────────────────────────────────
  @smoke @sanity
  Scenario: Pricing section shows expected tier headings
    When I click the "Pricing" nav link
    Then the section with id "pricing" should be in viewport
    And I should see the heading "Free"
    And I should see the heading "Manual"
    And I should see the heading "Automation"
    And I should see the heading "Enterprise"

  # ── FAQ accordion ────────────────────────────────────────────────────
  @smoke @sanity
  Scenario: FAQ section shows known accordion questions
    When I click the "FAQ" nav link
    Then the section with id "faq" should be in viewport
    And I should see the FAQ question "What is RobotActions Device Farm?"
    And I should see the FAQ question "Do you provide real devices or emulators?"

  # ── NEGATIVE scenarios ──────────────────────────────────────────────
  # Validate the site degrades gracefully on bad input. Each negative case
  # is the inverse of a real user mistake — typos in URLs, stale hash
  # anchors, double-clicking the same control. None touch Auth0.

  @sanity
  Scenario: Unknown route renders a 404 page (negative)
    When I navigate to path "/this-route-definitely-does-not-exist-xyz"
    Then the page title should contain "404"

  @sanity
  Scenario: Unknown hash anchor does not crash the homepage (negative)
    When I navigate to path "/#unknown-section-xyz"
    Then the page title should contain "RobotActions"
    And no console errors should have been logged

  @sanity
  Scenario: Opening the Resources dropdown closes the Products dropdown (negative)
    When I click the "Products" nav button
    Then the Products dropdown should be visible
    When I click the "Resources" nav button
    Then the Resources dropdown should be visible
    And the Products dropdown should not be visible

  @sanity
  Scenario: Theme selection is reversible (negative — reselecting the original restores it)
    Given the page theme is "light" or "dark"
    When I select the "Dark" theme
    And I wait 500 milliseconds for the theme transition
    And I select the "Light" theme
    And I wait 500 milliseconds for the theme transition
    Then the page theme should match the original

  # ── Deep-link sanity: direct visits to feature subpages ─────────────
  @sanity
  Scenario Outline: Direct visit to a feature subpage renders without crash
    When I navigate to path "<path>"
    Then the page title should contain "RobotActions"
    And no console errors should have been logged

    Examples:
      | path                   |
      | /features/selenium     |
      | /features/appium       |
      | /features/playwright   |
      | /features/device-farm  |
      | /features/mcp          |
      | /features/browser-grid |
      | /ai-test-agent         |

  # ── Deep-link regression: resource subpages ─────────────────────────
  Scenario Outline: Direct visit to a resource subpage renders without crash
    When I navigate to path "<path>"
    Then the page title should contain "RobotActions"
    And no console errors should have been logged

    Examples:
      | path             |
      | /integrations    |
      | /about-us        |
      | /careers         |
      | /changelog       |
      | /compare         |
      | /roi-calculator  |

  # ── Cross-cutting health check (used by the @health load runner) ─────
  @health
  Scenario: Full nav matrix loads with no console errors and a hydrated tree
    When I cycle through every top-level nav item once
    Then no console errors should have been logged
    And the SPA should remain hydrated throughout the cycle
