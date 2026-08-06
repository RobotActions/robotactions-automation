@test-status
Feature: Test Status Reporting (ra:setTestStatus)
  As a test author
  I want to mark my session as passed/failed from inside the test
  So that the Appium Grid History shows the real test outcome — not just "completed"

  These scenarios exercise the four write paths shipped on PR #97:
    1. driver.execute_script('ra:setTestStatus', {status, reason, ...})  (magic)
    2. driver.execute_script('ra:job-result=failed:reason')               (legacy magic)
    3. POST /api/sessions/:id/result on the grid proxy (port 4444)
    4. POST /api/sessions/:id/result on the broadcaster   (port 3001)

  Each scenario navigates to a public site first (proves the session is real),
  then reports a status, then verifies via the API that the DB row landed.

  @smoke @magic
  Scenario: Mark session passed via ra:setTestStatus magic script
    Given I open a chrome session through the grid
    When I navigate to "about:blank"
    And I report status "passed" via ra:setTestStatus with reason "happy path verified"
    Then the session should be marked "passed" with reason "happy path verified"
    And no synthetic ra:setTestStatus row should appear in the timeline

  @smoke @magic
  Scenario: Mark session failed via ra:setTestStatus magic script
    Given I open a chrome session through the grid
    When I navigate to "about:blank"
    And I report status "failed" via ra:setTestStatus with reason "expected red link not found"
    Then the session should be marked "failed" with reason "expected red link not found"
    And a synthetic ra:setTestStatus row should appear in the timeline

  @legacy @magic
  Scenario: Mark session failed via legacy ra:job-result magic
    Given I open a chrome session through the grid
    When I navigate to "about:blank"
    And I report a legacy ra:job-result failure with reason "legacy regression check"
    Then the session should be marked "failed" with reason "legacy regression check"
    And a synthetic ra:setTestStatus row should appear in the timeline

  @rest
  Scenario: Mark session failed via REST API on grid proxy (port 4444)
    Given I open a chrome session through the grid
    When I navigate to "about:blank"
    And I POST status "failed" with reason "REST via grid proxy" to "4444"
    Then the session should be marked "failed" with reason "REST via grid proxy"
    And a synthetic ra:setTestStatus row should appear in the timeline

  @rest
  Scenario: Mark session failed via REST API on broadcaster (port 3001)
    Given I open a chrome session through the grid
    When I navigate to "about:blank"
    And I POST status "failed" with reason "REST via broadcaster" to "3001"
    Then the session should be marked "failed" with reason "REST via broadcaster"
    And a synthetic ra:setTestStatus row should appear in the timeline

  @rest @rich
  Scenario: Atomic multi-field update via REST API (status + testName + testSuite)
    Given I open a chrome session through the grid
    When I navigate to "about:blank"
    And I POST a rich payload to "4444" with status "failed" testName "Checkout flow" testSuite "Smoke Regression" reason "Checkout button missing"
    Then the session should be marked "failed" with reason "Checkout button missing"
    And the session test_name should be "Checkout flow"
    And the session test_suite should be "Smoke Regression"
