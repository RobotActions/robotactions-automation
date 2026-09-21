import { Before, Given, When, test } from './fixtures';
import { appBundleId } from '../config';

/**
 * Steps for the Wikipedia sample (features/wikipedia.feature) — the app from
 * Appwright's own example, installed from the App Library. The generic
 * `I tap …` / `… is on screen` steps in settings.steps.ts do the rest.
 */

const WIKIPEDIA_PACKAGE = 'org.wikipedia';

Before('@wikipedia', async ({ gridPlatform: platform }) => {
    test.skip(
        appBundleId() !== WIKIPEDIA_PACKAGE,
        `The Wikipedia sample runs only when APP_PACKAGE=${WIKIPEDIA_PACKAGE} (see features/wikipedia.feature).`,
    );
    test.skip(platform !== 'android', 'Appwright ships the Wikipedia iOS build for the Simulator only.');
});

Given('the Wikipedia app is on its first screen', async ({ device }) => {
    // fullReset (the default with a build) reinstalls per session, so the
    // onboarding carousel is the first screen. With APP_FULL_RESET=false the
    // app keeps its state and opens on the Explore feed instead; both carry
    // the search box, and "I skip the onboarding" tolerates either.
    await device.getByText('Skip').isVisible({ timeout: 5_000 });
});

When('I skip the onboarding', async ({ device }) => {
    const skip = device.getByText('Skip');
    if (await skip.isVisible({ timeout: 2_000 })) await skip.tap();
});

When('I search Wikipedia for {string}', async ({ device }, term: string) => {
    // The feed's search bar and the search screen's input carry the same text.
    // Tapping the first replaces it with the second, so the locator has to be
    // resolved again after the tap — reusing it fills a detached element
    // ("stale element reference").
    await device.getByText('Search Wikipedia', { exact: true }).tap();
    const input = device.getByText('Search Wikipedia', { exact: true });
    await input.waitFor('visible');
    await input.fill(term);
});
