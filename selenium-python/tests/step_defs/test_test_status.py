"""
Step definitions for features/test_status.feature.

Exercises the four ra:setTestStatus write paths shipped on PR #97 against a
real chrome session through the grid, then verifies via the /api/sessions
endpoint that the DB row landed.
"""
import json
import os
import time
import urllib.request
import urllib.error
from typing import Any, Dict

import pytest
from pytest_bdd import scenarios, given, when, then, parsers

scenarios("test_status.feature")


# ── Fixtures specific to this feature ───────────────────────────────────────

@pytest.fixture
def session_state() -> Dict[str, Any]:
    """Per-scenario bag for the session_id (captured after WebDriver.create) so
    later steps can fetch /api/sessions/:id and verify the write."""
    return {}


def _api_get(api_base: str, path: str, token: str) -> Dict[str, Any]:
    req = urllib.request.Request(
        f"{api_base}{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _api_post(
    api_base: str, path: str, body: Dict[str, Any], token: str
) -> tuple[int, Dict[str, Any]]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{api_base}{path}",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8") or "{}")


def _fetch_session_row(api_base: str, session_id: str, token: str) -> Dict[str, Any]:
    """Find the session row in the paginated /api/sessions list."""
    payload = _api_get(api_base, "/api/sessions?limit=200", token)
    rows = payload if isinstance(payload, list) else payload.get("sessions", [])
    for row in rows:
        if row.get("id") == session_id:
            return row
    raise AssertionError(f"Session {session_id} not found in /api/sessions list")


# ── Given ───────────────────────────────────────────────────────────────────

@given("I open a chrome session through the grid")
def open_chrome(browser, session_state: Dict[str, Any]) -> None:
    # The `browser` fixture from conftest.py already opened the session; capture id.
    session_state["session_id"] = browser.session_id


# ── When ────────────────────────────────────────────────────────────────────

@when(parsers.parse('I navigate to "{url}"'))
def navigate_to(browser, url: str) -> None:
    browser.get(url)


@when(parsers.parse('I report status "{status}" via ra:setTestStatus with reason "{reason}"'))
def report_via_magic_script(browser, status: str, reason: str) -> None:
    # Selenium's execute_script wraps the second arg into args[0] on the wire,
    # which the proxy interprets as the structured payload.
    browser.execute_script("ra:setTestStatus", {"status": status, "reason": reason})


@when(parsers.parse('I report a legacy ra:job-result failure with reason "{reason}"'))
def report_legacy_magic(browser, reason: str) -> None:
    browser.execute_script(f"ra:job-result=failed:{reason}")


@when(parsers.parse('I POST status "{status}" with reason "{reason}" to "{port}"'))
def report_via_rest(
    session_state: Dict[str, Any], auth_token: str, status: str, reason: str, port: str
) -> None:
    api_base = f"http://localhost:{port}"
    code, body = _api_post(
        api_base,
        f"/api/sessions/{session_state['session_id']}/result",
        {"status": status, "reason": reason},
        auth_token,
    )
    assert code == 200, f"POST → {code} {body}"


@when(parsers.parse(
    'I POST a rich payload to "{port}" with status "{status}" testName "{test_name}" '
    'testSuite "{test_suite}" reason "{reason}"'
))
def report_rich_rest(
    session_state: Dict[str, Any],
    auth_token: str,
    port: str,
    status: str,
    test_name: str,
    test_suite: str,
    reason: str,
) -> None:
    api_base = f"http://localhost:{port}"
    code, body = _api_post(
        api_base,
        f"/api/sessions/{session_state['session_id']}/result",
        {
            "status": status,
            "reason": reason,
            "testName": test_name,
            "testSuite": test_suite,
        },
        auth_token,
    )
    assert code == 200, f"POST → {code} {body}"


# ── Then ────────────────────────────────────────────────────────────────────

@then(parsers.parse('the session should be marked "{expected_status}" with reason "{expected_reason}"'))
def session_marked(
    session_state: Dict[str, Any], auth_token: str, expected_status: str, expected_reason: str
) -> None:
    api_base = "http://localhost:3001"
    # Brief wait — writes through the magic-script path are async (proxy responds
    # before the DB write fully flushes on slower hosts). Reads use WAL so a
    # 200ms settle is plenty.
    time.sleep(0.2)
    row = _fetch_session_row(api_base, session_state["session_id"], auth_token)
    assert row.get("result") == expected_status, f"result was {row.get('result')!r}"
    assert row.get("resultMessage") == expected_reason, f"resultMessage was {row.get('resultMessage')!r}"


@then(parsers.parse('the session test_name should be "{expected}"'))
def session_test_name(session_state: Dict[str, Any], auth_token: str, expected: str) -> None:
    api_base = "http://localhost:3001"
    row = _fetch_session_row(api_base, session_state["session_id"], auth_token)
    assert row.get("testName") == expected, f"testName was {row.get('testName')!r}"


@then(parsers.parse('the session test_suite should be "{expected}"'))
def session_test_suite(session_state: Dict[str, Any], auth_token: str, expected: str) -> None:
    api_base = "http://localhost:3001"
    row = _fetch_session_row(api_base, session_state["session_id"], auth_token)
    assert row.get("testSuite") == expected, f"testSuite was {row.get('testSuite')!r}"


@then("a synthetic ra:setTestStatus row should appear in the timeline")
def synthetic_row_present(session_state: Dict[str, Any], auth_token: str) -> None:
    api_base = "http://localhost:3001"
    payload = _api_get(api_base, f"/api/sessions/{session_state['session_id']}/commands", auth_token)
    cmds = payload if isinstance(payload, list) else payload.get("commands", [])
    matches = [c for c in cmds if c.get("commandName") == "ra:setTestStatus"]
    assert matches, "no ra:setTestStatus row found in command timeline"
    assert matches[-1].get("commandCategory") == "test-status", (
        f"category was {matches[-1].get('commandCategory')!r}"
    )


@then("no synthetic ra:setTestStatus row should appear in the timeline")
def synthetic_row_absent(session_state: Dict[str, Any], auth_token: str) -> None:
    api_base = "http://localhost:3001"
    payload = _api_get(api_base, f"/api/sessions/{session_state['session_id']}/commands", auth_token)
    cmds = payload if isinstance(payload, list) else payload.get("commands", [])
    matches = [c for c in cmds if c.get("commandName") == "ra:setTestStatus"]
    assert not matches, f"unexpected ra:setTestStatus rows on a passed session: {matches}"
