"""
Contract test for the Economic Calendar API (CALENDAR_CONTRACT.md).
Uses FastAPI TestClient; no running server required.
"""
from __future__ import annotations

import asyncio
import json
import time
from contextlib import contextmanager

from fastapi.testclient import TestClient

# Import app after potential env/mocks so MT5 is not required for calendar-only tests
import server
from server import app
from quote_snapshot import QuoteSnapshotStore

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


def test_chart_stream_treats_rapid_client_disconnect_as_normal_lifecycle():
  class ClosedDuringSend:
    application_state = server.WebSocketState.CONNECTED

    @staticmethod
    async def send_json(_payload):
      raise RuntimeError('Cannot call "send" once a close message has been sent.')

    @staticmethod
    async def close():
      raise RuntimeError('Cannot call "send" once a close message has been sent.')

  class ClientDisconnect:
    @staticmethod
    async def receive():
      return {"type": "websocket.disconnect", "code": 1000}

  async def exercise_disconnect_paths():
    assert await server._try_websocket_send_json(ClosedDuringSend(), {"type": "status"}) is False
    await server._try_websocket_close(ClosedDuringSend())
    disconnected = asyncio.Event()
    await server._watch_websocket_disconnect(ClientDisconnect(), disconnected)
    assert disconnected.is_set()
    assert await server._wait_for_stream_tick(disconnected) is True

  asyncio.run(exercise_disconnect_paths())


def test_chart_stream_handler_exits_cleanly_when_pair_switch_closes_socket(monkeypatch):
  class DummyMT5:
    @staticmethod
    def copy_rates_from_pos(_symbol, _timeframe, _start, _count):
      return [{
        "time": _EVENT_TIME,
        "open": 1.1,
        "high": 1.2,
        "low": 1.0,
        "close": 1.15,
        "tick_volume": 100,
        "real_volume": 0,
      }]

  monkeypatch.setattr(server, "mt5", DummyMT5)
  monkeypatch.setattr(server, "mt5_timeframe", lambda _tf: 240)
  monkeypatch.setattr(server, "_ensure_mt5_initialized", lambda: True)
  monkeypatch.setattr(server, "ensure_symbol_selected", lambda _symbol: None)

  with client.websocket_connect("/stream?symbol=EURUSD&tf=H4") as websocket:
    assert websocket.receive_json()["message"] == "connected"
    candle_message = websocket.receive_json()
    assert candle_message["type"] == "candle_update"
    assert candle_message["candle"]["time"] == _EVENT_TIME


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


def test_cycle_acknowledgement_rejects_failed_upload_and_freezes_success(monkeypatch):
  release_time = max(server.FORWARD_LEDGER_ACTIVATED_AT, int(time.time()) - 1)
  body = {
    "events": [{
      **MINIMAL_EVENT,
      "id": 91_337,
      "time": release_time,
      "title": "Initial Jobless Claims",
      "actual": "210",
      "forecast": "215",
      "previous": "220",
    }]
  }
  assert client.post("/calendar_ingest", json=body).status_code == 200
  scheduled = []
  monkeypatch.setattr(server, "_schedule_forward_reconcile", lambda timestamp: scheduled.append(timestamp) or True)

  failed = client.post("/calendar_ingest_cycle", json={"completedAt": release_time + 1, "failedBatches": 1})
  assert failed.status_code == 200
  assert failed.json()["accepted"] is False
  assert scheduled == []

  cycle_body = json.dumps({"completedAt": release_time + 2, "failedBatches": 0}).encode("utf-8") + b"\x00"
  completed = client.post("/calendar_ingest_cycle", content=cycle_body)
  assert completed.status_code == 200
  assert completed.json()["accepted"] is True
  assert completed.json()["captured"] >= 1
  assert len(scheduled) == 1
  assert abs(scheduled[0] - int(time.time())) <= 2
  ledger = client.get("/research/forward", params={"versionId": server.V2_VERSION_ID})
  assert ledger.status_code == 200
  assert ledger.json()["immutable"] is True
  assert ledger.json()["lastSuccessfulCycleAt"] is not None


def test_history_range_validates_range_order():
  r = client.get("/history_range", params={"symbol": "EURUSD", "tf": "M1", "from_": 20, "to": 10})
  assert r.status_code == 400


def test_macro_chart_signals_are_honest_for_unsupported_instruments() -> None:
  response = client.get("/research/chart-signals", params={"symbol": "BTCUSD", "tf": "H4"})
  assert response.status_code == 200
  assert response.json()["supported"] is False
  assert response.json()["signals"] == []


def test_macro_chart_signals_reject_an_unknown_signal_view() -> None:
  response = client.get("/research/chart-signals", params={"symbol": "EURUSD", "tf": "H4", "mode": "best_hindsight"})
  assert response.status_code == 400
  assert response.json()["detail"] == "Macro Bias mode must be current or research_replay"


