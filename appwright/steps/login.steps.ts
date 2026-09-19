import { Before, Given, When, Then, expect, test } from './fixtures';
import { LoginScreen } from '../pageobjects/LoginScreen';
import { buildPath } from '../config';

/**
 * Example app steps, driving pageobjects/LoginScreen.ts.
 *
 * Replace these with your own app's flow. They are skipped — rather than left
 * to fail — until APP_PATH names a build, so `npm test` on a fresh clone is
 * green and the device smoke still proves the grid works.
 */
Before('@app', async () => {
    test.skip(
        !buildPath(),
        'Set APP_PATH in .env to the .apk/.ipa under test, then run: npm run test:app',
    );
});

Given('the app is launched on the login screen', async ({ device }) => {
    await new LoginScreen(device).expectLoaded();
});

When('I log in as {string} with password {string}', async ({ device }, username: string, password: string) => {
    await new LoginScreen(device).login(username, password);
});

Then('the dashboard is shown', async ({ device }) => {
    await expect(new LoginScreen(device).dashboard).toBeVisible();
});

Then('the error message reads {string}', async ({ device }, message: string) => {
    const text = await new LoginScreen(device).errorText();
    expect(text).toContain(message);
});
