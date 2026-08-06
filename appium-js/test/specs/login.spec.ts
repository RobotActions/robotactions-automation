import LoginPage from '../../pageobjects/LoginPage';

/**
 * Secondary: Regular Mocha tests (non-BDD).
 * Run with: npm run test:regular
 */
describe('Login Screen', () => {
    beforeEach(async () => {
        await LoginPage.open();
    });

    it('should display login form', async () => {
        await expect(LoginPage.usernameInput).toBeDisplayed();
        await expect(LoginPage.passwordInput).toBeDisplayed();
        await expect(LoginPage.submitButton).toBeDisplayed();
    });

    it('should login with valid credentials', async () => {
        await LoginPage.login('admin', 'secret123');
        await LoginPage.dashboardScreen.waitForDisplayed({ timeout: 15000 });
        await expect(LoginPage.dashboardScreen).toBeDisplayed();
    });

    it('should show error for invalid credentials', async () => {
        await LoginPage.login('admin', 'wrongpassword');
        await expect(LoginPage.errorMessage).toHaveText('Invalid credentials');
    });

    it('should show error for empty fields', async () => {
        await LoginPage.submitButton.click();
        await expect(LoginPage.errorMessage).toHaveText('Username is required');
    });
});
