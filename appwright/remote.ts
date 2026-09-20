/**
 * Remote control for the TV platforms — Apple TV (tvOS) and Android TV / Google
 * TV / Chromecast (androidtv).
 *
 * ## Why this is not part of Appwright
 *
 * Appwright's API assumes a touchscreen: `tap()`, `scroll()` and the locator
 * actions all resolve to coordinates or gestures. A TV has none — you move a
 * focus ring with the remote's directional pad and press Select on whatever is
 * focused. So locators and assertions carry over unchanged (the UI hierarchy is
 * the same), but *navigation* needs keys, and Appwright's `Device` exposes no key
 * command and keeps its WebDriver client private.
 *
 * The provider owns that same session, so the presses go through it.
 *
 * ## One vocabulary, two wire protocols
 *
 * The platforms disagree completely on how a key is sent:
 *
 * | Button | Apple TV                      | Android TV                  |
 * |--------|-------------------------------|-----------------------------|
 * | down   | `mobile: pressButton` `Down`  | keycode 20 (`DPAD_DOWN`)    |
 * | select | `mobile: pressButton` `Select`| keycode 23 (`DPAD_CENTER`)  |
 * | back   | `mobile: pressButton` `Menu`  | keycode 4  (`BACK`)         |
 *
 * Tests use the neutral names below, so one feature file drives both. Note `back`
 * rather than `menu`: Apple calls that button Menu and Android calls it Back, and
 * naming it after the *intent* is what lets a scenario be shared.
 *
 * ## Usage
 *
 *     await remote.down();
 *     await remote.select();
 *     await expect(device.getByText('General')).toBeVisible();
 *
 * There is no "tap this element" on a TV. You move the focus to a thing and then
 * select it — `focusTo()` does that by pressing a direction until a predicate
 * holds.
 */
import type { RobotActionsDeviceProvider } from './providers/robotactions';

/** Platform-neutral remote buttons. */
export type RemoteButton =
    | 'up' | 'down' | 'left' | 'right'
    | 'select' | 'back' | 'home' | 'playPause';

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Each button's name on Apple TV and keycode on Android.
 *
 * Android keycodes are the `KEYCODE_*` constants from Android's KeyEvent.
 * `playPause` is 85 (`MEDIA_PLAY_PAUSE`); `home` is 3; `back` is 4.
 */
const BUTTONS: Record<RemoteButton, { button: string; keycode: number }> = {
    up: { button: 'Up', keycode: 19 },
    down: { button: 'Down', keycode: 20 },
    left: { button: 'Left', keycode: 21 },
    right: { button: 'Right', keycode: 22 },
    select: { button: 'Select', keycode: 23 },
    back: { button: 'Menu', keycode: 4 },
    home: { button: 'Home', keycode: 3 },
    playPause: { button: 'Play/Pause', keycode: 85 },
};

export interface Remote {
    /** Press any button by its neutral name. */
    press(button: RemoteButton): Promise<void>;
    up(): Promise<void>;
    down(): Promise<void>;
    left(): Promise<void>;
    right(): Promise<void>;
    /** Activate whatever currently holds the focus ring. */
    select(): Promise<void>;
    /** Back one level — Menu on Apple TV, Back on Android TV. */
    back(): Promise<void>;
    /** Return to the TV home screen. */
    home(): Promise<void>;
    playPause(): Promise<void>;
    /**
     * Press `direction` until `isThere` reports true, up to `attempts` times.
     *
     * Returns whether it landed. A TV has no scroll-into-view and no way to tap a
     * known element, so walking the focus is the only way to reach something —
     * the same shape as the scroll loop the touch platforms need.
     */
    focusTo(
        isThere: () => Promise<boolean>,
        options?: { direction?: Direction; attempts?: number },
    ): Promise<boolean>;
}

export function createRemote(provider: RobotActionsDeviceProvider): Remote {
    const press = (button: RemoteButton) => provider.pressKey(BUTTONS[button]);

    return {
        press,
        up: () => press('up'),
        down: () => press('down'),
        left: () => press('left'),
        right: () => press('right'),
        select: () => press('select'),
        back: () => press('back'),
        home: () => press('home'),
        playPause: () => press('playPause'),

        async focusTo(isThere, { direction = 'down', attempts = 12 } = {}) {
            for (let i = 0; i < attempts; i++) {
                if (await isThere()) return true;
                await press(direction);
            }
            return isThere();
        },
    };
}

/** Valid button names, for steps that take one as a string. */
export function isRemoteButton(value: string): value is RemoteButton {
    return value in BUTTONS;
}
