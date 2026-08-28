# wdio-robotactions-service

WebdriverIO service for the [RobotActions](https://robotactions.com) grid — real
Android and iOS devices plus elastic browser nodes behind a single WebDriver
endpoint.

It does two things an existing suite would otherwise hand-roll:

- **Connects.** Resolves protocol, host, port and token auth from the environment,
  so pointing a suite at the grid is one line rather than an edit to every
  `wdio.*.conf.ts`.
- **Reports outcomes.** Marks each session `passed` or `failed` in the dashboard.
  Without it the grid only sees WebDriver traffic, so every run shows as
  "completed" no matter what the assertions decided.

## Install

```sh
npm install --save-dev wdio-robotactions-service
```

## Use

```ts
// wdio.conf.ts
export const config: WebdriverIO.Config = {
    services: ['robotactions'],
    capabilities: [{ browserName: 'chrome' }],
    // ...
};
```

```sh
# .env
RA_API_TOKEN=your-token
RA_GRID_URL=grid.robotactions.com
```

That's the whole setup. Capabilities stay ordinary WebdriverIO capabilities.

### Real devices

Mobile is the same connection with mobile capabilities:

```ts
capabilities: [{
    platformName: 'Android',
    'appium:browserName': 'chrome',
}],
```

Leave the device unpinned and the grid distributes across whatever is free.

### Options

Pass options instead of environment variables if you prefer:

```ts
services: [['robotactions', {
    token: process.env.MY_TOKEN,
    url: 'grid.robotactions.com',
    testSuite: 'Checkout regression',
    releaseId: '2026.09.1',
}]],
```

| Option | Environment | Default |
|---|---|---|
| `token` | `RA_API_TOKEN`, or `AUTH_TOKEN` | — (required) |
| `url` | `RA_GRID_URL`, `GRID_URL`, `GRID_HOST` | `localhost:5555` |
| `auth` | — | `header` |
| `testSuite` | `RA_TESTSUITE` | unset |
| `releaseId` | `RA_RELEASE_ID` | unset |

`testSuite` and `releaseId` become the `ra:testsuite` and `ra:releaseId`
capabilities, which group runs in the dashboard. Anything you set on the
capability directly wins over the option.

### Why the token goes in a header

The grid also accepts `https://user:TOKEN@host`, and the Python and Java clients
use it happily. WebdriverIO cannot: it is fetch-based, and Node 18+ `fetch`
rejects credentials embedded in a URL. This service sends
`Authorization: Bearer <token>` instead. Set `auth: 'path'` for the
`/t/<token>/` prefix form if a proxy in front of your grid needs it — the header
is sent in that mode too, so both styles of grid work.

## Manual connection

If you would rather wire the connection yourself:

```ts
import { gridConnection } from 'wdio-robotactions-service';

export const config: WebdriverIO.Config = {
    ...gridConnection(),
    capabilities: [{ browserName: 'chrome' }],
};
```

## Starting from scratch

Complete runnable projects — page objects, BDD features, reporting and a CI
entry point — live in
[robotactions-automation](https://github.com/krishtoautomate/robotactions-automation)
for WebdriverIO, Appium, Playwright, Selenium and more.

## License

MIT
