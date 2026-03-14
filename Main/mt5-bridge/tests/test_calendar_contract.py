"""
Contract test for the Economic Calendar API (CALENDAR_CONTRACT.md).
Uses FastAPI TestClient; no running server required.
"""
from __future__ import annotations

import json
import time

from fastapi.testclient import TestClient

# Import app after potential env/mocks so MT5 is not required for calendar-only tests
from server import app

client = TestClient(app)

# Event time in the future so it is always within the bridge's 90-day retention window
_EVENT_TIME = int(time.time()) + 86400  # now + 1 day

# Minimal valid event per contract (one event in events array)
MINIMAL_EVENT = {
  "id": 1,
  "time": _EVENT_TIME,
  "countryCode": "US",
  "currency": "USD",
  "title": "Test",
  "impact": "high",
  "actual": "",
  "forecast": "",
  "previous": "",
}
MINIMAL_BODY = {"events": [MINIMAL_EVENT]}


def test_calendar_ingest_then_get():
  """POST minimal valid body, then GET in range returns that event (contract compliance)."""
  # POST minimal valid body
  body = json.dumps(MINIMAL_BODY).encode("utf-8")
  r = client.post("/calendar_ingest", content=body, headers={"Content-Type": "application/json"})
  assert r.status_code == 200, r.text
  data = r.json()
  assert "ingested" in data and "total" in data
  assert data["ingested"] >= 1
  assert data["total"] >= 1

  # GET with from_/to spanning the event time
  get_r = client.get(
    "/calendar",
    params={"from_": _EVENT_TIME - 100, "to": _EVENT_TIME + 100},
  )
  assert get_r.status_code == 200, get_r.text
  events = get_r.json()
  assert isinstance(events, list)
  assert len(events) >= 1
  ev = next(e for e in events if e.get("id") == MINIMAL_EVENT["id"] and e.get("time") == MINIMAL_EVENT["time"])
  assert ev["title"] == MINIMAL_EVENT["title"]
  assert ev["impact"] == MINIMAL_EVENT["impact"]
  assert ev["countryCode"] == MINIMAL_EVENT["countryCode"]
  assert ev["currency"] == MINIMAL_EVENT["currency"]


def test_calendar_ingest_tolerates_trailing_null():
  """POST with trailing null byte in body still returns 200 (contract tolerance)."""
  body = json.dumps(MINIMAL_BODY).encode("utf-8") + b"\x00"
  r = client.post("/calendar_ingest", content=body, headers={"Content-Type": "application/json"})
  assert r.status_code == 200, r.text
  data = r.json()
  assert "ingested" in data and "total" in data
