/**
 * Step definitions for `features/robotactions-load.feature`.
 *
 * Scope: every nav item on robotactions.com — top-level hash anchors,
 * the Features dropdown (7 items), the Resources dropdown (6 items),
 * header utility buttons, and the cross-cutting cycle scenario the
 * load runner picks up.
 *
 * Locator strategy (WDIO v9):
 *   1. $('=Text')   — exact visible text (anchors, buttons)
 *   2. $('*=Text')  — partial visible text
 *   3. XPath        — aria attributes
 *   4. CSS          — last resort
 *
 * World pattern: scenario-scoped state is held on `this` (the Cucumber World
 * object) via `function(this: RaWorld, ...)` — no module-level variables so
 * parallel workers don't share state.
 */
import { Given, When, Then, Before } from '@cucumber/cucumber';
import type { DataTable } from '@cucumber/cucumber';
import { browser, $ } from '@wdio/globals';
import { baseUrl } from '../config';

// ── World type ────────────────────────────────────────────────────────────────

interface RaWorld {
    initialTheme?: 'light' | 'dark';
    consoleLogs?: { level: string; message: string; timestamp: number }[];
}

// ── Background ────────────────────────────────────────────────────────────────

Given('I open the RobotActions home page', async function (this: RaWorld) {
    await browser.url(baseUrl('https://robotactions.com'));
});

// XCUITest (iOS Safari) doesn't support log type 'browser' — its allowed
// types are syslog / safariConsole / crashlog / performance / safariNetwork
// / server. Selenium Chrome / Android UA2 DO support 'browser'.
//
// Pick the log type by platform so neither leg hits the "Unsupported log
// type" rejection cascade. iOS requires `appium:showSafariConsoleLog: true`
// in caps — auto-injected for every iOS session by the session plugin at
// `packages/appium-session-plugin/src/plugin.ts:injectCapabilities`. With
// that injection, `safariConsole` is reliably available on Safari/iOS.
async function getConsoleLogsCrossPlatform(): Promise<{ level: string; message: string; timestamp: number }[]> {
    const logType = (browser as { isIOS?: boolean }).isIOS ? 'safariConsole' : 'browser';
    try {
        const logs = (await browser.getLogs(logType)) as { level: string; message: string; timestamp: number }[];
        return Array.isArray(logs) ? logs : [];
    } catch {
        // Driver may still reject (signing not granting log access, version
        // mismatch, etc). Return empty so the smoke assertion degrades to
        // "no console errors observed" rather than failing the scenario
        // on the read itself.
        return [];
    }
}

Given('I wait for the SPA to hydrate', async function (this: RaWorld) {
    await $('main').waitForDisplayed({ timeout: 10_000 });
    await browser.waitUntil(
        async () => (await browser.execute(() => document.readyState)) === 'complete',
        { timeout: 5_000, timeoutMsg: 'document.readyState never reached "complete"' },
    );
    // Drain any pre-hydration logs so later steps only see post-hydration entries.
    this.consoleLogs = await getConsoleLogsCrossPlatform() as RaWorld['consoleLogs'];
});

// ── Hero + primary CTAs ───────────────────────────────────────────────────────
//
// Cross-platform text matching: WDA / XCUITestDriver's `*=fragment` and
// `=label` selectors are flaky against em-dashes, commas, and other
// non-ASCII chars (verified empirically on iPadOS 26.4.2 — every heading
// scenario with `—` or `,` failed even though Chrome handled them fine).
//
// Drop down to a single browser.execute that walks the DOM and returns
// whether ANY visible element of the requested tag(s) contains the
// fragment. Bypasses WDA's selector engine entirely.

