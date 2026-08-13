@robotactions @smoke
Feature: robotactions.com smoke — homepage + nav + key surfaces
  As a release manager
  I want to verify the public marketing site's critical surfaces render
  So that homepage regressions ship-block instead of leaking to prod

  Background:
    Given I open the RobotActions home page
    And I wait for the SPA to hydrate

  # Sourced from a live Playwright-MCP inspection of robotactions.com on
  # 2026-06-06 — every label / text below matches an element actually
  # rendered by the page so this suite passes against the real site, not
  # a template stub.

  Scenario: Hero section renders headline + primary CTAs
    # H1 rotates between 3 phrases (~20 s cycle) — assert one of the known
    # set rather than a single brittle string.
    Then the hero heading should be one of:
      | Real devices                        |
      | Real Android & iOS devices          |
      | Talk to your device                 |
    # Verified via Playwright MCP at 360×740 + 768×1024 viewports — these
    # two CTAs render at every screen size that ships in our device fleet.
    # "See how it works" used to be on this list but collapses below the
    # fold at ≤ 600px; dropped to keep the suite portable.
    And I should see the "Start Free Trial" button
    And I should see the "Sign in / Sign up" button
    # Stable hero tagline that does NOT rotate — anchor we can rely on.
    And the page should contain text "No credit card required"

  Scenario: Page renders the AI-agent section
    Then I should see the heading "Chat AI Agent — Built Into Every Device Session"

  Scenario: Page renders the supported-frameworks section
    Then I should see the heading "Selenium, Appium, Playwright, WebDriverIO"

  Scenario: Page renders the record-and-replay section
    Then I should see the heading "Record, Fragment & Replay — Zero Code, Visual Test Authoring"

  Scenario Outline: Top-level nav anchors scroll to their section
    When I click the "<link>" nav link
    Then the URL fragment should be "<fragment>"
    And the section with id "<id>" should be in viewport

    # Site drift (2026-07-06): "Products" is now a dropdown button, not an
    # anchor link — covered by the dropdown scenario below.
    Examples:
      | link     | fragment  | id       |
      | Home     | #hero     | hero     |
      | Pricing  | #pricing  | pricing  |
      | FAQ      | #faq      | faq      |
      | Contact  | #contact  | contact  |

  Scenario: Products dropdown opens
    When I click the "Products" nav button
    Then the Products dropdown should be visible

  Scenario: Resources dropdown opens
    When I click the "Resources" nav button
    Then the Resources dropdown should be visible

  Scenario: Theme toggle flips dark/light
    When I click the "Toggle theme" button
    Then the page theme should have changed

  Scenario: Page renders without console errors
    Then the SPA should hydrate without console errors

  # Surfaces verified against the live DOM. Pricing tiers re-inspected
  # 2026-07-06: Free / Manual / Automation / Enterprise ("Shared" tier was
  # renamed — shared infra is now described inside the Free tier).

  Scenario Outline: Pricing section renders the <tier> tier
    Then I should see the heading "<tier>"

    Examples:
      | tier       |
      | Free       |
      | Manual     |
      | Automation |
      | Enterprise |

  Scenario: Pricing section advertises the AI credit top-ups
    Then I should see the heading "Top up AI usage anytime"
    And I should see the heading "$5 credit"
    And I should see the heading "$20 credit"

  Scenario Outline: FAQ section includes the <slug> question
    Then I should see the FAQ question containing "<slug>"

    Examples:
      | slug                                  |
      | What is RobotActions Device Farm      |
      | How many devices can I test           |
      | Do you provide real devices           |
