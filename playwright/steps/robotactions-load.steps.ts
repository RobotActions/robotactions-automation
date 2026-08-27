/**
 * Step definitions for `features/robotactions-load.feature`.
 *
 * Scope: every nav item on robotactions.com — top-level hash anchors,
 * the Features dropdown (7 items), the Resources dropdown (6 items),
 * header utility buttons, negative cases, deep-link subpages, and the
 * cross-cutting cycle scenario the load runner picks up.
 *
 * Locator strategy follows the playwright-bdd skill:
 *   1. getByRole(role, { name }) wherever possible
 *   2. getByText(text, { exact: true }) for unique visible text
 *   3. Scoped CSS only as fallback (the marketing site has no test-ids)
 */
import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';
import type { DataTable } from 'playwright-bdd';

// ── Hero + primary CTAs ────────────────────────────────────────────

// The hero H1 rotates through 3 phrases on ~20s cycle.
// Assert it is non-empty rather than matching a fixed string.
Then('the hero heading should contain one of the known phrases', async ({ page }) => {
  const heading = page.getByRole('heading', { level: 1 }).first();
  await expect(heading).toBeVisible({ timeout: 10_000 });
  const text = (await heading.textContent()) ?? '';
  expect(text.trim().length, 'hero H1 must not be empty').toBeGreaterThan(3);
});

// The stable hero tagline is "No credit card required" — always present
// in the hero regardless of which H1 phrase is currently displayed.
Then('the stable hero tagline should be visible', async ({ page }) => {
  const hero = page.locator('#hero');
  await expect(
    hero.getByText('No credit card required', { exact: false }),
  ).toBeVisible({ timeout: 10_000 });
});

// The hero H1 rotates through 3 phrases on ~20s cycle — assert existence
// and non-empty text rather than a fixed string.
Then('a hero heading should be visible with non-empty text', async ({ page }) => {
  const heading = page.getByRole('heading', { level: 1 }).first();
  await expect(heading).toBeVisible({ timeout: 10_000 });
  const text = (await heading.textContent()) ?? '';
  expect(text.trim().length, 'hero H1 must not be empty').toBeGreaterThan(3);
});

// The hero tagline is stable across all three H1 rotations.
Then('the hero tagline should contain {string}', async ({ page }, fragment: string) => {
  const hero = page.locator('#hero');
  await expect(hero.getByText(fragment, { exact: false })).toBeVisible({ timeout: 10_000 });
});

Then('I should see the {string} button', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: label }).first()).toBeVisible();
});

Then('I should see the heading {string}', async ({ page }, label: string) => {
  await expect(
    page.getByRole('heading', { name: label, exact: false }).first(),
  ).toBeVisible({ timeout: 10_000 });
});

// ── FAQ questions ──────────────────────────────────────────────────
Then('I should see the FAQ question {string}', async ({ page }, question: string) => {
  const faq = page.locator('#faq');
  await expect(faq.getByText(question, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
});

// ── Top-level nav anchors ──────────────────────────────────────────
When('I click the {string} nav link', async ({ page }, label: string) => {
  // Nav links may overlap names with footer/CTAs — scope to <nav> first.
  await page.locator('nav').first().getByRole('link', { name: label, exact: true }).click();
});

Then('the URL fragment should be {string}', async ({ page }, fragment: string) => {
  await page.waitForURL(new RegExp(`${fragment.replace('#', '\\#')}$`), { timeout: 5_000 });
});

Then('the section with id {string} should be in viewport', async ({ page }, id: string) => {
  const section = page.locator(`#${id}`).first();
  await expect(section).toBeVisible();
  // Smooth-scroll on the marketing site can take 600-1200ms after the click.
  // Poll the rect until ANY part of the section is inside the viewport,
  // or 5s passes — matches what the user would see after the scroll completes.
  await expect.poll(
    async () =>
      section.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const h = (globalThis as { innerHeight?: number }).innerHeight ?? 0;
        return r.top < h && r.bottom > 0;
      }),
    { timeout: 5_000, message: `section #${id} never entered viewport` },
  ).toBe(true);
});

// ── Dropdowns ───────────────────────────────────────────────────────
When('I click the {string} nav button', async ({ page }, label: string) => {
  await page.locator('nav').first().getByRole('button', { name: label, exact: true }).click();
});

When('I click the {string} button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label, exact: true }).first().click();
  // Special-case: the "Toggle theme" button opens a menu (Light/Dark/System)
  // rather than flipping the theme directly — verified via DOM snapshot
  // 2026-06-05. Pick the menu item that's the opposite of the current
  // theme so the next "page theme should have changed" assertion has
  // a real state change to observe.
  if (label === 'Toggle theme') {
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    const target = isDark ? 'Light' : 'Dark';
    await page.getByRole('menuitem', { name: target }).first().click();
  }
});

/**
 * Sentinel link that proves a dropdown panel is open.
 *
 * Verified against the live site 2026-08-05: the nav buttons are "Products"
 * and "Resources" — there is no "Features" button. Sentinels must appear ONLY
 * while the panel is open, which rules out "Integrations": that link also sits
 * in the footer, so it reads as visible with the dropdown shut and would let a
 * broken dropdown pass.
 */
const DROPDOWN_SENTINELS: Record<string, string> = {
  Products: 'AI Test Agent',
  Resources: 'Compare',
};

Then('the {word} dropdown should be visible', async ({ page }, dropdownName: string) => {
  // Each dropdown item is the first link to a known route from that menu —
  // assert at least one specific entry is visible to confirm the panel opened.
  const sentinel = DROPDOWN_SENTINELS[dropdownName];
  expect(sentinel, `unknown dropdown ${dropdownName}`).toBeDefined();
  await expect(page.getByRole('link', { name: sentinel, exact: false }).first())
    .toBeVisible({ timeout: 3_000 });
});

