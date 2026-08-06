import Page from './Page';

/**
 * LoginPage uses Appium accessibility ID selectors (~id) for cross-platform
 * portability between Android (contentDescription) and iOS (accessibilityIdentifier).
 */
class LoginPage extends Page {
    // Accessibility ID selectors — set contentDescription (Android) or
    // accessibilityIdentifier (iOS) to these values in the app source.
    get usernameInput()  { return $('~username'); }
    get passwordInput()  { return $('~password'); }
    get submitButton()   { return $('~loginButton'); }
    get errorMessage()   { return $('~errorMessage'); }
    get welcomeMessage() { return $('~welcomeMessage'); }
    get dashboardScreen(){ return $('~dashboard'); }

    async login(username: string, password: string): Promise<void> {
        await this.usernameInput.setValue(username);
        await this.passwordInput.setValue(password);
        await this.submitButton.click();
    }

    async getErrorText(): Promise<string> {
        await this.errorMessage.waitForDisplayed();
        return this.errorMessage.getText();
    }

    async getWelcomeText(): Promise<string> {
        await this.welcomeMessage.waitForDisplayed();
        return this.welcomeMessage.getText();
    }

    /** Navigate to login screen.  For native apps this activates the app and
     *  waits for the login screen to be visible. */
    async open(): Promise<void> {
        // Bring the app to the foreground in case it was backgrounded.
        await driver.activateApp(
            process.env.BUNDLE_ID || process.env.APP_PACKAGE || 'com.example.app',
        );
        await this.usernameInput.waitForDisplayed({ timeout: 15000 });
    }
}

export default new LoginPage();