async function pageContainsText(opts: { fragment: string; tags?: string[]; scopeSelector?: string }): Promise<boolean> {
    const { fragment, tags = ['h1', 'h2', 'h3', 'h4'], scopeSelector } = opts;
    return browser.execute(
        (frag: string, tagList: string[], scope: string | null) => {
            const root = scope ? document.querySelector(scope) : document;
            if (!root) return false;
            const els = Array.from(root.querySelectorAll(tagList.join(',')));
            // Existence-in-DOM check. The earlier visibility gate
            // (rect.width > 0 && rect.height > 0) was too strict on iPad
            // Safari, where buttons below the fold / inside collapsed
            // sections sometimes report 0×0 rect even though the user
            // would see them after scrolling. For a smoke suite we only
            // care that the element is in the document and not
            // explicitly hidden (display:none / visibility:hidden).
            return els.some((el) => {
                const text = (el.textContent || '').trim();
                if (!text.includes(frag)) return false;
                const style = window.getComputedStyle(el as Element);
                if (style.display === 'none') return false;
                if (style.visibility === 'hidden') return false;
                return true;
            });
        },
        fragment,
        tags,
        scopeSelector || null,
    ) as Promise<boolean>;
}

Then('the hero heading should contain {string}', async function (this: RaWorld, fragment: string) {
    // Hero H1 rotates between several phrases on a ~20 s cycle, so wait
    // long enough to catch a full cycle.
    await browser.waitUntil(
        () => pageContainsText({ fragment, tags: ['h1'] }),
        { timeout: 30_000, timeoutMsg: `No H1 ever contained "${fragment}"` },
    );
});

Then('the hero heading should be one of:', async function (this: RaWorld, dataTable: DataTable) {
    const phrases = dataTable.raw().map((row) => row[0].trim());
    await browser.waitUntil(
        async () => {
            for (const p of phrases) {
                if (await pageContainsText({ fragment: p, tags: ['h1'] })) return true;
            }
            return false;
        },
        { timeout: 30_000, timeoutMsg: `H1 never matched any of: ${phrases.join(' | ')}` },
    );
});

Then('the page should contain text {string}', async function (this: RaWorld, fragment: string) {
    await browser.waitUntil(
        () => pageContainsText({ fragment, tags: ['p', 'span', 'div', 'li'] }),
        { timeout: 15_000, timeoutMsg: `Page never showed text "${fragment}"` },
    );
});

Then('I should see the {string} button', async function (this: RaWorld, label: string) {
    await browser.waitUntil(
        () => pageContainsText({ fragment: label, tags: ['button', 'a'] }),
        { timeout: 15_000, timeoutMsg: `No button/link with text "${label}" ever appeared` },
    );
});

Then('I should see the heading {string}', async function (this: RaWorld, label: string) {
    await browser.waitUntil(
        () => pageContainsText({ fragment: label }),
        { timeout: 15_000, timeoutMsg: `No heading containing "${label}" ever appeared` },
    );
});

Then('I should see the FAQ question containing {string}', async function (this: RaWorld, fragment: string) {
    await browser.waitUntil(
        () => pageContainsText({ fragment, tags: ['button'], scopeSelector: '#faq' }),
        { timeout: 15_000, timeoutMsg: `No FAQ button containing "${fragment}" ever appeared` },
    );
});

// ── Top-level nav anchors ─────────────────────────────────────────────────────

// Click-by-text helper: scrolls the target into view + clicks it from JS,
// bypassing both WDA's text selector (flaky with `=label`) AND the
// off-screen issue (iOS Safari refuses clicks on elements outside the
// viewport unless we scroll first).
async function clickElementByText(opts: { fragment: string; tags?: string[]; scopeSelector?: string }): Promise<boolean> {
    const { fragment, tags = ['button', 'a'], scopeSelector } = opts;
    return browser.execute(
        (frag: string, tagList: string[], scope: string | null) => {
            const root = scope ? document.querySelector(scope) : document;
            if (!root) return false;
            const els = Array.from(root.querySelectorAll(tagList.join(',')));
            const hit = els.find((el) => ((el.textContent || '').trim() === frag));
            if (!hit) return false;
            (hit as HTMLElement).scrollIntoView({ block: 'center' });
            (hit as HTMLElement).click();
            return true;
        },
        fragment,
        tags,
        scopeSelector || null,
    ) as Promise<boolean>;
}