Then('the {word} dropdown should not be visible', async ({ page }, dropdownName: string) => {
  const sentinel = DROPDOWN_SENTINELS[dropdownName];
  expect(sentinel, `unknown dropdown ${dropdownName}`).toBeDefined();
  // The dropdown links are still in the DOM when closed (CSS hidden),
  // so we assert they are NOT visible (hidden/display:none).
  await expect(page.getByRole('link', { name: sentinel, exact: false }).first())
    .not.toBeVisible({ timeout: 3_000 });
});

Then(
  'the {word} dropdown should contain the items:',
  async ({ page }, _dropdownName: string, table: DataTable) => {
    // first row of the data table is the header — skip
    const labels = table.rows().map((r) => r[0]);
    for (const label of labels) {
      await expect(
        page.getByRole('link', { name: label, exact: false }).first(),
      ).toBeVisible({ timeout: 3_000 });
    }
  },
);

When('I click the {string} dropdown item', async ({ page }, label: string) => {
  await page.getByRole('link', { name: label, exact: false }).first().click();
});

// Every one of these routes answers 308 -> the same path WITH a trailing
// slash, so the pathname is `/careers` for one moment and `/careers/` the
// next. waitForURL resolves the instant its predicate matches, so a strict
// `=== path` was racing the redirect: it passed when Playwright happened to
// sample before the 308 landed and failed when it sampled after. Three of the
// six Resources rows failed per run, and not the same three.
//
// Normalise both sides so the assertion means "this route", not "this route
// caught at the right millisecond".
Then('the URL pathname should be {string}', async ({ page }, path: string) => {
  const norm = (p: string) => p.replace(/\/+$/, '') || '/';
  await page.waitForURL((url) => norm(new URL(url).pathname) === norm(path), { timeout: 8_000 });
});

Then('the SPA should hydrate without console errors', async ({ page, consoleErrors }) => {
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForFunction(() => document.readyState === 'complete');
  // Filter third-party tracker noise (same list as the smoke step).
  const ours = consoleErrors.filter((e) => {
    const s = e.toLowerCase();
    if (s.includes('cdn-cgi/rum')) return false;
    if (s.includes('calendly')) return false;
    if (s.includes('cloudflare')) return false;
    if (s.includes('zaraz')) return false;
    if (s.includes('hotjar')) return false;
    return true;
  });
  expect(ours, 'console errors after navigation:\n' + ours.join('\n')).toEqual([]);
});

// ── Header utility buttons ─────────────────────────────────────────
// Module-level variable to track initial theme across a single test's steps.
// playwright-bdd runs each scenario in a fresh worker context so no
// cross-test leakage occurs.
let initialTheme: 'light' | 'dark' | null = null;

Given('the page theme is {string} or {string}', async ({ page }, _a: string, _b: string) => {
  initialTheme = await page.evaluate(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );
});

When('I wait {int} milliseconds for the theme transition', async ({ page }, ms: number) => {
  await page.waitForTimeout(ms);
});

When('I wait {int} milliseconds for the theme to settle', async ({ page }, ms: number) => {
  await page.waitForTimeout(ms);
});

Then('the page theme should have changed', async ({ page }) => {
  const after = await page.evaluate(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );
  expect(after, 'theme should flip').not.toBe(initialTheme);
});

Then('the page theme should match the original', async ({ page }) => {
  const after = await page.evaluate(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );
  expect(after, 'theme should return to original after double toggle').toBe(initialTheme);
});

// Language switcher — the canonical selenium-java feature uses
// "a language selection menu should be visible".
Then('a language selection menu should be visible', async ({ page }) => {
  // The Radix DropdownMenu that opens has role="menu" but no aria-label on the
  // menu container itself. Assert that at least one menuitem (e.g. "English" or
  // "Français") is visible after the button click.
  const menu = page.getByRole('menu').first();
  await expect(menu).toBeVisible({ timeout: 3_000 });
  await expect(menu.getByRole('menuitem').first()).toBeVisible({ timeout: 3_000 });
});

// Kept for backwards compat with the existing playwright-only feature
Then('the language menu should show at least one language option', async ({ page }) => {
  const menu = page.getByRole('menu').first();
  await expect(menu).toBeVisible({ timeout: 3_000 });
  await expect(menu.getByRole('menuitem').first()).toBeVisible({ timeout: 3_000 });
});

Then('the {string} button should be visible and enabled', async ({ page }, label: string) => {
  const btn = page.getByRole('button', { name: label }).first();
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();
});

// ── Navigation to paths (negative + deep-link scenarios) ────────────
When('I navigate to path {string}', async ({ page }, path: string) => {
  await page.goto(path);
});

Then('the page title should contain {string}', async ({ page }, text: string) => {
  await expect(page).toHaveTitle(new RegExp(text, 'i'), { timeout: 10_000 });
});

// ── Cross-cutting cycle (used by the load runner's @health tag) ────
When('I cycle through every top-level nav item once', async ({ page }) => {
  // Anchor links only. "Products" and "Resources" are dropdown BUTTONS, not
  // links — clicking them by role=link never resolves and burns the full
  // action timeout (verified against the live site 2026-08-05).
  const navLabels = ['Home', 'Pricing', 'FAQ', 'Contact'];
  const navScope = page.locator('nav').first();
  for (const label of navLabels) {
    await navScope.getByRole('link', { name: label, exact: true }).click();
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  }
});

Then('the SPA should remain hydrated throughout the cycle', async ({ page }) => {
  // Final sanity: <main> still attached and visible after the cycle.
  await expect(page.locator('main').first()).toBeVisible();
});
