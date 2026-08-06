"""
Standalone smoke test for the ra:setTestStatus write paths shipped on
appium-grid-service PR #97. Use this when you want a quick pytest run
without the BDD overhead.

Run:
    GRID_URL=http://localhost:4444 \\
    AUTH_TOKEN=<your-jwt> \\
    BASE_URL=https://example.com \\
    pytest tests/test_ra_set_test_status.py -v

Each test opens a real chrome session through the grid, exercises one write
path, then verifies via the broadcaster's /api/sessions endpoint that the DB
row landed.
"""
import json
import os
import time
import urllib.request
import urllib.error
from typing import Any, Dict


BROADCASTER_URL = os.environ.get("BROADCASTER_URL", "http://localhost:3001")
# Most test runs use BASE_URL to exercise a real page. The magic-script paths
# short-circuit at the proxy though, so the browser doesn't actually need to
# reach the page. NAV_URL overrides BASE_URL for these tests when the chrome
# container has no external DNS (common in isolated Docker networks).
NAV_URL = os.environ.get("NAV_URL") or os.environ.get("BASE_URL") or "about:blank"


def _api_get(path: str, token: str) -> Dict[str, Any]:
    req = urllib.request.Request(
        f"{BROADCASTER_URL}{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _api_post(base: str, path: str, body: Dict[str, Any], token: str) -> tuple[int, Dict[str, Any]]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{base}{path}",
        data=data,
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8") or "{}")


def _fetch_session_row(session_id: str, token: str) -> Dict[str, Any]:
    payload = _api_get("/api/sessions?limit=200", token)
    rows = payload if isinstance(payload, list) else payload.get("sessions", [])
    for row in rows:
        if row.get("id") == session_id:
            return row
    raise AssertionError(f"session {session_id} not found")


def _fetch_commands(session_id: str, token: str) -> list[Dict[str, Any]]:
    payload = _api_get(f"/api/sessions/{session_id}/commands", token)
    return payload if isinstance(payload, list) else payload.get("commands", [])


def _settle() -> None:
    """Brief settle for WAL flush — magic-script writes are async."""
    time.sleep(0.2)


class TestRaSetTestStatus:
    def test_pass_via_magic_no_synthetic_row(self, browser, auth_token, base_url):
        """A passing session sets result=passed but writes NO synthetic timeline row."""
        sid = browser.session_id
        browser.get(NAV_URL)
        browser.execute_script("ra:setTestStatus", {"status": "passed", "reason": "happy path"})
        _settle()

        row = _fetch_session_row(sid, auth_token)
        assert row["result"] == "passed"
        assert row["resultMessage"] == "happy path"

        cmds = _fetch_commands(sid, auth_token)
        synth = [c for c in cmds if c["commandName"] == "ra:setTestStatus"]
        assert not synth, "passing tests should not emit a synthetic timeline row"

    def test_fail_via_magic_adds_synthetic_row(self, browser, auth_token, base_url):
        """A failing session sets result=failed AND writes a synthetic row carrying the reason."""
        sid = browser.session_id
        browser.get(NAV_URL)
        browser.execute_script(
            "ra:setTestStatus",
            {"status": "failed", "reason": "expected element missing", "testName": "regression-1"},
        )
        _settle()

        row = _fetch_session_row(sid, auth_token)
        assert row["result"] == "failed"
        assert row["resultMessage"] == "expected element missing"
        assert row["testName"] == "regression-1"

        cmds = _fetch_commands(sid, auth_token)
        synth = [c for c in cmds if c["commandName"] == "ra:setTestStatus"]
        assert synth, "failed sessions must emit a synthetic timeline row"
        assert synth[-1]["commandCategory"] == "test-status"

    def test_fail_via_legacy_ra_job_result(self, browser, auth_token, base_url):
        """Legacy ra:job-result=failed:reason still works (regression check)."""
        sid = browser.session_id
        browser.get(NAV_URL)
        browser.execute_script("ra:job-result=failed:legacy magic regression")
        _settle()

        row = _fetch_session_row(sid, auth_token)
        assert row["result"] == "failed"
        assert row["resultMessage"] == "legacy magic regression"

    def test_fail_via_rest_on_broadcaster(self, browser, auth_token, base_url):
        """POST /api/sessions/:id/result on the broadcaster (port 3001)."""
        sid = browser.session_id
        browser.get(NAV_URL)
        code, body = _api_post(
            BROADCASTER_URL,
            f"/api/sessions/{sid}/result",
            {"status": "failed", "reason": "REST via broadcaster"},
            auth_token,
        )
        assert code == 200, body

        row = _fetch_session_row(sid, auth_token)
        assert row["result"] == "failed"
        assert row["resultMessage"] == "REST via broadcaster"

    def test_fail_via_rest_on_grid_proxy(self, browser, auth_token, base_url, grid_url):
        """POST /api/sessions/:id/result on the grid proxy (port 4444).

        Mirror of the broadcaster endpoint added on PR #97 so test frameworks
        pointing at the grid URL don't need to discover a second port.
        """
        sid = browser.session_id
        browser.get(NAV_URL)
        # grid_url already strips trailing /wd/hub if present; this hits 4444
        # directly with the same body shape as the broadcaster endpoint.
        proxy_base = grid_url.replace("/wd/hub", "").rstrip("/")
        code, body = _api_post(
            proxy_base,
            f"/api/sessions/{sid}/result",
            {
                "status": "failed",
                "reason": "REST via grid proxy",
                "testName": "Grid-proxy smoke",
                "testSuite": "Smoke Suite",
            },
            auth_token,
        )
        assert code == 200, body

        row = _fetch_session_row(sid, auth_token)
        assert row["result"] == "failed"
        assert row["resultMessage"] == "REST via grid proxy"
        assert row["testName"] == "Grid-proxy smoke"
        assert row["testSuite"] == "Smoke Suite"