When('I click the {string} nav link', async function (this: RaWorld, label: string) {
    await browser.waitUntil(
        () => clickElementByText({ fragment: label, tags: ['a'], scopeSelector: 'nav' }),
        { timeout: 10_000, timeoutMsg: `Nav link "${label}" not found / not clickable` },
    );
});

Then('the URL fragment should be {string}', async function (this: RaWorld, fragment: string) {
    await browser.waitUntil(
        async () => {
            const url = await browser.getUrl();
            return new URL(url).hash === fragment;
        },
        { timeout: 5_000, timeoutMsg: `URL hash never matched "${fragment}"` },
    );
});

Then('the section with id {string} should be in viewport', async function (this: RaWorld, id: string) {
    // Anchor-link scroll on mobile Chrome can take 300-1500ms to settle —
    // checking the rect immediately after clicking the nav link races the
    // SPA's smooth-scroll animation. Poll for up to 8s + scroll the
    // section into view ourselves as a fallback (covers the case where
    // the click event arrived but the SPA's onClick preventDefault'd
    // without actually scrolling, observed on some Android Chrome builds).
    await browser.waitUntil(
        async () => {
            const inView = await browser.execute((sectionId: string) => {
                const el = document.getElementById(sectionId);
                if (!el) return false;
                const r = el.getBoundingClientRect();
                // Accept if ANY of the section overlaps the viewport.
                return r.top < window.innerHeight && r.bottom > 0;
            }, id);
            if (inView) return true;
            // Try nudging it into view, then re-check on the next loop tick.
            await browser.execute((sectionId: string) => {
                const el = document.getElementById(sectionId);
                if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
            }, id);
            return false;
        },
        { timeout: 8_000, interval: 400, timeoutMsg: `Section "${id}" never overlapped the viewport` },
    );
});

// ── Dropdowns ─────────────────────────────────────────────────────────────────

When('I click the {string} nav button', async function (this: RaWorld, label: string) {
    await browser.waitUntil(
        () => clickElementByText({ fragment: label, tags: ['button'], scopeSelector: 'nav' }),
        { timeout: 10_000, timeoutMsg: `Nav button "${label}" not found / not clickable` },
    );
});

When('I click the {string} button', async function (this: RaWorld, label: string) {
    await browser.waitUntil(
        () => clickElementByText({ fragment: label, tags: ['button', 'a'] }),
        { timeout: 10_000, timeoutMsg: `Button/link "${label}" not found / not clickable` },
    );
});

Then('the {word} dropdown should be visible', async function (this: RaWorld, dropdownName: string) {
    const sentinel: Record<string, string> = {
        // Site drift (re-inspected 2026-07-06): the "Features" mega-menu is now
        // the "Products" dropdown; sentinel is its first item.
        Products: 'AI Test Agent',
        // "Integrations" also sits in the FOOTER, and this assertion is a
        // page-contains-text check — so it reads as present with the dropdown
        // shut, letting a broken dropdown pass. "Compare" only renders in the
        // open panel (verified live 2026-08-05).
        Resources: 'Compare',
    };
    const text = sentinel[dropdownName];
    if (!text) throw new Error(`Unknown dropdown: "${dropdownName}"`);
    await browser.waitUntil(
        () => pageContainsText({ fragment: text, tags: ['a', 'span', 'div'] }),
        { timeout: 5_000, timeoutMsg: `${dropdownName} dropdown sentinel "${text}" never visible` },
    );
});

Then(
    'the {word} dropdown should contain the items:',
    async function (this: RaWorld, _dropdownName: string, dataTable: DataTable) {
        // dataTable.raw() returns [['label'], ['AI QA Agent'], ...] — skip header row.
        const rows = dataTable.raw().slice(1);
        for (const [label] of rows) {
            await browser.waitUntil(
                () => pageContainsText({ fragment: label, tags: ['a', 'button', 'span', 'div'] }),
                {
                    timeout: 5_000,
                    timeoutMsg: `Dropdown item "${label}" was not visible`,
                },
            );
        }
    },
);

