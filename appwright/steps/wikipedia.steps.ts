import { Before, Given, When, test } from './fixtures';
import { appBundleId } from '../config';
import type { RemoteSession } from '../remote';

/**
 * Steps for the Wikipedia sample (features/wikipedia.feature) — the app from
 * Appwright's own example on Android, and our own device build of the
 * open-source iOS app. The generic `I tap …` / `… is on screen` steps in
 * settings.steps.ts do the rest.
 */

/** Android package (Appwright's 2022 APK) and our iOS build's bundle id. */
const WIKIPEDIA_IDS = ['org.wikipedia', 'org.wikimedia.wikipedia.robotactions'];

/**
 * Launch arguments the app's own UI tests use to make a first launch
 * deterministic: skip onboarding (it is a persisted 50/50 A/B test between
 * two flows) and suppress the tips and announcements that would otherwise
 * cover the feed. Each is a `-Key VALUE` pair, read through NSUserDefaults.
 */
const IOS_LAUNCH_ARGS = [
    '-DidShowOnboarding5.3', 'YES',
    '-WMFEnableHomeTabForTesting', 'NO',
    '-WMFHideTipsForTesting', 'YES',
    '-WMFSuppressActivityTabOnboardingForTesting', 'YES',
    '-WMFSuppressGamesAnnouncementForTesting', 'YES',
];

Before('@wikipedia', async () => {
    test.skip(
        !WIKIPEDIA_IDS.includes(appBundleId() ?? ''),
        `The Wikipedia sample runs only when APP_PACKAGE / BUNDLE_ID is one of ${WIKIPEDIA_IDS.join(', ')} (see features/wikipedia.feature).`,
    );
});

// ── Android (Appwright's example APK) ───────────────────────────────────────

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

// ── iOS (our device build of wikimedia/wikipedia-ios) ───────────────────────

Given('the Wikipedia app is open past its onboarding', async ({ device, deviceProvider }) => {
    // Relaunch with the app's testing arguments rather than tapping through
    // onboarding: which of the two flows appears is decided per install by a
    // coin flip, and only one of them has a Skip button on its first step.
    const session = deviceProvider as RemoteSession;
    if (!session.client) throw new Error('The robotactions provider exposes no WebDriver client on this session.');
    const bundleId = appBundleId();
    await session.client.executeScript('mobile: terminateApp', [{ bundleId }]);
    await session.client.executeScript('mobile: launchApp', [{ bundleId, arguments: IOS_LAUNCH_ARGS }]);
    await device.getById('Explore View').waitFor('visible');
});

When('I open the Search tab', async ({ device }) => {
    await device.getById('Search Tab Button').tap();
    await device.getById('Search Field').waitFor('visible');
});

When('I type {string} into the search field', async ({ device }, term: string) => {
    const field = device.getById('Search Field');
    await field.tap();
    await field.fill(term);
});
