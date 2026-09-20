import { test, expect } from '../steps/fixtures';
import { LoginScreen } from '../pageobjects/LoginScreen';
import { buildPath } from '../config';

/**
 * Example app tests — the non-BDD counterpart of features/login.feature.
 *
 * Skipped until APP_PATH names a build, so a fresh clone stays green.
 */
test.describe('Login screen', () => {
    test.skip(
        () => !buildPath(),
        'Set APP_PATH in .env to the .apk/.ipa under test, then run: npm run test:app',
    );

    test('the login form is shown on launch', async ({ device }) => {
        const login = new LoginScreen(device);
        await expect(login.username).toBeVisible();
        await expect(login.password).toBeVisible();
        await expect(login.submit).toBeVisible();
    });

    test('valid credentials reach the dashboard', async ({ device }) => {
        const login = new LoginScreen(device);
        await login.expectLoaded();
        await login.login('admin', 'secret123');
        await expect(login.dashboard).toBeVisible();
    });

    test('an invalid password is rejected', async ({ device }) => {
        const login = new LoginScreen(device);
        await login.expectLoaded();
        await login.login('admin', 'wrongpassword');
        expect(await login.errorText()).toContain('Invalid credentials');
    });
});
