/**
 * Exercises the WebdriverIO + Appium ingress paths for the test-metadata
 * fields that the appium-grid-service dashboard uses to sort + group sessions:
 *
 *   test_name   ← ra:testName cap  / ra:job-name=<name> magic   / REST testName
 *   test_suite  ← ra:testsuite cap / ra:testsuite=<v> magic     / REST testSuite
 *   test_id     ← ra:testId cap    / ra:test-id=<v> magic       / REST testId
 *   release_id  ← ra:releaseId cap / ra:release-id=<v> magic    / REST releaseId
 *
 * Run:
 *   GRID_HOST=localhost:5555 \
 *   AUTH_TOKEN=<your-jwt> \
 *   BROADCASTER_URL=http://localhost:3001 \
 *   PLATFORM=android \
 *   DEVICE_UDID=emulator-5554 \
 *   APP_PACKAGE=com.example.app \
 *   APP_ACTIVITY=.MainActivity \
 *   npx mocha test/specs/ra_test_metadata.spec.ts --config wdio.mocha.conf.ts
 */
import { remote, Browser } from 'webdriverio';
import { expect } from 'chai';

const GRID_HOST = process.env.GRID_HOST || 'localhost:5555';
const BROADCASTER_URL = process.env.BROADCASTER_URL || 'http://localhost:3001';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const PLATFORM = (process.env.PLATFORM || 'android').toLowerCase();

interface SessionRow {
  id: string;
  testName: string | null;
  testSuite: string | null;
  testId: string | null;
  releaseId: string | null;
  result: string | null;
  resultMessage: string | null;
}

function baseCapabilities(): Record<string, unknown> {
  if (PLATFORM === 'ios') {
    return {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': process.env.DEVICE_UDID || 'iPhone Simulator',
      'appium:udid': process.env.DEVICE_UDID || '',
      'appium:bundleId': process.env.BUNDLE_ID || 'com.example.app',
      'appium:noReset': true,
      'appium:newCommandTimeout': 120,
    };
  }
  return {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.DEVICE_UDID || 'emulator-5554',
    'appium:udid': process.env.DEVICE_UDID || 'emulator-5554',
    'appium:appPackage': process.env.APP_PACKAGE || 'com.example.app',
    'appium:appActivity': process.env.APP_ACTIVITY || '.MainActivity',
    'appium:noReset': true,
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 120,
  };
}

async function newSession(extraCaps: Record<string, unknown> = {}): Promise<Browser> {
  const [hostname, portStr] = GRID_HOST.split(':');
  // Path-prefix auth — same /t/<token> pattern Selenium uses against this proxy.
  const path = AUTH_TOKEN ? `/t/${AUTH_TOKEN}` : '/';
  return remote({
    protocol: 'http',
    hostname,
    port: parseInt(portStr || '5555', 10),
    path,
    logLevel: 'warn',
    capabilities: { ...baseCapabilities(), ...extraCaps },
  });
}

async function fetchSessionRow(sessionId: string): Promise<SessionRow> {
  const resp = await fetch(`${BROADCASTER_URL}/api/sessions?limit=200`, {
    headers: AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {},
  });
  const payload = await resp.json();
  const rows: SessionRow[] = Array.isArray(payload) ? payload : payload.sessions || [];
  const row = rows.find(r => r.id === sessionId);
  if (!row) throw new Error(`session ${sessionId} not found`);
  return row;
}

const settle = () => new Promise(r => setTimeout(r, 300));

