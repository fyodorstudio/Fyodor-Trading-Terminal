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


def test_calendar_ingest_keeps_multiple_times_for_same_event_id():
  """Rows are deduped by (id, time), not by id alone, so series history survives."""
  base_id = 9_001
  first_time = _EVENT_TIME + 200
  second_time = _EVENT_TIME + 400
  body = {
    "events": [
      {
        "id": base_id,
        "time": first_time,
        "countryCode": "US",
        "currency": "USD",
        "title": "CPI y/y",
        "impact": "high",
        "actual": "2.4",
        "forecast": "2.5",
        "previous": "2.4",
      },
      {
        "id": base_id,
        "time": second_time,
        "countryCode": "US",
        "currency": "USD",
        "title": "CPI y/y",
        "impact": "high",
        "actual": "",
        "forecast": "",
        "previous": "",
      },
    ]
  }

  r = client.post("/calendar_ingest", content=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"})
  assert r.status_code == 200, r.text

  get_r = client.get("/calendar", params={"from_": first_time - 10, "to": second_time + 10})
  assert get_r.status_code == 200, get_r.text
  events = get_r.json()

  matching = [e for e in events if e.get("id") == base_id]
  assert len(matching) == 2
  assert {e["time"] for e in matching} == {first_time, second_time}


def test_calendar_ingest_updates_health_timestamp_near_now():
  """Health timestamp should reflect real current time, not drift by local UTC offset."""
  body = json.dumps(MINIMAL_BODY).encode("utf-8")
  before = time.time()
  post_r = client.post("/calendar_ingest", content=body, headers={"Content-Type": "application/json"})
  assert post_r.status_code == 200, post_r.text

  health_r = client.get("/health")
  assert health_r.status_code == 200, health_r.text
  payload = health_r.json()

  last_ingest = payload.get("last_calendar_ingest_at")
  assert isinstance(last_ingest, (int, float))
  assert before - 5 <= float(last_ingest) <= time.time() + 5
