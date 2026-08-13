import XCTest

/// Minimal native XCUITest suite. Runs ON the device via testmanagerd (driven by
/// `xcodebuild test-without-building` on a Mac co-located with the device).
/// Several methods so the runner can distribute across a device pool.
final class SampleAppUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testMainTextExists() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["mainText"].waitForExistence(timeout: 5))
    }

    func testMainTextValue() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertEqual(app.staticTexts["mainText"].label, "Test")
    }

    func testMainTextExistsAgain() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["mainText"].exists)
    }

    func testMainTextValueAgain() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertEqual(app.staticTexts["mainText"].label, "Test")
    }

    /// Flaky-retry probe: fails the FIRST attempt, passes on retry. A marker is
    /// written to the runner's Documents dir (which survives between attempt and
    /// retry — the runner is only uninstalled after the whole run completes), so
    /// the second attempt sees it and passes. Demonstrates iOS flaky-retry rescue.
    func testFlakyPassesOnRetry() {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let marker = dir.appendingPathComponent("ra_retry_marker.flag")
        if FileManager.default.fileExists(atPath: marker.path) { return } // retry → pass
        try? "1".write(to: marker, atomically: true, encoding: .utf8)
        XCTFail("first attempt intentionally fails — retry should rescue this")
    }
}
