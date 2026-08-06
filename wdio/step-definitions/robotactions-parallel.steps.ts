/**
 * Step definitions for `features/robotactions-parallel.feature`.
 *
 * A longer mobile-web scenario used to demonstrate the Grid distributing
 * concurrent sessions across different physical devices. The `dwell` step keeps
 * each session alive long enough (PARALLEL_DWELL_MS, default 8s) that parallel
 * workers overlap in time — otherwise each 2-3s run finishes before the next
 * starts and they all land on the first free device.
 */
import { Given, Then } from '@cucumber/cucumber';
import { parallelDwellMs } from '../config';

const DWELL_MS = parallelDwellMs(8000);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

Given('I open RobotActions in the mobile browser', async () => {
    await browser.url('https://robotactions.com');
});

Then('I dwell on the page for a few seconds', async () => {
    await sleep(DWELL_MS);
});

Then('the page title should contain {string}', async (fragment: string) => {
    const title = await browser.getTitle();
    if (!title.includes(fragment)) {
        throw new Error(`title '${title}' missing '${fragment}'`);
    }
});

Then('the page should show the {string} URL', async (fragment: string) => {
    const url = await browser.getUrl();
    if (!url.includes(fragment)) {
        throw new Error(`url '${url}' missing '${fragment}'`);
    }
});

Then('the page text should mention {string}', async (word: string) => {
    const body = await $('body');
    const text = (await body.getText()).toLowerCase();
    if (!text.includes(word.toLowerCase())) {
        throw new Error(`page text missing '${word}'`);
    }
});
