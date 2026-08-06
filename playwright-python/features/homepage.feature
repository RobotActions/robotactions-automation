@homepage
Feature: RobotActions Homepage
  As a prospective customer
  I want to browse the robotactions.com marketing site
  So that I can learn about the product and sign up

  Background:
    Given I am on the robotactions homepage

  @smoke
  Scenario: Page title is correct
    Then the page title should contain "RobotActions"

  @smoke
  Scenario: Hero tagline is visible
    Then I should see the stable hero tagline

  @smoke
  Scenario: Start Free Trial button is visible
    Then the "Start Free Trial" button is visible

  @smoke
  Scenario: Sign in button is visible
    Then the "Sign in / Sign up" button is visible

  Scenario: Navigation links are present
    Then the nav contains a link to "Home"
    And the nav contains a link to "Pricing"
    And the nav contains a link to "FAQ"
    And the nav contains a link to "Contact"

  Scenario: All major section anchors exist on the page
    Then the page has a section with id "hero"
    And the page has a section with id "services"
    And the page has a section with id "pricing"
    And the page has a section with id "faq"
    And the page has a section with id "contact"

  # Tiers verified against the live site 2026-08-05: Free / Manual / Automation
  # / Enterprise. The previous "Shared" tier no longer exists.
  Scenario: Pricing tiers are displayed
    When I scroll to the pricing section
    Then the pricing section shows tier "Free"
    And the pricing section shows tier "Manual"
    And the pricing section shows tier "Automation"
    And the pricing section shows tier "Enterprise"

  Scenario: FAQ accordion questions are present
    When I scroll to the FAQ section
    Then the FAQ contains question "What is RobotActions Device Farm?"
    And the FAQ contains question "How many devices can I test on simultaneously?"
    And the FAQ contains question "Do you provide real devices or emulators?"

  Scenario: Contact section has a form
    When I scroll to the contact section
    Then the contact section contains a form
    And the contact form has a name field
    And the contact form has an email field
