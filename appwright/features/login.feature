@app @login
Feature: User login
  As a registered user
  I want to log into the mobile app
  So that I can reach my dashboard.

  # Replace this with your own app's flow — it is here to show the Appwright API
  # against a page object (pageobjects/LoginScreen.ts), not to pass as shipped.
  #
  # Every @app scenario is skipped until APP_PATH points at your build, so the
  # default run stays green on a fresh clone. Set APP_PATH in .env, give your
  # app's elements the accessibility ids LoginScreen.ts looks for, then:
  #   npm run test:app

  Background:
    Given the app is launched on the login screen

  @smoke
  Scenario: Successful login with valid credentials
    When I log in as "admin" with password "secret123"
    Then the dashboard is shown

  Scenario: Failed login with an invalid password
    When I log in as "admin" with password "wrongpassword"
    Then the error message reads "Invalid credentials"

  Scenario Outline: Login is rejected without both fields
    When I log in as "<username>" with password "<password>"
    Then the error message reads "<error>"

    Examples:
      | username | password  | error                |
      |          | secret123 | Username is required |
      | admin    |           | Password is required |
