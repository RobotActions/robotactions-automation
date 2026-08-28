import { gridConnection, resolveToken, type GridConnection, type RobotActionsOptions } from './connection';

export { gridConnection, resolveToken };
export type { GridConnection, RobotActionsOptions };

/** A capability bag. Loose by design — users bring their own `appium:` keys. */
type Capability = Record<string, unknown>;
type Capabilities = Capability | Capability[];

/** Only the config fields this service writes. */
interface MutableConfig extends Partial<GridConnection> {
    [key: string]: unknown;
}

function eachCapability(capabilities: Capabilities, visit: (cap: Capability) => void): void {
    if (Array.isArray(capabilities)) {
        for (const cap of capabilities) {
            // Multiremote entries nest the real caps one level down.
            const nested = (cap as { capabilities?: Capability }).capabilities;
            visit(nested && typeof nested === 'object' ? nested : cap);
        }
        return;
    }
    if (capabilities && typeof capabilities === 'object') {
        for (const entry of Object.values(capabilities as Record<string, Capability>)) {
            const nested = (entry as { capabilities?: Capability }).capabilities;
            visit(nested && typeof nested === 'object' ? nested : entry);
        }
    }
}

/** Applies the `ra:` labels, never overwriting what the user set explicitly. */
function applyLabels(capabilities: Capabilities, options: RobotActionsOptions): void {
    const testSuite = options.testSuite ?? process.env.RA_TESTSUITE;
    const releaseId = options.releaseId ?? process.env.RA_RELEASE_ID;

    eachCapability(capabilities, (cap) => {
        if (testSuite && cap['ra:testsuite'] === undefined) cap['ra:testsuite'] = testSuite;
        if (releaseId && cap['ra:releaseId'] === undefined) cap['ra:releaseId'] = releaseId;
    });
}

/**
 * Launcher — runs once, before any worker starts.
 *
 * The connection has to be written here rather than in the worker service:
 * `protocol`/`hostname`/`port`/`path`/`headers` are read when the session is
 * created, so a service that set them later would be too late to matter.
 */
export class launcher {
    private readonly options: RobotActionsOptions;

    constructor(options: RobotActionsOptions = {}) {
        this.options = options;
    }

    onPrepare(config: MutableConfig, capabilities: Capabilities): void {
        Object.assign(config, gridConnection(this.options));
        applyLabels(capabilities, this.options);

        if (!resolveToken(this.options.token)) {
            console.warn(
                '[robotactions] No API token found. Set RA_API_TOKEN (or pass `token`) ' +
                    'or the grid will reject the session with 401.',
            );
        }
    }
}

/**
 * Worker service — reports each test outcome back to the grid.
 *
 * Without this, every session lands in the dashboard as "completed" regardless
 * of whether the test passed, because the grid only sees WebDriver traffic and
 * cannot know what the assertions decided.
 */
export default class RobotActionsService {
    private readonly options: RobotActionsOptions;
    private failureReason = '';

    constructor(options: RobotActionsOptions = {}) {
        this.options = options;
    }

    /** Belt-and-braces: workers receive their own config copy. */
    beforeSession(config: MutableConfig, capabilities: Capabilities): void {
        if (!config.hostname) Object.assign(config, gridConnection(this.options));
        applyLabels(capabilities, this.options);
    }

    /** Mocha / Jasmine. */
    afterTest(_test: unknown, _context: unknown, result: { passed?: boolean; error?: { message?: string } }): void {
        if (result?.passed === false) {
            this.failureReason = result.error?.message ?? 'Test failed';
        }
    }

    /** Cucumber. `result.passed` is absent, so read the status instead. */
    afterScenario(_world: unknown, result: { passed?: boolean; error?: string }): void {
        if (result?.passed === false) {
            this.failureReason = result.error ?? 'Scenario failed';
        }
    }

    async after(): Promise<void> {
        const status = this.failureReason ? 'failed' : 'passed';
        const reason = this.failureReason || 'All tests passed';

        try {
            await (globalThis as { browser?: { execute: (script: string, arg: unknown) => Promise<unknown> } })
                .browser?.execute('ra:setTestStatus', { status, reason });
        } catch (error) {
            // Reporting is best-effort: a grid that has already torn the session
            // down must not turn a green suite red.
            console.warn(`[robotactions] Could not report test status: ${(error as Error).message}`);
        }
    }
}
