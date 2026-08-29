/**
 * The single place this template reads the environment.
 *
 * Nothing else — not `playwright.config.ts`, not `playwright.regular.config.ts`,
 * not a step or fixture — should touch `process.env` directly. The two configs
 * previously repeated the same grid-wiring logic, which is exactly how such
 * blocks drift apart.
 *
 * Note this module also *writes* a few `process.env` keys
 * (`SELENIUM_REMOTE_URL`, `SELENIUM_REMOTE_HEADERS`,
 * `SELENIUM_REMOTE_CAPABILITIES`) — that is Playwright's documented interface
 * for Selenium routing, so ownership of those writes lives here too.
 */
// dotenv is optional — env vars are injected by Docker in container workspaces.
try { require('dotenv/config'); } catch { /* not installed — using process.env directly */ }

function str(name: string, fallback = ''): string {
    const value = process.env[name];
    return value === undefined || value === '' ? fallback : value;
}

function int(name: string, fallback: number): number {
    const parsed = parseInt(str(name, ''), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

const LOOPBACK = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

/** True when running on CI — drives headless, retries and worker count. */
export function isCi(): boolean {
    const value = str('CI').toLowerCase();
    return value !== '' && value !== 'false' && value !== '0';
}

/** Application under test. */
export function baseUrl(): string {
    return str('BASE_URL', 'https://robotactions.com');
}

/** Suite label persisted by the grid as `sessions.test_suite`. */
export function suiteName(): string {
    return str('RA_TESTSUITE', 'Playwright');
}

/** Worker count: `WORKERS` wins, else 1 on CI and 5 locally. */
export function workers(): number {
    const explicit = int('WORKERS', -1);
    if (explicit > 0) return explicit;
    return isCi() ? 1 : 5;
}

export function retries(): number {
    return isCi() ? 2 : 0;
}

export function forbidOnly(): boolean {
    return isCi();
}

export function headless(): boolean {
    return isCi();
}

/** Which browser the grid's Playwright endpoint should hand back. */
export function gridBrowser(): string {
    return str('PW_GRID_BROWSER', 'chromium');
}

interface Endpoint {
    /** `host` or `host:port`, no scheme. */
    hostPort: string;
    /** True when the endpoint is loopback and therefore plain HTTP/WS. */
    secure: boolean;
}

/**
 * Resolves the grid endpoint and whether it is TLS.
 *
 * Scheme is inferred rather than hardcoded: locally the grid is plain HTTP on
 * `localhost:5555`, while the public endpoint used from CI is HTTPS on 443.
 * Hardcoding `http://` / `ws://` (as both configs did) would send cleartext to
 * a TLS endpoint and fail with an opaque connection error.
 */
function endpoint(): Endpoint | undefined {
    const raw = str('GRID_URL') || str('GRID_HOST');
    if (!raw) return undefined;

    const schemeMatch = raw.match(/^(https?|wss?):\/\/(.+)$/);
    const scheme = schemeMatch?.[1];
    const hostPort = (schemeMatch?.[2] ?? raw).replace(/\/+$/, '');
    const [hostname, port] = hostPort.split(':');
    const loopback = LOOPBACK.some((h) => hostname.startsWith(h));

    let secure: boolean;
    if (scheme) {
        secure = scheme === 'https' || scheme === 'wss';
    } else {
        secure = port === '443' || (!loopback && !port);
    }
    return { hostPort, secure };
}

export type GridMode = 'ws' | 'selenium-remote' | 'local';

/**
 * Which routing mode applies.
 *
 * `ws` — connect to the grid's Playwright endpoint
 *        (`ws://<host>/playwright/<browser>`). Preferred, and the more reliable
 *        of the two for a Playwright-only suite.
 * `selenium-remote` — route through the WebDriver endpoint via
 *        `SELENIUM_REMOTE_URL`. Use only when mixing Playwright and Selenium
 *        clients on one grid; Playwright does not always send
 *        `DELETE /session/<id>`, which can leave sessions held open.
 * `local` — no grid configured; Playwright launches a local browser.
 */
export function gridMode(): GridMode {
    if (!endpoint() && !str('SELENIUM_REMOTE_URL')) return 'local';
    const explicit = str('PLAYWRIGHT_MODE').toLowerCase();
    if (explicit === 'ws' || explicit === 'selenium-remote') return explicit;
    return str('SELENIUM_REMOTE_URL') ? 'selenium-remote' : 'ws';
}

export interface ConnectOptions {
    wsEndpoint: string;
}

/**
 * Grid wiring for a Playwright project.
 *
 * In `selenium-remote` mode this sets the `SELENIUM_REMOTE_*` env vars
 * Playwright reads internally and returns undefined. In `ws` mode it returns
 * `connectOptions` for the project's `use` block.
 */
export function gridConnectOptions(): ConnectOptions | undefined {
    const mode = gridMode();
    if (mode === 'local') return undefined;

    const target = endpoint();
    const token = str('AUTH_TOKEN');

    if (mode === 'selenium-remote') {
        const existing = str('SELENIUM_REMOTE_URL');
        if (!existing && target) {
            process.env.SELENIUM_REMOTE_URL = `${target.secure ? 'https' : 'http'}://${target.hostPort}`;
        }
        if (token && !str('SELENIUM_REMOTE_HEADERS')) {
            process.env.SELENIUM_REMOTE_HEADERS = JSON.stringify({ Authorization: `Bearer ${token}` });
        }
        if (str('SELENIUM_REMOTE_URL') && !str('SELENIUM_REMOTE_CAPABILITIES')) {
            process.env.SELENIUM_REMOTE_CAPABILITIES = JSON.stringify({ 'ra:testsuite': suiteName() });
        }
        return undefined;
    }

    if (!target) return undefined;
    // The JWT goes in the URL as ?token=… — Playwright's connect({headers})
    // silently drops custom HTTP headers on ws:// upgrades and the grid's auth
    // gate then rejects the upgrade with 401. Verified against playwright-core
    // 1.59.x; the server accepts ?token= on the WS upgrade.
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    const scheme = target.secure ? 'wss' : 'ws';
    return { wsEndpoint: `${scheme}://${target.hostPort}/playwright/${gridBrowser()}${query}` };
}

/** One-line description of where tests will run — printed by the configs. */
export function describeTarget(): string {
    const mode = gridMode();
    if (mode === 'local') return 'local browser (no GRID_HOST/GRID_URL set)';
    const target = endpoint();
    return `${mode} → ${target ? target.hostPort : str('SELENIUM_REMOTE_URL')}`;
}
