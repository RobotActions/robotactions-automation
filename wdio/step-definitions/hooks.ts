import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';

BeforeAll(async function () {
    console.log('Test suite starting...');
});

Before(async function (scenario) {
    console.log(`Starting: ${scenario.pickle.name}`);
});

After(async function (scenario) {
    if (scenario.result?.status === 'FAILED') {
        const screenshot = await browser.takeScreenshot();
        this.attach(screenshot, 'image/png');
    }
});

AfterAll(async function () {
    console.log('Test suite complete.');
});
