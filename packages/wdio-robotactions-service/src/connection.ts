/**
 * Resolving the grid endpoint from the environment.
 *
 * This is the connection logic from the `wdio` template's `config.ts`, lifted
 * into something installable. The template still works by copy-paste; this
 * package exists for the larger group of users who already have a WebdriverIO
 * suite and want to point it at a RobotActions grid without editing every
 * `wdio.*.conf.ts` they own.
 */

const LOOPBACK = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

export interface GridConnection {
    protocol: 'http' | 'https';
    hostname: string;
    port: number;
    path: string;
    headers: Record<string, string>;
}

export interface RobotActionsOptions {
    /**
     * API token. Defaults to `RA_API_TOKEN`, falling back to `AUTH_TOKEN`
     * for suites built from the template repo.
     */
    token?: string;
    /**
     * Grid endpoint — `host`, `host:port`, or a full URL. Defaults to
     * `RA_GRID_URL`, then `GRID_URL`, then `GRID_HOST`.
     */
    url?: string;
    /**
     * How the token reaches the proxy.
     *
     * `header` (default) — `Authorization: Bearer <token>`.
     * `path` — a `/t/<token>/` prefix, which the proxy strips before
     * forwarding. The header is sent in both modes: harmless on a path-auth
     * grid, and the fallback if a proxy expects the header instead.
     *
     * Header auth is the default because Node 18+ `fetch` rejects credentials
     * embedded in a URL, and WebdriverIO is fetch-based. The `https://user:token@host`
     * form that works for the Python and Java clients cannot work here.
     */
    auth?: 'header' | 'path';
    /** Suite label persisted by the grid as `sessions.test_suite`. */
    testSuite?: string;
    /** Release label for grouping runs in the dashboard. */
    releaseId?: string;
}

function str(name: string, fallback = ''): string {
    const value = process.env[name];
    return value === undefined || value === '' ? fallback : value;
}

function firstSet(names: string[], fallback = ''): string {
    for (const name of names) {
        const value = str(name);
        if (value !== '') return value;
    }
    return fallback;
}

export function resolveToken(explicit?: string): string {
    return explicit ?? firstSet(['RA_API_TOKEN', 'AUTH_TOKEN']);
}

/**
 * Builds the WebdriverIO connection block for a RobotActions grid.
 *
 * Scheme and port are inferred rather than hardcoded: a local grid is plain
 * HTTP on `localhost:5555`, while the public endpoint is HTTPS on 443. A config
 * that hardcodes `protocol: 'http'` and is then pointed at the public host
 * sends cleartext to a TLS listener and fails with an opaque connection error.
 */
export function gridConnection(options: RobotActionsOptions = {}): GridConnection {
    const raw = options.url ?? firstSet(['RA_GRID_URL', 'GRID_URL', 'GRID_HOST'], 'localhost:5555');

    // An explicit override always wins over inference.
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

    const portEnv = parseInt(str('GRID_PORT', ''), 10);
    const port = portFromHost
        ? parseInt(portFromHost, 10)
        : Number.isNaN(portEnv)
          ? protocol === 'https' || !loopback
              ? 443
              : 5555
          : portEnv;

    if (!protocol) {
        // A bare host: loopback stays HTTP, anything else is assumed to be the
        // public TLS endpoint (and port 443 settles it either way).
        protocol = loopback && port !== 443 ? 'http' : 'https';
    }

    const token = resolveToken(options.token);
    const usePathAuth = options.auth === 'path' && token !== '';

    return {
        protocol,
        hostname,
        port,
        path: usePathAuth ? `/t/${token}/` : '/',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    };
}
