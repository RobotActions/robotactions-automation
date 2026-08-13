const { chromium } = require('playwright-core');
const tok = process.argv[2];
(async () => {
  const b = await chromium.connect({ wsEndpoint: `ws://localhost:5555/t/${tok}/playwright/chromium`, timeout: 60000 });
  const c = await b.newContext();
  console.log(new Date().toISOString(), 'ctx created — calling client tracing.start');
  try {
    await c.tracing.start({ screenshots: true, snapshots: true });
    console.log(new Date().toISOString(), 'tracing.start ok');
    const p = await c.newPage();
    await p.goto('data:text/html,<h1>trace test</h1>');
    await c.tracing.stop({ path: '/tmp/test-trace.zip' });
    console.log(new Date().toISOString(), 'tracing.stop ok');
  } catch (e) {
    console.log(new Date().toISOString(), 'TRACING FAILED:', e.message.split('\n')[0]);
  }
  await b.close();
})();
