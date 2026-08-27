@robotactions @load
Feature: RobotActions homepage — full nav coverage + load profile
  As an SRE running grid load tests
  I want a repeatable browser scenario that exercises every nav item on robotactions.com
  So that I can observe grid behaviour under concurrent session pressure
  AND verify the marketing site's full nav matrix doesn't regress

  Background:
    Given I open the RobotActions home page
    And I wait for the SPA to hydrate

  # ── Hero + primary CTAs ─────────────────────────────────────────────
  @smoke
  Scenario: Hero section renders the headline + primary CTAs
    # H1 headline copy is now built from two adjacent <span>s (lead + tail)
    # with NO whitespace text node between them, so a fragment must stay on
    # one side of that boundary or the substring check never matches — a
    # word-spanning fragment like "story to raised" would fail even though
    # both halves are genuinely on screen. Verified live 2026-08-08: the
    # rendered H1 is "Real devices,zero lag." (no space at the span join).
    Then the hero heading should contain "Real devices,"
    And I should see the "Start Free Trial" button
    # "See how it works" is a per-slide secondary CTA (heroSlide1SecondaryCta
    # in the bundle) — only slide 1 defines it. The currently-active slide is
    # slide 2 ("Real devices, zero lag."), which has no secondary CTA at all,
    # so this button is not a reliable invariant. Same reasoning already
    # applied in robotactions-smoke.feature, which dropped it outright.

  # ── Top-level nav: hash anchors ─────────────────────────────────────
  Scenario Outline: Top-level nav anchors scroll to the right section
    When I click the "<link>" nav link
    Then the URL fragment should be "<fragment>"
    And the section with id "<id>" should be in viewport

    # Only these four are anchor links. "Products" and "Resources" are
    # dropdown BUTTONS — clicking them by role=link never resolves.
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
  Scenario: Theme toggle flips dark/light without console errors
    Given the page theme is "light" or "dark"
    When I click the "Toggle theme" button
    And I wait 500 milliseconds for the theme transition
    Then the page theme should have changed
    And no console errors should have been logged

  Scenario: Language switcher opens
    When I click the "Switch language" button
    Then a language selection menu should be visible

  Scenario: Sign in / Sign up CTA is reachable
    Then the "Sign in / Sign up" button should be visible and enabled

  # ── Cross-cutting smoke for the load runner ─────────────────────────
  @health
  Scenario: Full nav matrix loads with no console errors and a hydrated tree
    When I cycle through every top-level nav item once
    Then no console errors should have been logged
    And the SPA should remain hydrated throughout the cycle
