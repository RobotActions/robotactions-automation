import { Before, When, test } from './fixtures';
import { isRemoteButton } from '../remote';
import { isTv } from '../config';

/**
 * Steps for the set-top platforms. The assertions are shared with the device
 * smoke — a TV session answers the same locator and screenshot commands as a
 * phone — so only the input side needs its own steps.
 */

Before('@tv', async ({ platform }) => {
    test.skip(
        !isTv(platform),
        'TV-only. Run with PLATFORM=tvos (Apple TV) or PLATFORM=androidtv (Android TV / Chromecast).',
    );
});

When('I press {string} on the remote', async ({ remote }, button: string) => {
    if (!isRemoteButton(button)) {
        throw new Error(
            `"${button}" is not a remote button. Use up, down, left, right, select, back, home or playPause.`,
        );
    }
    await remote.press(button);
});
