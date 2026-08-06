@robotactions @smoke
Feature: RobotActions marketing site smoke
  As a release manager
  I want to verify the public marketing site renders correctly
  So that the homepage, navigation, and key CTAs don't regress

  # Tag conventions (use with playwright `grep`):
  #   @smoke      — single fast critical-path check per concern.
  #   @sanity     — medium scope. Adds the sitemap-routes outline so
  #                 we catch route-specific hydration breaks beyond /.
  #   @regression — deep / parametrised. Every sitemap row exercised.
  #
  # File-level @smoke (line 1) tags the entire feature for the
  # broad smoke runner; per-scenario tags below let you cut finer
  # subsets (e.g. `--grep "@sanity"` to run just the sanity slice).

  Background:
    Given I open the RobotActions home page

  @smoke @sanity @regression
  Scenario: Home page loads with correct title
    Then the page title should match /RobotActions/
    And the page meta description should mention "device farm"
    And the canonical URL should be "https://robotactions.com/"

  @smoke @sanity @regression
  Scenario: Hero section renders after React hydration
    When I wait for the SPA to hydrate
    Then I should see a hero heading

  @sanity @regression
  Scenario Outline: Sitemap routes render a hydrated React tree
    When I navigate to "<path>"
    And I wait for the SPA to hydrate
    Then the page title should match /RobotActions/

    Examples:
      | path                |
      | /                   |
      | /integrations       |
      | /documentation      |
      | /api-documentation  |
      | /solutions          |

  @smoke @sanity @regression
  Scenario: Page loads without console errors
    When I wait for the SPA to hydrate
    Then no console errors should have been logged
