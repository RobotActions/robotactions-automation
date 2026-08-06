@parallel @ios @mobileweb
Feature: Parallel cross-device distribution (RobotActions mobile web)

  A deliberately longer scenario so that concurrent WDIO workers overlap in time
  and the Grid distributes them across DIFFERENT physical devices (rather than
  each finishing before the next starts).

  Leave RA_IOS_UDIDS unset so no `appium:udid` is sent — the Grid auto-picks a
  free device per session. Run several at once, N-at-a-time:

    MAX_INSTANCES=2 npx wdio run wdio.ios-mobileweb.conf.ts \
      --spec ./features/robotactions-parallel.feature --repeat 4

  With 2 devices in the Grid you'll see two sessions run concurrently on
  different devices, and the rest queue + distribute as devices free up.

  @smoke
  Scenario: Browse RobotActions and hold the session long enough to overlap
    Given I open RobotActions in the mobile browser
    Then the page title should contain "RobotActions"
    And I dwell on the page for a few seconds
    And the page should show the "robotactions.com" URL
    And I dwell on the page for a few seconds
    And the page text should mention "Appium"
