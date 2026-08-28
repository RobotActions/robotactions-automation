/**
 * The single place this template reads the environment.
 *
 * Nothing else — no `wdio.*.conf.ts`, no step definition, no page object —
 * should touch `process.env` directly. Every config file previously repeated
 * the same connection block, which is how `wdio.mobileweb.conf.ts` drifted out
 * of sync with the iOS config and shipped a capability shape that could never
 * create a session. One reader, one set of defaults, one place to fix.
 */
import 'dotenv/config';

function str(name: string, fallback = ''): string {
    const value = process.env[name];
    return value === undefined || value === '' ? fallback : value;
}

function int(name: string, fallback: number): number {
    const parsed = parseInt(str(name, ''), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

const LOOPBACK = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

export interface GridConnection {
    protocol: 'http' | 'https';
    hostname: string;
    port: number;
    path: string;
    headers: Record<string, string>;
}

/**
 * Resolves the grid endpoint from `GRID_URL` (wins, may carry a scheme) or
 * `GRID_HOST` (`host` or `host:port`), plus `GRID_PORT`.
 *
 * Scheme is inferred rather than hardcoded: locally the grid is plain HTTP on
 * `localhost:5555`, while the public endpoint used from CI is HTTPS on 443.
 * Every conf file used to hardcode `protocol: 'http'`, so pointing one at the
 * public host would have sent cleartext to a TLS endpoint and failed with an
 * opaque connection error.
 */
export interface GridOptions {
    /**
     * How the token reaches the proxy.
     *
     * `header` (default) — `Authorization: Bearer <token>`.
     * `path` — `/t/<token>/` prefix, which the proxy strips before forwarding.
     * The header is still sent in path mode as a fallback for header-auth grids.
     */
    auth?: 'header' | 'path';
}

export function gridConnection(options: GridOptions = {}): GridConnection {
    const rawUrl = str('GRID_URL');
    const rawHost = str('GRID_HOST', 'localhost:5555');
    const raw = rawUrl || rawHost;

    // Explicit override always wins over inference.
    const forced = str('GRID_PROTOCOL').toLowerCase();
    let protocol: 'http' | 'https' | undefined =
        forced === 'http' || forced === 'https' ? forced : undefined;
    let hostPort = raw;

    const schemeMatch = raw.match(/^(https?):\/\/(.+)$/);
    if (schemeMatch) {
        protocol = protocol ?? (schemeMatch[1] as 'http' | 'https');
        hostPort = schemeMatch[2];
    }

    const [hostname, portFromHost] = hostPort.replace(/\/+$/, '').split(':');
    const loopback = LOOPBACK.some((h) => hostname.startsWith(h));
    const port = portFromHost
        ? parseInt(portFromHost, 10)
        : int('GRID_PORT', protocol === 'https' || !loopback ? 443 : 5555);

    if (!protocol) {
        // A bare host: loopback stays HTTP, anything else is assumed to be the
        // public TLS endpoint (and port 443 settles it either way).
        protocol = loopback && port !== 443 ? 'http' : 'https';
    }

    const token = str('AUTH_TOKEN');
    const usePathAuth = options.auth === 'path' && token !== '';
    return {
        protocol,
        hostname,
        port,
        path: usePathAuth ? `/t/${token}/` : '/',
        // Sent in both modes: harmless on a path-auth grid, and the fallback if
        // a proxy expects the header instead.
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    };
}

/** Suite label persisted by the grid as `sessions.test_suite`. */
export function suiteName(fallback = 'WebdriverIO'): string {
    return str('RA_TESTSUITE', fallback);
}

/**
 * Text of a Cucumber scenario failure, for `ra:job-result=failed:<reason>`.
 *
 * `PickleResult.error` is typed `string` but arrives as an Error object for
 * most real failures, so both shapes have to be handled. Configs that reached
 * for `result.error.message` directly silently got `undefined` for every
 * failure and fell back to the scenario name, which reports THAT A test failed
 * but never WHY — the dashboard's failure column read as a list of test titles.
 *
 * MUST be a single line. The reason is interpolated into the magic string
 * `ra:job-result=failed:<reason>`, which the grid proxy matches with an
 * anchored `(.+)` — and `.` does not cross a newline. When Cucumber hands the
 * error over as a string it is the whole stack trace, so an unsanitised reason
 * failed to match, was forwarded to the browser as real JavaScript, and came
 * back as `WebDriverError: Invalid left-hand side in assignment` while the
 * verdict was silently dropped. Verified on a real device 2026-08-28: the
 * failing scenario recorded test_name but no result at all.
 *
 * A stack trace's first line is the message, so taking it loses nothing.
 */
export function errorText(error: unknown): string {
    const raw = !error
        ? ''
        : typeof error === 'string'
            ? error
            : typeof (error as { message?: unknown }).message === 'string'
                ? (error as { message: string }).message
                : '';
    // First line only, then collapse any surviving whitespace runs — a tab or
    // a stray \r would travel fine but renders badly in the dashboard column.
    const firstLine = raw.split('\n')[0].replace(/\s+/g, ' ').trim();
    return firstLine || 'scenario failed';
}

/** Application under test. */
export function baseUrl(fallback = '{{BASE_URL}}'): string {
    return str('BASE_URL', fallback);
}

/** Dwell time between actions in the parallel/load scenarios, in ms. */
export function parallelDwellMs(fallback = 8000): number {
    return int('PARALLEL_DWELL_MS', fallback);
}

/** Parallel workers. `WDIO_MAX_INSTANCES` wins; `MAX_INSTANCES` is the alias. */
export function maxInstances(fallback = 1): number {
    const primary = int('WDIO_MAX_INSTANCES', -1);
    return primary > 0 ? primary : int('MAX_INSTANCES', fallback);
}

/** Release label for grouping runs in the dashboard. */
export function releaseId(fallback: string): string {
    return str('RA_RELEASE_ID', fallback);
}

/** Cucumber tag expression supplied by a runner script. */
export function tagExpression(fallback = ''): string {
    return str('TAGS', fallback);
}

/** Per-scenario repeat count used by the load runner. */
export function cucumberRepeat(fallback = 1): number {
    return int('CUCUMBER_REPEAT', fallback);
}

/** True when running on CI — drives headless for desktop browsers. */
export function isCi(): boolean {
    const value = str('CI').toLowerCase();
    return value !== '' && value !== 'false' && value !== '0';
}
