import { Given, When, Then } from '@cucumber/cucumber';
import LoginPage from '../pageobjects/LoginPage';

Given('I am on the login page', async () => {
    await LoginPage.open();
});

When('I enter username {string}', async (username: string) => {
    await LoginPage.usernameInput.setValue(username);
});

When('I enter password {string}', async (password: string) => {
    await LoginPage.passwordInput.setValue(password);
});

When('I click the login button', async () => {
    await LoginPage.submitButton.click();
});

When('I login with username {string} and password {string}', async (username: string, password: string) => {
    await LoginPage.login(username, password);
});

Then('I should see the dashboard', async () => {
    await LoginPage.dashboardScreen.waitForDisplayed({ timeout: 15000 });
    await expect(LoginPage.dashboardScreen).toBeDisplayed();
});

Then('I should see error message {string}', async (message: string) => {
    await expect(LoginPage.errorMessage).toHaveText(message);
});

Then('I should see welcome message {string}', async (message: string) => {
    await expect(LoginPage.welcomeMessage).toHaveText(expect.stringContaining(message));
});

Then('the page title should contain {string}', async (text: string) => {
    // For native apps there is no browser URL; assert that a screen element
    // matching the expected title is visible instead.
    const titleElement = await $(`~${text}`);
    await titleElement.waitForDisplayed({ timeout: 15000 });
    await expect(titleElement).toBeDisplayed();
});
