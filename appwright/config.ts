/**
 * The single place this template reads the environment.
 *
 * Nothing else — not `appwright.config.ts`, not a step, fixture or page object
 * — should touch `process.env` directly. Both configs and the device provider
 * pull from here, so the grid wiring cannot drift apart between them.
 *
 * Deliberately free of any `appwright` import: this module is loaded by the
 * Playwright config files, and keeping the config graph clear of the fixture
 * module (which builds a `test` object at import time) avoids loading the test
 * runtime just to read a hostname.
 */
// dotenv is optional — env vars are injected by Docker in container workspaces.
try { require('dotenv/config'); } catch { /* not installed — using process.env directly */ }

function str(name: string, fallback = ''): string {
    const value = process.env[name];
    return value === undefined || value === '' ? fallback : value;
}

function opt(name: string): string | undefined {
    const value = process.env[name];
    return value === undefined || value === '' ? undefined : value;
}

function int(name: string, fallback: number): number {
    const parsed = parseInt(str(name, ''), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function bool(name: string, fallback: boolean): boolean {
    const value = str(name).toLowerCase();
    if (value === '') return fallback;
    return value !== 'false' && value !== '0' && value !== 'no';
}

const LOOPBACK = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

/**
 * The platforms Appium drives here.
 *
 * The two TV platforms — `tvos` (Apple TV) and `androidtv` (Android TV, Google
 * TV, Chromecast) — reuse their phone counterpart's driver almost entirely:
 * `tvos` is XCUITest like `ios`, `androidtv` is UiAutomator2 like `android`. What
 * sets both apart is that a TV has no touchscreen, so interaction goes through a
 * remote's focus ring instead of taps. See the `remote` fixture in
 * steps/fixtures.ts.
 */
export type PlatformName = 'android' | 'ios' | 'tvos' | 'androidtv';

const ALL_PLATFORMS: PlatformName[] = ['android', 'ios', 'tvos', 'androidtv'];

/** True for the platforms driven by XCUITest (and therefore WebDriverAgent). */
export function isApple(platform: PlatformName): boolean {
    return platform === 'ios' || platform === 'tvos';
}

/**
 * True for the set-top platforms: no touchscreen, navigation by focus ring.
 *
 * Drives which input mechanism the `remote` fixture uses, and is the reason the
 * `@tv` features exist separately from the touch ones.
 */
export function isTv(platform: PlatformName): boolean {
    return platform === 'tvos' || platform === 'androidtv';
}

/**
 * Per-project options this template adds to Playwright's `use` block.
 *
 * Declared here (rather than in the fixtures module) so `appwright.config.ts`
 * can type its `use` and `projects` entries with a plain `import type`, which
 * the transpiler erases.
 */
export interface GridDeviceOptions {
    /** Platform the session is requested on. */
    platform: PlatformName;
    /** Pin one handset by UDID. Unset lets the grid pick any free device. */
    udid?: string;
    /** Path or https URL to the .apk/.ipa under test. */
    buildPath?: string;
    /** Android package / iOS bundle id, for activate + terminate + clipboard. */
    appBundleId?: string;
    /** Android launcher activity, when the app needs one named explicitly. */
    appActivity?: string;
    /** How long locator assertions keep retrying, in ms. */
    expectTimeout: number;
}

/** True when running on CI — drives retries, workers and `forbidOnly`. */
export function isCi(): boolean {
    const value = str('CI').toLowerCase();
    return value !== '' && value !== 'false' && value !== '0';
}

/**
 * Platforms to build projects for, from `PLATFORM`.
 *
 * One project per platform, named `android` / `ios` / `tvos`, so `--project=ios`
 * selects a platform and the HTML report separates them. `PLATFORM=android,ios`
 * runs both — worth doing on a fleet that has free devices of each.
 */
export function platforms(): PlatformName[] {
    const requested = str('PLATFORM', 'android')
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
    const known = requested.filter((p): p is PlatformName =>
        (ALL_PLATFORMS as string[]).includes(p));
    if (known.length === 0) {
        throw new Error(
            `PLATFORM="${str('PLATFORM')}" is not usable. Set it to one of `
                + `${ALL_PLATFORMS.join(', ')}, or a comma-separated combination `
                + `such as android,ios.`,
        );
    }
    return [...new Set(known)];
}

/** The platform a single-project run defaults to. */
export function defaultPlatform(): PlatformName {
    return platforms()[0];
}

/** Pin one device. Unset (the norm) lets the grid hand out any free handset. */
export function deviceUdid(): string | undefined {
    return opt('DEVICE_UDID');
}

/** The build under test — a local path or an https URL the grid fetches. */
export function buildPath(): string | undefined {
    return opt('APP_PATH');
}

/** Bundle id (iOS) or package name (Android) of the app under test. */
export function appBundleId(): string | undefined {
    return opt('BUNDLE_ID') ?? opt('APP_PACKAGE');
}

export function appActivity(): string | undefined {
    return opt('APP_ACTIVITY');
}

/**
 * Whether to uninstall and reinstall the build for each session.
 *
 * Appwright's own providers hardcode `fullReset: true`, which is the right
 * default for test isolation: each test starts from a first-launch state.
 * Set `APP_FULL_RESET=false` to keep the installed app and its data instead —
 * much faster on a shared fleet, at the cost of tests seeing each other's
 * leftovers. Only meaningful when `APP_PATH` is set.
 */
export function fullReset(): boolean {
    return bool('APP_FULL_RESET', true);
}

/** How long locator assertions retry before failing, in ms. */
export function expectTimeout(): number {
    return int('EXPECT_TIMEOUT', 20_000);
}

/**
 * Per-test timeout, in ms.
 *
 * Generous on purpose: every test starts its own Appium session, and session
 * creation on a real handset is tens of seconds before a single assertion runs
 * (longer on iOS, where the automation runner has to come up). Playwright's
 * 30s default would fail healthy tests during setup.
 */
export function testTimeout(): number {
    return int('TEST_TIMEOUT', 240_000);
}

/**
 * Worker count: `WORKERS` wins, else 1.
 *
 * One at a time by default because a device is exclusive — a session holds the
 * handset for its whole duration. Raise it to fan out across the fleet: with no
 * `DEVICE_UDID` pinned, the grid hands each worker a different free device.
 * Never set it above the number of free devices on the platform, or the extra
 * workers queue waiting for a slot.
 */
export function workers(): number {
    const explicit = int('WORKERS', -1);
    return explicit > 0 ? explicit : 1;
}

export function retries(): number {
    return isCi() ? 1 : 0;
}

export function forbidOnly(): boolean {
    return isCi();
}

/** Suite label the grid stores as `sessions.test_suite`. */
export function suiteName(): string | undefined {
    return opt('RA_TESTSUITE');
}

/** Groups a run in the dashboard — a build number, tag, or commit. */
export function releaseId(): string | undefined {
    return opt('RA_RELEASE_ID');
}

/**
 * Record the request waterfall into the session's Network tab.
 *
 * Off by default, and that is deliberate: capture costs real disk. It also only
 * applies to web contexts (a webview or mobile browser) — a purely native
 * session has no network protocol to listen to, so the tab stays empty.
 */
export function networkCapture(): boolean {
    return bool('RA_NETWORK_CAPTURE', false);
}

/**
 * Whether to let the grid infer a verdict from the session's command stream.
 *
 * Defaults on, because that inference is a useful backstop. It has to be off for
 * tvOS: the grid probes the device log to decide, an Apple TV serves no logs, and
 * the resulting `getLog failed: No logs currently available` flips a passing run
 * to failed in the dashboard. Our own `ra:job-result` is authoritative anyway.
 *
 * `RA_AUTO_FAIL_DETECT=true` forces it back on if you want to see that for
 * yourself; `=false` disables it everywhere.
 */
export function autoFailDetect(platform: PlatformName): boolean {
    return bool('RA_AUTO_FAIL_DETECT', platform !== 'tvos');
}

/**
 * Route to a set-top device by class rather than by pinning one udid.
 *
 * The grid advertises `appium:deviceClass` on every slot (`TV` for Android TV and
 * Chromecast, `AppleTV`, `Phone`, `iPad`…). Sending it lets `PLATFORM=androidtv`
 * pick any free TV instead of requiring DEVICE_UDID, the same way a plain
 * `android` run picks any free handset.
 */
export function deviceClass(platform: PlatformName): string | undefined {
    const explicit = opt('DEVICE_CLASS');
    if (explicit) return explicit;
    return platform === 'androidtv' ? 'TV' : undefined;
}

/**
 * Opt in to the Settings walkthrough (`@settings`).
 *
 * Off by default because it asserts on labels from **stock** Android and iOS.
 * OEM skins rename them — "Network and Internet" is "Connections" on Samsung —
 * and the default run takes whatever free device the grid offers, so leaving it
 * on would make a fresh clone flaky. Turn it on together with a `DEVICE_UDID`
 * pinned to a stock handset.
 */
export function settingsWalkthrough(): boolean {
    return bool('RUN_SETTINGS_WALKTHROUGH', false);
}

/** iOS: use an automation runner already installed on the device. */
export function usePreinstalledRunner(): boolean {
    return bool('USE_PREINSTALLED_RUNNER', false);
}

export function iosRunnerBundleId(): string {
    return str('IOS_RUNNER_BUNDLE_ID', 'com.facebook.WebDriverAgentRunner');
}

/** iOS: attach to a runner you started yourself, instead of managing one. */
export function iosRunnerUrl(): string | undefined {
    return opt('IOS_RUNNER_URL');
}

export interface GridEndpoint {
    protocol: 'http' | 'https';
    hostname: string;
    port: number;
    /** WebDriver path, token prefix included. */
    path: string;
    /** `host:port`, for log lines. */
    hostPort: string;
}

/**
 * Where the WebDriver sessions go.
 *
 * Scheme is inferred rather than hardcoded: locally the grid is plain HTTP on
 * `localhost:5555`, while the hosted endpoint is HTTPS on 443. Sending
 * cleartext to a TLS endpoint fails with an opaque connection error, so the
 * inference is worth more than a shorter function.
 *
 * The token rides the URL **path** (`/t/<token>/wd/hub`) rather than an
 * `Authorization` header. That is the grid's documented auth for Appium
 * clients and the only form that works everywhere — several clients cannot
 * attach a header to a WebDriver connection at all.
 */
export function gridEndpoint(): GridEndpoint {
    const raw = str('GRID_URL') || str('GRID_HOST', 'localhost:5555');

    const schemeMatch = raw.match(/^(https?):\/\/(.+)$/);
    const scheme = schemeMatch?.[1];
    const hostPort = (schemeMatch?.[2] ?? raw).replace(/\/+$/, '');
    const [hostname, portStr] = hostPort.split(':');
    const loopback = LOOPBACK.some((h) => hostname.startsWith(h));

    let secure: boolean;
    if (scheme) {
        secure = scheme === 'https';
    } else {
        secure = portStr === '443' || (!loopback && !portStr);
    }

    const port = parseInt(portStr || (secure ? '443' : '5555'), 10);
    const token = str('AUTH_TOKEN');
    const path = str('GRID_PATH', token ? `/t/${token}/wd/hub` : '/wd/hub');

    return { protocol: secure ? 'https' : 'http', hostname, port, path, hostPort: `${hostname}:${port}` };
}

/** One-line description of where tests will run — printed by the configs. */
export function describeTarget(): string {
    const grid = gridEndpoint();
    const auth = str('AUTH_TOKEN') ? 'token in path' : 'NO AUTH_TOKEN — expect 401';
    // Name the installed app when there is no build to install, rather than
    // reporting "no app" while the run is in fact driving one.
    const app = buildPath()
        ?? (appBundleId() ? `${appBundleId()} (already installed)` : 'no app (device-level session)');
    return `${grid.protocol}://${grid.hostPort} (${auth}) · ${platforms().join('+')} · ${app}`;
}
