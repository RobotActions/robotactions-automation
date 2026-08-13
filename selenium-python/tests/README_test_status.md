# ra:setTestStatus — End-to-End Test Scenarios

These tests exercise the test-status write paths shipped on appium-grid-service [PR #97](https://github.com/krishtoautomate/appium-grid-service/pull/97).

Files:
- `features/test_status.feature` — 6 BDD scenarios (smoke / magic / legacy / REST / rich)
- `tests/step_defs/test_test_status.py` — step definitions, auto-collected via `scenarios()`
- `tests/test_ra_set_test_status.py` — standalone pytest version (no BDD overhead) for CI smoke

## What's covered

| Write path | Body shape | Synthetic timeline row on failed? |
|------------|-----------|------------------------------------|
| `driver.execute_script('ra:setTestStatus', {status, reason, testName?, testSuite?})` | structured args (preferred) | ✓ |
| `driver.execute_script('ra:job-result=failed:<reason>')` | legacy string-encoded | ✓ |
| `POST :3001/api/sessions/:id/result` (broadcaster) | JSON `{status, reason, …}` | ✓ |
| `POST :5555/api/sessions/:id/result` (grid proxy mirror — NEW) | JSON `{status, reason, …}` | ✓ |

Passing sessions are quiet (no synthetic row). Reserve the noisy timeline marker for failures.

## How to run

### Prerequisites
- appium-grid-service running locally (PM2 or `npm run start:dev`)
- A valid JWT for `AUTH_TOKEN` — see "Auth setup" below
- Chrome installed

### One-time setup
```bash
cd /Users/robotactions/Deployments/2026/testgen/selenium-python
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### Run the BDD scenarios
```bash
GRID_URL=http://localhost:5555 \
AUTH_TOKEN=<your-jwt> \
BASE_URL=https://example.com \
BROADCASTER_URL=http://localhost:3001 \
.venv/bin/pytest tests/step_defs/test_test_status.py -v
```

### Run the standalone smoke test
```bash
GRID_URL=http://localhost:5555 \
AUTH_TOKEN=<your-jwt> \
BASE_URL=https://example.com \
.venv/bin/pytest tests/test_ra_set_test_status.py -v
```

### Selective runs
```bash
# Just the smoke-tagged scenarios
.venv/bin/pytest tests/step_defs/test_test_status.py -v -k smoke

# Just the magic-script paths
.venv/bin/pytest tests/step_defs/test_test_status.py -v -k magic
```

## Auth setup

`POST /session` on the grid proxy 5555 remote-validates the JWT against the parent RemoteDeviceServer (`TOKEN_VALIDATE_URL=http://localhost:8000/auth/api-tokens/validate`).

Three options for `AUTH_TOKEN`:

**(a) Real token from RemoteDeviceServer** — issue one via the parent's admin UI / CLI and export it:
```bash
export AUTH_TOKEN=<token-issued-by-parent>
```

**(b) Local HS256 (dev only)** — temporarily unset `TOKEN_VALIDATE_URL` in `appium-grid-service/.env`, restart PM2, then sign a token with `JWT_SECRET`:
```bash
cd /Users/robotactions/Deployments/2026/appium-grid-service
node -e "console.log(require('jsonwebtoken').sign({email:'you@local'}, '<JWT_SECRET>', {expiresIn:'1h'}))"
```
⚠️ Revert `.env` after — this bypasses parent revocation.

**(c) Existing session id (REST paths only)** — the REST endpoints (3001 + 5555) don't need `createSession`, so the standalone smoke test's REST-only assertions work against any session id already in the DB. Pass an existing UUID and skip the magic-script tests.

## Expected dashboard outcome

After a successful run, the Appium Grid dashboard (History tab) shows:
- **Failed** chip count = 4 (one per fail scenario + the legacy regression)
- **Passed** chip count includes the `test_pass_via_magic_no_synthetic_row` session
- Expanding a failed row reveals the orange `test-status` badge with `ra:setTestStatus` and the failure reason
