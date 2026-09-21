/**
 * The single place this template reads the environment.
 *
 * Nothing else — not `appwright.config.ts`, not a step, fixture or page object
 * — should touch `process.env` directly. Both configs and the device provider
 * pull from here, so the grid wiring cannot drift apart between them.
 *
 * The only `appwright` import here is a type (erased at compile time): this
 * module is loaded by the Playwright config files, and keeping the config graph
 * clear of the fixture module (which builds a `test` object at import time)
 * avoids loading the test runtime just to read a hostname.
 */
import type { Platform, RobotActionsConfig } from 'appwright';
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
 * Per-project options this template adds on top of Appwright's `use` block.
 *
 * `gridPlatform` is the template's own platform name — it knows about the two
 * TV platforms, which Appwright spells differently: `tvos` is
 * `Platform.TVOS`, `androidtv` is `Platform.ANDROID` plus `deviceClass: "TV"`.
 * Steps read this one; the provider reads Appwright's `platform`.
 */
export interface GridOptions {
    gridPlatform: PlatformName;
}

/** The template's platform name as Appwright's enum. */
export function appwrightPlatform(platform: PlatformName): Platform {
    // String literals rather than the enum so this stays a type-only import.
    if (platform === 'tvos') return 'tvos' as Platform;
    return (isApple(platform) ? 'ios' : 'android') as Platform;
}

/**
 * Extra Appium capabilities for a platform: the grid's `ra:*` reporting caps
 * (stripped by the proxy before they reach Appium) plus the iOS runner knobs.
 */
function extraCapabilities(platform: PlatformName): Record<string, unknown> {
    const caps: Record<string, unknown> = {
        'appium:newCommandTimeout': 120,
    };
    if (!isApple(platform) && appActivity()) caps['appium:appActivity'] = appActivity();
    // Reinstall per session is Appwright's default when there is a build; the
    // opt-out keeps the app and its data between tests.
    if (buildPath() && !fullReset()) {
        caps['appium:fullReset'] = false;
        caps['appium:noReset'] = true;
    }
    if (releaseId()) caps['ra:releaseId'] = releaseId();
    if (networkCapture()) caps['ra:networkCapture'] = true;
    if (!autoFailDetect(platform)) caps['ra:autoFailDetect'] = false;
    if (isApple(platform)) {
        // Building a runner at session start is unreliable on iOS 17+/18+. A
        // runner already installed on the device avoids the build entirely;
        // alternatively point at one you launched yourself.
        caps['appium:wdaLaunchTimeout'] = 120_000;
        caps['appium:wdaConnectionTimeout'] = 120_000;
        if (usePreinstalledRunner()) {
            caps['appium:usePreinstalledWDA'] = true;
            caps['appium:updatedWDABundleId'] = iosRunnerBundleId();
        }
        if (iosRunnerUrl()) caps['appium:webDriverAgentUrl'] = iosRunnerUrl();
    }
    return caps;
}

/**
 * One Playwright project per platform, wired to Appwright's `robotactions`
 * provider. Everything the provider needs comes from the environment through
 * this one function, so the BDD and regular configs cannot drift apart.
 */
export function gridProject(platform: PlatformName) {
    const device: RobotActionsConfig = {
        provider: 'robotactions',
        udid: deviceUdid(),
        deviceClass: deviceClass(platform),
        testSuite: suiteName(),
        capabilities: extraCapabilities(platform),
    };
    return {
        name: platform,
        use: {
            gridPlatform: platform,
            platform: appwrightPlatform(platform),
            device,
            buildPath: buildPath(),
            appBundleId: appBundleId(),
            expectTimeout: expectTimeout(),
        },
    };
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

/**
 * The build under test, or undefined for a device-level session.
 *
 * `APP_ID` names a build in the RobotActions App Library by its upload id —
 * the grid fetches it with this run's token, so nothing needs hosting.
 * `APP_PATH` is the older form: an https URL the grid can download, or an
 * absolute path on the grid host. `APP_ID` wins when both are set.
 */
export function buildPath(): string | undefined {
    const id = opt('APP_ID');
    if (id) return `ra-app://${id}`;
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

/**
 * The grid's base URL from GRID_URL / GRID_HOST — `host:port` with the scheme
 * inferred (443 or a non-loopback host with no port means https).
 */
export function gridUrl(): string {
    const raw = str('GRID_URL') || str('GRID_HOST', 'localhost:5555');
    const schemeMatch = raw.match(/^(https?):\/\/(.+)$/);
    const scheme = schemeMatch?.[1];
    const hostPort = (schemeMatch?.[2] ?? raw).replace(/\/+$/, '');
    const [hostname, portStr] = hostPort.split(':');
    const loopback = LOOPBACK.some((h) => hostname.startsWith(h));
    const secure = scheme ? scheme === 'https' : portStr === '443' || (!loopback && !portStr);
    const port = portStr || (secure ? '443' : '5555');
    return `${secure ? 'https' : 'http'}://${hostname}:${port}`;
}

/**
 * Hand the grid connection to Appwright's provider.
 *
 * The provider reads ROBOTACTIONS_GRID_URL / ROBOTACTIONS_TOKEN; this template's
 * contract is GRID_HOST / AUTH_TOKEN (what the dashboard hands out and what the
 * other templates use), so the two are bridged here — at import, because the
 * config file, the global setup, every worker and the video reporter each load
 * this module before the provider runs. An explicit ROBOTACTIONS_* wins.
 */
process.env.ROBOTACTIONS_GRID_URL ??= gridUrl();
if (str('AUTH_TOKEN')) process.env.ROBOTACTIONS_TOKEN ??= str('AUTH_TOKEN');

export function describeTarget(): string {
    const auth = process.env.ROBOTACTIONS_TOKEN ? 'bearer token' : 'NO AUTH_TOKEN — expect 401';
    // Name the installed app when there is no build to install, rather than
    // reporting "no app" while the run is in fact driving one.
    const app = buildPath()
        ?? (appBundleId() ? `${appBundleId()} (already installed)` : 'no app (device-level session)');
    return `${gridUrl()} (${auth}) · ${platforms().join('+')} · ${app}`;
}
