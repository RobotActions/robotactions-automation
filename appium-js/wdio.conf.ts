import 'dotenv/config';

const platform = (process.env.PLATFORM || 'android').toLowerCase();

// Android capability
const androidCapability = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    // Both deviceName and udid are optional for the grid: PLATFORM alone is
    // enough and it auto-distributes to any free Android node. Pinning a
    // device therefore sends udid ONLY.
    //
    // deviceName must not be set to the UDID. The grid matches it against the
    // node's stereotype, which carries the model name (e.g. "SM-N986W"), so
    // sending the UDID there can never match and the request is refused with
    // "No nodes support the capabilities in the request" — even when the UDID
    // itself is perfectly valid.
    ...(process.env.DEVICE_UDID ? { 'appium:udid': process.env.DEVICE_UDID } : {}),
    // Only pin an app when provided — omitting it lets a session start without
    // launching one (device-level smoke), and avoids failing on a placeholder
    // package that is not installed.
    ...(process.env.APP_PACKAGE ? { 'appium:appPackage': process.env.APP_PACKAGE } : {}),
    ...(process.env.APP_ACTIVITY ? { 'appium:appActivity': process.env.APP_ACTIVITY } : {}),
    'appium:noReset': true,
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 120,
    // App install: set APP_PATH to .apk file path or URL for auto-install
    ...(process.env.APP_PATH ? { 'appium:app': process.env.APP_PATH } : {}),
};

// iOS capability
const iosCapability = {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    // As with Android: pin a device only when asked, so the grid can
    // auto-distribute to any free iOS node otherwise.
    // As with Android: udid only. deviceName is optional and matching it
    // against the UDID never succeeds.
    ...(process.env.DEVICE_UDID ? { 'appium:udid': process.env.DEVICE_UDID } : {}),
    // Only pin a bundleId when provided — omitting it lets a session start
    // without launching an app (device-level smoke), and avoids the
    // "App with bundle identifier 'com.example.app' unknown" failure.
    ...(process.env.BUNDLE_ID ? { 'appium:bundleId': process.env.BUNDLE_ID } : {}),
    'appium:noReset': true,
    'appium:newCommandTimeout': 120,
    'appium:wdaLaunchTimeout': 120000,
    'appium:wdaConnectionTimeout': 120000,
    // App install: set APP_PATH to .ipa/.app file path or URL for auto-install
    ...(process.env.APP_PATH ? { 'appium:app': process.env.APP_PATH } : {}),
    // iOS 17+/18+: build-at-session-start is unreliable on these devices. Set
    // USE_PREINSTALLED_WDA=true to use a runner already installed on the device
    // instead. Install it once beforehand.
    ...(process.env.USE_PREINSTALLED_WDA === 'true'
        ? {
              'appium:usePreinstalledWDA': true,
              'appium:updatedWDABundleId':
                  process.env.IOS_RUNNER_BUNDLE_ID || 'com.facebook.WebDriverAgentRunner',
          }
        : {}),
    // Optional: attach to a runner you launched yourself, so Appium neither
    // builds one nor manages its own connection.
    ...(process.env.IOS_RUNNER_URL ? { 'appium:webDriverAgentUrl': process.env.IOS_RUNNER_URL } : {}),
};

const activeCapability = platform === 'ios' ? iosCapability : androidCapability;

// GRID_HOST may include port (e.g. "localhost:5555")
const gridHost = process.env.GRID_HOST || 'localhost:5555';
const [hostname, portStr] = gridHost.split(':');
const port = parseInt(portStr || '5555', 10);

export const config = {
    runner: 'local' as const,

    specs: [
        './features/**/*.feature',
    ],
    exclude: [],

    maxInstances: 1,

    capabilities: [activeCapability],

    // Appium server connection
    protocol: 'http' as const,
    hostname: hostname,
    port: port,
    path: '/wd/hub',
    headers: {
        ...(process.env.AUTH_TOKEN ? { Authorization: `Bearer ${process.env.AUTH_TOKEN}` } : {}),
    },

    framework: 'cucumber',
    cucumberOpts: {
        require: [
            './step-definitions/**/*.ts',
        ],
        backtrace: false,
        dryRun: false,
        failFast: false,
        snippets: true,
        source: true,
        strict: false,
        tagExpression: '',
        timeout: 60000,
        ignoreUndefinedDefinitions: false,
    },

    reporters: [
        'spec',
        ['junit', {
            outputDir: './test-results',
            outputFileFormat: ({ cid }: { cid: string }) => `results-${cid}.xml`,
        }],
        ['html-nice', {
            outputDir: './reports/html',
            filename: 'report.html',
            reportTitle: 'Test Report',
            showInBrowser: false,
            collapseTests: false,
        }],
    ],

    waitforTimeout: 15000,
    connectionRetryTimeout: 180000,
    connectionRetryCount: 3,

    afterStep: async function (_step: unknown, _scenario: unknown, result: { passed: boolean }) {
        if (!result.passed) {
            await browser.takeScreenshot();
        }
    },
};
