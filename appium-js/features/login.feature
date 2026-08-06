@login
Feature: User Login
  As a registered user
  I want to log into the mobile app
  So that I can access my dashboard

  Background:
    Given I am on the login page

  @smoke
  Scenario: Successful login with valid credentials
    When I login with username "admin" and password "secret123"
    Then I should see the dashboard
    And I should see welcome message "Welcome"

  Scenario: Failed login with invalid password
    When I enter username "admin"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see error message "Invalid credentials"

  Scenario: Failed login with empty fields
    When I click the login button
    Then I should see error message "Username is required"

  Scenario Outline: Login with different roles
    When I login with username "<username>" and password "<password>"
    Then the page title should contain "<expected_title>"

    Examples:
      | username | password  | expected_title |
      | admin    | admin123  | Dashboard      |
      | user     | user123   | Dashboard      |
