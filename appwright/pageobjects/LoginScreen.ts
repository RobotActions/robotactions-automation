import type { AppwrightLocator, Device } from 'appwright';

/**
 * Page object for an app's login screen.
 *
 * Locators use `getById`, which is the closest thing to a portable selector —
 * but note what it actually compiles to, because it is not the accessibility id
 * on both platforms:
 *
 * - **Android**: `resourceIdMatches("username")` — a regex against the view's
 *   **resource-id**, so a bare `username` matches `com.myapp:id/username`.
 *   Pass `{ exact: true }` for an exact `resourceId(...)` match instead.
 * - **iOS**: the predicate `name CONTAINS "username"` — the
 *   `accessibilityIdentifier` when the app sets one, otherwise the label.
 *
 * So one id string drives both platforms provided the Android resource-id and
 * the iOS identifier agree, which is worth setting up deliberately in the app
 * source. `getByText` is the fallback when you cannot change the app, at the
 * cost of breaking under localisation.
 */
export class LoginScreen {
    constructor(private readonly device: Device) {}

    get username(): AppwrightLocator {
        return this.device.getById('username');
    }

    get password(): AppwrightLocator {
        return this.device.getById('password');
    }

    get submit(): AppwrightLocator {
        return this.device.getById('loginButton');
    }

    get error(): AppwrightLocator {
        return this.device.getById('errorMessage');
    }

    get dashboard(): AppwrightLocator {
        return this.device.getById('dashboard');
    }

    /** Waits for the screen to be interactive before a test touches it. */
    async expectLoaded(): Promise<void> {
        await this.username.waitFor('visible');
    }

    async login(username: string, password: string): Promise<void> {
        // fill() replaces the field's contents; sendKeyStrokes() types into it.
        // Prefer fill() unless the app reacts to individual key events.
        if (username) await this.username.fill(username);
        if (password) await this.password.fill(password);
        await this.submit.tap();
    }

    async errorText(): Promise<string> {
        return this.error.getText();
    }
}
