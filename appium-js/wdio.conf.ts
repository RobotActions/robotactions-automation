import 'dotenv/config';

const platform = (process.env.PLATFORM || 'android').toLowerCase();

// Android capability
const androidCapability = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.DEVICE_UDID || 'emulator-5554',
    'appium:udid': process.env.DEVICE_UDID || 'emulator-5554',
    'appium:appPackage': process.env.APP_PACKAGE || 'com.example.app',
    'appium:appActivity': process.env.APP_ACTIVITY || '.MainActivity',
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
    'appium:deviceName': process.env.DEVICE_UDID || 'iPhone Simulator',
    'appium:udid': process.env.DEVICE_UDID || '',
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
    // iOS 17+/18+ HID / CoreDevice-held devices: xcodebuild cannot launch WDA
    // (CoreDevice holds the device). Set USE_PREINSTALLED_WDA=true to launch a
    // *preinstalled* WDA runner via devicectl with zero xcodebuild. Install the
    // runner once beforehand (RDS: scripts/ios/install-wda-runner.sh).
    // See docs/IOS18_APPIUM_PREINSTALLED_WDA.md.
    ...(process.env.USE_PREINSTALLED_WDA === 'true'
        ? {
              'appium:usePreinstalledWDA': true,
              'appium:updatedWDABundleId':
                  process.env.WDA_BUNDLE_ID || 'com.facebook.WebDriverAgentRunner',
          }
        : {}),
    // Optional: attach to a WDA you launched yourself (warm-WDA model) — Appium
    // then does neither xcodebuild nor its own tunnel.
    ...(process.env.WDA_URL ? { 'appium:webDriverAgentUrl': process.env.WDA_URL } : {}),
    // Plugin-managed WDA: the appium-session-plugin starts stock WDA on-demand
    // via pymobiledevice3 over the existing tunnel and injects webDriverAgentUrl
    // (per-session; torn down on session end). Requires the session-plugin.
    ...(process.env.IOS_MANAGED_WDA === 'true'
        ? { 'ra:iosManagedWda': true, 'ra:liveVideo': false }
        : {}),
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