def test_history_range_validates_range_size():
  start = int(time.time())
  end = start + 50 * 24 * 60 * 60
  r = client.get("/history_range", params={"symbol": "EURUSD", "tf": "M1", "from_": start, "to": end})
  assert r.status_code == 400


def test_symbols_returns_all_mt5_rows_with_market_watch_fields_in_one_call(monkeypatch):
  class Symbol:
    def __init__(self, name, bid, ask, price_change, digits, visible, selected):
      self.name = name
      self.path = f"Broker\\{name}"
      self.bid = bid
      self.ask = ask
      self.price_change = price_change
      self.digits = digits
      self.time = 1_788_900_000
      self.visible = visible
      self.select = selected

  class DummyMT5:
    symbols_get_calls = 0

    @staticmethod
    def terminal_info():
      return object()

    @classmethod
    def symbols_get(cls):
      cls.symbols_get_calls += 1
      return (
        Symbol("USDSEK", 9.57453, 9.57596, .09, 5, False, False),
        Symbol("USDJPY", 153.307, 153.328, -.43, 3, True, True),
      )

    @staticmethod
    def symbol_info(_symbol):
      raise AssertionError("/symbols must use the complete symbols_get payload, not one MT5 call per row")

    @staticmethod
    def last_error():
      return (1, "Success")

  monkeypatch.setattr(server, "mt5", DummyMT5)
  server._last_symbols_payload = []

  response = client.get("/symbols")

  assert response.status_code == 200, response.text
  assert DummyMT5.symbols_get_calls == 1
  assert response.json() == [
    {
      "name": "USDSEK", "path": "Broker\\USDSEK", "bid": 9.57453, "ask": 9.57596,
      "price_change": .09, "digits": 5, "quote_time": 1_788_900_000, "visible": False, "selected": False,
      "synchronized": None,
    },
    {
      "name": "USDJPY", "path": "Broker\\USDJPY", "bid": 153.307, "ask": 153.328,
      "price_change": -.43, "digits": 3, "quote_time": 1_788_900_000, "visible": True, "selected": True,
      "synchronized": None,
    },
  ]


def test_fresh_ea_quote_snapshot_serves_symbols_without_python_mt5_access(monkeypatch):
  clock = [100.0]
  quote_store = QuoteSnapshotStore(monotonic=lambda: clock[0])
  monkeypatch.setattr(server, "_quote_snapshot_store", quote_store)
  monkeypatch.setattr(server, "_last_market_watch_poll_monotonic", 0.0)

  complete = client.post("/quotes_ingest", json={
    "publisher_id": "ea-session-1",
    "broker_identity": "Broker A|MetaTrader 5",
    "catalog_revision": "broker-catalog-a",
    "sequence": 1,
    "complete": True,
    "sent_at": 1_788_900_000,
    "rows": [
      {
        "name": "EURUSD", "path": "Forex\\Majors", "bid": 1.16, "ask": 1.1602,
        "price_change": 0.2, "digits": 5, "quote_time": 1_788_900_000,
        "visible": True, "selected": True, "synchronized": True,
      },
      {
        "name": "INDEX.WEIRD", "path": "Indices", "bid": None, "ask": None,
        "price_change": None, "digits": 2, "quote_time": None,
        "visible": False, "selected": False, "synchronized": False,
      },
    ],
  })
  assert complete.status_code == 200, complete.text
  assert complete.json()["symbol_count"] == 2

  @contextmanager
  def forbidden_mt5_access(_timeout=None):
    raise AssertionError("fresh EA quotes must not enter Python MT5 IPC")
    yield

  monkeypatch.setattr(server, "_mt5_access", forbidden_mt5_access)
  response = client.get("/symbols", params={"background": True})

  assert response.status_code == 200, response.text
  assert [row["name"] for row in response.json()] == ["EURUSD", "INDEX.WEIRD"]
  assert response.json()[0]["bid"] == 1.16
  assert response.json()[0]["synchronized"] is True
  snapshot = client.get("/symbol_snapshot", params={"background": True})
  assert snapshot.status_code == 200, snapshot.text
  assert snapshot.json()["source"] == "ea_publisher"
  assert snapshot.json()["broker_identity"] == "Broker A|MetaTrader 5"
  assert snapshot.json()["catalog_revision"] == "broker-catalog-a"
  assert len(snapshot.json()["catalog_identity"]) == 64
  assert [row["name"] for row in snapshot.json()["symbols"]] == ["EURUSD", "INDEX.WEIRD"]

  delta = client.post("/quotes_ingest", json={
    "publisher_id": "ea-session-1",
    "broker_identity": "Broker A|MetaTrader 5",
    "catalog_revision": "broker-catalog-a",
    "sequence": 2,
    "complete": False,
    "sent_at": 1_788_900_001,
    "rows": [{
      "name": "EURUSD", "path": "Forex\\Majors", "bid": 1.1601, "ask": 1.1603,
      "price_change": 0.21, "digits": 5, "quote_time": 1_788_900_001,
      "visible": True, "selected": True, "synchronized": True,
    }],
  })
  assert delta.status_code == 200, delta.text
  assert client.get("/symbols").json()[0]["bid"] == 1.1601