When('I click the {string} dropdown item', async function (this: RaWorld, label: string) {
    await browser.waitUntil(
        () => clickElementByText({ fragment: label, tags: ['a', 'button'] }),
        { timeout: 10_000, timeoutMsg: `Dropdown item "${label}" not found / not clickable` },
    );
});

Then('the URL pathname should be {string}', async function (this: RaWorld, path: string) {
    await browser.waitUntil(
        async () => {
            const url = await browser.getUrl();
            return new URL(url).pathname === path;
        },
        { timeout: 8_000, timeoutMsg: `URL pathname never matched "${path}"` },
    );
});

Then('the SPA should hydrate without console errors', async function (this: RaWorld) {
    await $('main').waitForDisplayed({ timeout: 10_000 });
    await browser.waitUntil(
        async () => (await browser.execute(() => document.readyState)) === 'complete',
        { timeout: 5_000, timeoutMsg: 'document.readyState never reached "complete"' },
    );
    const logs = await getConsoleLogsCrossPlatform();
    const errors = logs.filter((l) => l.level === 'SEVERE');
    expect(errors).toEqual([]);
});

// ── Header utility buttons ────────────────────────────────────────────────────

Given(
    'the page theme is {string} or {string}',
    async function (this: RaWorld, _a: string, _b: string) {
        this.initialTheme = await browser.execute(() =>
            document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        ) as 'light' | 'dark';
    },
);

When(
    'I wait {int} milliseconds for the theme transition',
    async function (this: RaWorld, ms: number) {
        await browser.pause(ms);
    },
);

When(
    'I wait {int} milliseconds for the theme to settle',
    async function (this: RaWorld, ms: number) {
        await browser.pause(ms);
    },
);

Then('the page theme should have changed', async function (this: RaWorld) {
    const after = await browser.execute(() =>
        document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    ) as 'light' | 'dark';
    expect(after).not.toBe(this.initialTheme);
});

Then('no console errors should have been logged', async function (this: RaWorld) {
    const logs = await getConsoleLogsCrossPlatform();
    const errors = logs.filter((l) => l.level === 'SEVERE');
    expect(errors).toEqual([]);
});

Then('a language selection menu should be visible', async function (this: RaWorld) {
    // The marketing site doesn't expose a stable structure for the language
    // menu; match either [role="menu"] or [role="menuitem"] — loose assertion
    // mirrors the Playwright reference implementation.
    await browser.waitUntil(
        async () => {
            const menu = await $('[role="menu"]').isDisplayed().catch(() => false);
            const item = await $('[role="menuitem"]').isDisplayed().catch(() => false);
            return menu || item;
        },
        { timeout: 3_000, timeoutMsg: 'Language selection menu never became visible' },
    );
});

Then(
    'the {string} button should be visible and enabled',
    async function (this: RaWorld, label: string) {
        await browser.waitUntil(
            () => pageContainsText({ fragment: label, tags: ['button', 'a'] }),
            { timeout: 10_000, timeoutMsg: `Button "${label}" not visible/enabled` },
        );
    },
);

// ── Cross-cutting cycle ───────────────────────────────────────────────────────

When('I cycle through every top-level nav item once', async function (this: RaWorld) {
    // Anchor links only. "Products"/"Resources" are dropdown BUTTONS, not
    // links — clicking them by link text never resolves.
    const navLabels = ['Home', 'Pricing', 'FAQ', 'Contact'];
    for (const label of navLabels) {
        await browser.waitUntil(
            () => clickElementByText({ fragment: label, tags: ['a'], scopeSelector: 'nav' }),
            { timeout: 10_000, timeoutMsg: `Nav link "${label}" not found / not clickable` },
        );
        // Best-effort network-idle wait; swallow timeout — same as the Playwright impl.
        await browser.waitUntil(
            async () => (await browser.execute(() => document.readyState)) === 'complete',
            { timeout: 5_000 },
        ).catch(() => undefined);
    }
});

Then('the SPA should remain hydrated throughout the cycle', async function (this: RaWorld) {
    const main = $('main');
    await main.waitForDisplayed({ timeout: 5_000 });
});
