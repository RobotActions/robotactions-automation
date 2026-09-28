/**
 * Grid result reporting shared by wdio.conf.ts (Cucumber) and
 * wdio.mocha.conf.ts (Mocha) — the only two files that talk to `process.env`
 * for reporting, mirroring the single-reader pattern the `wdio` template uses
 * in its `config.ts`.
 *
 * WDIO opens ONE session per worker, and a worker runs every test in the
 * spec file(s) it's handed inside that one session — so the verdict is
 * tracked across the whole worker and reported ONCE, from the `after` hook
 * (the one lifecycle hook every framework calls), rather than after each
 * individual test. First failure wins: a later passing test must never erase
 * an earlier failure, which calling `ra:job-result` after every test would do
 * by last-write-wins.
 */
import 'dotenv/config';

/** Suite label persisted by the grid as `sessions.test_suite`. */
export function suiteName(fallback = 'appium-js'): string {
    return process.env.RA_TESTSUITE || fallback;
}

/**
 * First line of an error, whitespace collapsed, for `ra:job-result=failed:<reason>`.
 *
 * MUST be a single line — the reason is interpolated into a magic string the
 * grid proxy matches with an anchored pattern, and a raw multi-line message
 * (e.g. a stack trace) used to fall through the match, get forwarded to the
 * browser as literal JavaScript, and lose the verdict entirely. A stack
 * trace's first line is the message, so taking it loses nothing.
 */
export function errorText(error: unknown): string {
    const raw = !error
        ? ''
        : typeof error === 'string'
            ? error
            : typeof (error as { message?: unknown }).message === 'string'
                ? (error as { message: string }).message
                : '';
    const firstLine = raw.split('\n')[0].replace(/\s+/g, ' ').trim();
    return firstLine || 'test failed';
}

/** Sets the CURRENT test's name via the `ra:job-name` magic verb. Best-effort. */
export async function reportTestName(name: string): Promise<void> {
    const trimmed = name.slice(0, 200);
    try {
        await (globalThis as { browser?: { execute: (script: string) => Promise<unknown> } }).browser?.execute(
            `ra:job-name=${trimmed}`,
        );
    } catch (err) {
        console.warn('[ra-report] failed to report test name:', (err as Error)?.message ?? err);
    }
}

/**
 * Aggregates pass/fail across every test run by this worker and reports it
 * once via `ra:job-result`. Create one per config (module scope — each WDIO
 * worker is its own process, so this never leaks across workers).
 */
export function createResultTracker() {
    let failureCount = 0;
    let firstFailure = '';

    return {
        /** Call from afterTest / afterScenario with that test's outcome. */
        record(passed: boolean, error?: unknown): void {
            if (passed) return;
            failureCount += 1;
            if (!firstFailure) firstFailure = errorText(error);
        },
        /** Call once from the worker-level `after` hook. Never throws. */
        async report(): Promise<void> {
            const verb =
                failureCount === 0
                    ? 'ra:job-result=passed'
                    : `ra:job-result=failed:${(
                          failureCount > 1 ? `${failureCount} failed. First: ${firstFailure}` : firstFailure
                      ).slice(0, 200)}`;
            try {
                await (globalThis as { browser?: { execute: (script: string) => Promise<unknown> } }).browser?.execute(
                    verb,
                );
            } catch (err) {
                console.warn('[ra-report] failed to report test result:', (err as Error)?.message ?? err);
            }
        },
    };
}