def test_quote_ingest_requires_complete_snapshot_for_new_catalog(monkeypatch):
  quote_store = QuoteSnapshotStore(monotonic=lambda: 100.0)
  monkeypatch.setattr(server, "_quote_snapshot_store", quote_store)

  response = client.post("/quotes_ingest", json={
    "publisher_id": "ea-session-2",
    "broker_identity": "Broker B|MetaTrader 5",
    "catalog_revision": "new-broker",
    "sequence": 1,
    "complete": False,
    "rows": [],
  })

  assert response.status_code == 409
  assert "complete snapshot" in response.json()["detail"]


def test_stale_ea_quotes_fall_back_to_complete_python_catalog(monkeypatch):
  clock = [100.0]
  quote_store = QuoteSnapshotStore(monotonic=lambda: clock[0])
  quote_store.ingest(
    publisher_id="ea-session-stale",
    broker_identity="Broker Old|MetaTrader 5",
    catalog_revision="old-catalog",
    sequence=1,
    complete=True,
    sent_at=1_788_900_000,
    rows=[{
      "name": "OLD", "path": "Old", "bid": 1.0, "ask": 1.1,
      "price_change": 0.0, "digits": 2, "quote_time": 1_788_900_000,
      "visible": True, "selected": True,
    }],
  )
  clock[0] += server._QUOTE_SNAPSHOT_FRESH_SECONDS + 0.1
  monkeypatch.setattr(server, "_quote_snapshot_store", quote_store)

  class DummyMT5:
    @staticmethod
    def terminal_info():
      return type("Terminal", (), {"company": "Broker New", "name": "MetaTrader 5"})()

    @staticmethod
    def symbols_get():
      return (type("Symbol", (), {
        "name": "NEW", "path": "Broker\\NEW", "bid": 2.0, "ask": 2.1,
        "price_change": 1.0, "digits": 2, "time": 1_788_900_010,
        "visible": True, "select": True,
      })(),)

    @staticmethod
    def last_error():
      return (1, "Success")

  monkeypatch.setattr(server, "mt5", DummyMT5)
  response = client.get("/symbol_snapshot")

  assert response.status_code == 200, response.text
  assert response.json()["source"] == "python_mt5"
  assert response.json()["broker_identity"] == "Broker New|MetaTrader 5"
  assert [row["name"] for row in response.json()["symbols"]] == ["NEW"]


def test_catalog_scoped_history_rejects_stale_identity_before_mt5_access(monkeypatch):
  monkeypatch.setattr(server, "_last_symbols_broker_identity", "Broker Current|MetaTrader 5")
  monkeypatch.setattr(server, "_last_symbols_catalog_revision", "current-catalog")

  @contextmanager
  def forbidden_mt5_access(_timeout=None):
    raise AssertionError("stale catalog work must stop before entering MT5 IPC")
    yield

  monkeypatch.setattr(server, "_mt5_access", forbidden_mt5_access)
  response = client.get("/history", params={
    "symbol": "EURUSD", "tf": "H4", "bars": 100, "catalog_identity": "stale-catalog",
  })

  assert response.status_code == 409
  assert "catalog changed" in response.json()["detail"]


def test_catalog_scoped_history_never_falls_back_to_unscoped_durable_candles(monkeypatch):
  monkeypatch.setattr(server, "_last_symbols_broker_identity", "Broker Current|MetaTrader 5")
  monkeypatch.setattr(server, "_last_symbols_catalog_revision", "current-catalog")
  catalog_identity = server._symbol_snapshot_metadata()["catalog_identity"]
  monkeypatch.setattr(server, "_ensure_mt5_initialized", lambda: False)
  monkeypatch.setattr(server, "_cached_history", lambda *_args, **_kwargs: [{
    "time": 1, "open": 1.0, "high": 1.0, "low": 1.0, "close": 1.0, "volume": 1,
  }])

  response = client.get("/history", params={
    "symbol": "EURUSD", "tf": "H4", "bars": 100, "catalog_identity": catalog_identity,
  })

  assert response.status_code == 503
  assert response.json()["detail"] == "MT5 terminal not connected"


