/**
 * Siri Remote control for tvOS sessions.
 *
 * ## Why this is not part of Appwright
 *
 * Appwright's API assumes a touchscreen: `tap()`, `scroll()` and the locator
 * actions all resolve to coordinates or gestures. An Apple TV has none — you
 * move a focus ring with the remote's directional pad and press Select on
 * whatever is focused. So the locators and assertions carry over unchanged (the
 * XCUITest hierarchy is the same), but *navigation* needs buttons, and
 * Appwright's `Device` exposes no button command and keeps its WebDriver client
 * private.
 *
 * The provider owns that same session, so the presses go through it.
 *
 * ## Usage
 *
 *     await remote.down();
 *     await remote.select();
 *     await expect(device.getByText('General')).toBeVisible();
 *
 * There is no "tap this element" on tvOS. You move the focus to a thing and then
 * select it — `focusTo()` does that by pressing a direction until the element
 * reports itself focused.
 */
import type { RobotActionsDeviceProvider } from './providers/robotactions';

/** Buttons the XCUITest driver accepts on tvOS. */
export type RemoteButton = 'Home' | 'Menu' | 'Up' | 'Down' | 'Left' | 'Right' | 'Select' | 'Play/Pause';

export type Direction = 'Up' | 'Down' | 'Left' | 'Right';

export interface Remote {
    /** Press any button by its XCUITest name. */
    press(button: RemoteButton): Promise<void>;
    up(): Promise<void>;
    down(): Promise<void>;
    left(): Promise<void>;
    right(): Promise<void>;
    /** Activate whatever currently holds the focus ring. */
    select(): Promise<void>;
    /** Back / up one level. */
    menu(): Promise<void>;
    /** Return to the tvOS home screen. */
    home(): Promise<void>;
    playPause(): Promise<void>;
    /**
     * Press `direction` until `isFocused` reports true, up to `attempts` times.
     *
     * Returns whether it landed. tvOS has no scroll-into-view and no way to tap a
     * known element, so walking the focus is the only way to reach something —
     * the same shape as the scroll loop the touch platforms need.
     */
    focusTo(
        isFocused: () => Promise<boolean>,
        options?: { direction?: Direction; attempts?: number },
    ): Promise<boolean>;
}

export function createRemote(provider: RobotActionsDeviceProvider): Remote {
    const press = (button: RemoteButton) => provider.pressButton(button);

    return {
        press,
        up: () => press('Up'),
        down: () => press('Down'),
        left: () => press('Left'),
        right: () => press('Right'),
        select: () => press('Select'),
        menu: () => press('Menu'),
        home: () => press('Home'),
        playPause: () => press('Play/Pause'),

        async focusTo(isFocused, { direction = 'Down', attempts = 12 } = {}) {
            for (let i = 0; i < attempts; i++) {
                if (await isFocused()) return true;
                await press(direction);
            }
            return isFocused();
        },
    };
}