// ─────────────────────────────────────────────────────────────────────
// Path 1 — W3C capabilities at createSession. Dashboard shows metadata
// from the very first frame, before the test code runs.
// ─────────────────────────────────────────────────────────────────────
describe('ra:test* via createSession capabilities (Appium)', () => {
  it('all four fields land via caps', async () => {
    const driver = await newSession({
      'ra:testName': 'Appium — login flow',
      'ra:testsuite': 'Mobile smoke 1234',
      'ra:testId': 'MOB-5678',
      'ra:releaseId': 'v2.3.1-mobile',
    });
    const sid = driver.sessionId;
    try {
      await settle();
      const row = await fetchSessionRow(sid);
      expect(row.testName).to.equal('Appium — login flow');
      expect(row.testSuite).to.equal('Mobile smoke 1234');
      expect(row.testId).to.equal('MOB-5678');
      expect(row.releaseId).to.equal('v2.3.1-mobile');
    } finally {
      await driver.deleteSession();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Path 2 — ra:setTestStatus structured form. Atomic — all four fields in
// one round-trip. Use this when the test body decides the values.
// ─────────────────────────────────────────────────────────────────────
describe('ra:setTestStatus structured form (Appium)', () => {
  it('sets result + all four metadata fields', async () => {
    const driver = await newSession();
    const sid = driver.sessionId;
    try {
      await driver.executeScript('ra:setTestStatus', [{
        status: 'passed',
        testName: 'Appium structured form test',
        testSuite: 'Mobile nightly 4781',
        testId: 'JIRA-9012',
        releaseId: 'v2.4.0-mobile',
      }]);
      await settle();
      const row = await fetchSessionRow(sid);
      expect(row.result).to.equal('passed');
      expect(row.testName).to.equal('Appium structured form test');
      expect(row.testSuite).to.equal('Mobile nightly 4781');
      expect(row.testId).to.equal('JIRA-9012');
      expect(row.releaseId).to.equal('v2.4.0-mobile');
    } finally {
      await driver.deleteSession();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Path 3 — key=value magic verbs. Each verb updates one field. Useful for
// staged setups where each field becomes known at a different point.
// ─────────────────────────────────────────────────────────────────────
describe('ra:* key=value magic verbs (Appium)', () => {
  it('individual verbs update each field', async () => {
    const driver = await newSession();
    const sid = driver.sessionId;
    try {
      await driver.executeScript('ra:job-name=Appium magic — checkout', []);
      await driver.executeScript('ra:testsuite=Mobile build 4782', []);
      await driver.executeScript('ra:test-id=MOB-7777', []);
      await driver.executeScript('ra:release-id=v2.4.0-mobile', []);
      await settle();
      const row = await fetchSessionRow(sid);
      expect(row.testName).to.equal('Appium magic — checkout');
      expect(row.testSuite).to.equal('Mobile build 4782');
      expect(row.testId).to.equal('MOB-7777');
      expect(row.releaseId).to.equal('v2.4.0-mobile');
    } finally {
      await driver.deleteSession();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Path 4 — REST POST after the test ends. For test frameworks where
// pass/fail is only known at teardown.
// ─────────────────────────────────────────────────────────────────────
describe('REST POST /api/sessions/:id/result (Appium)', () => {
  it('sets all metadata + result via REST', async () => {
    const driver = await newSession();
    const sid = driver.sessionId;
    try {
      const resp = await fetch(`${BROADCASTER_URL}/api/sessions/${sid}/result`, {
        method: 'POST',
        headers: {
          ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'failed',
          reason: 'NoSuchElementException on login button',
          testName: 'Appium REST teardown',
          testSuite: 'Mobile smoke 1234',
          testId: 'MOB-9999',
          releaseId: 'v2.3.1-mobile',
        }),
      });
      expect(resp.ok).to.be.true;
      await settle();
      const row = await fetchSessionRow(sid);
      expect(row.result).to.equal('failed');
      expect(row.testName).to.equal('Appium REST teardown');
      expect(row.testSuite).to.equal('Mobile smoke 1234');
      expect(row.testId).to.equal('MOB-9999');
      expect(row.releaseId).to.equal('v2.3.1-mobile');
    } finally {
      await driver.deleteSession();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Production-shape pattern — beforeEach tags with metadata derived from
// the Mocha test context, afterEach reports pass/fail. Mirror this in your
// project's spec base class so every test is tagged automatically.
// ─────────────────────────────────────────────────────────────────────
describe('Production pattern — tagged + reported in hooks', () => {
  let driver: Browser;
  beforeEach(async function () {
    driver = await newSession({
      'ra:testName': this.currentTest?.title,
      'ra:testsuite': this.currentTest?.parent?.title,
      'ra:releaseId': process.env.CI_BUILD_VERSION || 'local-dev',
      // testId from a custom convention — read from a mocha context decoration
      // like `(this.currentTest as any).jiraId = 'MOB-1234'` set in the test.
      ...((this.currentTest as { jiraId?: string })?.jiraId
        ? { 'ra:testId': (this.currentTest as { jiraId?: string }).jiraId }
        : {}),
    });
  });

  afterEach(async function () {
    if (this.currentTest?.state === 'passed') {
      await driver.executeScript('ra:job-result=passed', []);
    } else {
      const err = (this.currentTest as { err?: Error })?.err?.message || 'unknown failure';
      await driver.executeScript(`ra:job-result=failed:${err.slice(0, 256)}`, []);
    }
    await driver.deleteSession();
  });

  it('demo — automatically tagged and reported', async function () {
    // Tag this test's external id inline so the beforeEach picks it up.
    (this.test as { jiraId?: string }).jiraId = 'DEMO-1234';
    // Re-create the session so the inline jiraId applies (or set it before this `it`).
    expect(driver.sessionId).to.exist;
  });
});