def test_history_range_returns_candles_with_mocked_mt5(monkeypatch):
  class DummyMT5:
    TIMEFRAME_M1 = 1
    TIMEFRAME_M5 = 5
    TIMEFRAME_M15 = 15
    TIMEFRAME_M30 = 30
    TIMEFRAME_H1 = 60
    TIMEFRAME_H4 = 240
    TIMEFRAME_D1 = 1440
    TIMEFRAME_W1 = 10080
    TIMEFRAME_MN1 = 43200

    @staticmethod
    def terminal_info():
      return object()

    @staticmethod
    def symbol_select(_symbol, _visible):
      return True

    @staticmethod
    def symbol_info(_symbol):
      return object()

    @staticmethod
    def last_error():
      return (1, "Success")

    @staticmethod
    def copy_rates_range(_symbol, _tf, _from_dt, _to_dt):
      return [
        {
          "time": _EVENT_TIME,
          "open": 1.1,
          "high": 1.2,
          "low": 1.0,
          "close": 1.15,
          "tick_volume": 100,
          "real_volume": 0,
        }
      ]

  monkeypatch.setattr(server, "mt5", DummyMT5)

  r = client.get(
    "/history_range",
    params={"symbol": "EURUSD", "tf": "M1", "from_": _EVENT_TIME - 60, "to": _EVENT_TIME + 60},
  )
  assert r.status_code == 200, r.text
  payload = r.json()
  assert isinstance(payload, list)
  assert payload[0]["time"] == _EVENT_TIME
  assert payload[0]["close"] == 1.15
  assert server._research_store.candle_coverage("EURUSD", "M1")["count"] >= 1


def test_chart_history_and_health_remain_available_while_mt5_is_busy(monkeypatch):
  candle_time = 1_700_000_000
  server._research_store.upsert_candles("USDJPY", "H4", [{
    "time": candle_time,
    "open": 149.1,
    "high": 149.4,
    "low": 148.9,
    "close": 149.2,
    "volume": 100,
  }])

  lock_timeouts = []

  @contextmanager
  def busy_access(_timeout=None):
    lock_timeouts.append(_timeout)
    raise server.Mt5BusyError("busy")
    yield

  monkeypatch.setattr(server, "_mt5_access", busy_access)

  history_response = client.get("/history", params={"symbol": "USDJPY", "tf": "H4", "bars": 200})
  assert history_response.status_code == 200
  assert history_response.json()[-1]["time"] == candle_time
  assert lock_timeouts[-1] == server._MT5_FOREGROUND_LOCK_TIMEOUT_SECONDS

  background_response = client.get("/history", params={
    "symbol": "USDJPY", "tf": "H4", "bars": 200, "background": True,
  })
  assert background_response.status_code == 200
  assert background_response.json()[-1]["time"] == candle_time
  assert lock_timeouts[-1] == .05

  server._last_symbols_payload = [{"name": "USDJPY", "path": "Forex", "bid": 149.2}]
  symbols_response = client.get("/symbols", params={"background": True})
  assert symbols_response.status_code == 200
  assert symbols_response.json() == server._last_symbols_payload
  assert lock_timeouts[-1] == .05

  boundary_response = client.get("/history_boundary", params={"symbol": "USDJPY", "tf": "H4"})
  assert boundary_response.status_code == 200
  assert boundary_response.json()["oldest_time"] == candle_time
  assert boundary_response.json()["source"] == "durable_cache"

  health_response = client.get("/health")
  assert health_response.status_code == 200
  assert health_response.json()["ok"] is True
  assert health_response.json()["mt5_busy"] is True


def test_market_watch_poll_defers_uncached_background_history_without_taking_mt5_lock(monkeypatch):
  lock_attempts = []

  @contextmanager
  def unexpected_access(_timeout=None):
    lock_attempts.append(_timeout)
    yield

  monkeypatch.setattr(server, "_mt5_access", unexpected_access)
  monkeypatch.setattr(server, "_last_market_watch_poll_monotonic", time.monotonic())
  monkeypatch.setattr(server, "_cached_history", lambda *_args, **_kwargs: [])

  response = client.get("/history", params={
    "symbol": "UNCACHED.ADAPTIVE", "tf": "H4", "bars": 350, "background": True,
  })

  assert response.status_code == 503
  assert response.json()["detail"] == "Background history deferred while Market Watch is active"
  assert lock_attempts == []


def test_startup_does_not_eagerly_schedule_full_market_reconciliation(monkeypatch):
  scheduled = []
  monkeypatch.setattr(server, "_schedule_forward_reconcile", lambda timestamp: scheduled.append(timestamp) or True)
  monkeypatch.setattr(server, "_ensure_mt5_initialized", lambda: True)

  server.on_startup()

  assert scheduled == []
