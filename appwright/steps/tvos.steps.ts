import { Before, When, test } from './fixtures';
import type { RemoteButton } from '../remote';

/**
 * tvOS-only steps. The assertions are shared with the device smoke — a tvOS
 * session answers the same locator and screenshot commands as iOS — so only the
 * input side needs its own steps.
 */

Before('@tvos', async ({ platform }) => {
    test.skip(platform !== 'tvos', 'tvOS-only. Run with PLATFORM=tvos.');
});

When('I press {string} on the remote', async ({ remote }, button: string) => {
    await remote.press(button as RemoteButton);
});
