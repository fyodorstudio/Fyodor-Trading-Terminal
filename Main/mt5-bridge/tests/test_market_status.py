from __future__ import annotations

from datetime import datetime, timezone

from server import _forex_session_window, _infer_asset_class


def test_infer_asset_class_prefers_forex_for_major_pair() -> None:
  assert _infer_asset_class("EURUSD", "Forex Majors\\EURUSD") == "forex"


def test_infer_asset_class_detects_crypto() -> None:
  assert _infer_asset_class("BTCUSD", "Crypto\\Majors\\BTCUSD") == "crypto"


def test_forex_session_window_is_closed_on_saturday() -> None:
  saturday = datetime(2026, 3, 14, 10, 0, tzinfo=timezone.utc)
  is_open, next_open_time, _next_close_time, reason = _forex_session_window(saturday)

  assert is_open is False
  assert datetime.fromtimestamp(next_open_time, tz=timezone.utc).weekday() == 6
  assert reason == "weekend"


def test_forex_session_window_is_open_during_week() -> None:
  monday = datetime(2026, 3, 16, 10, 0, tzinfo=timezone.utc)
  is_open, _next_open_time, next_close_time, reason = _forex_session_window(monday)

  assert is_open is True
  assert datetime.fromtimestamp(next_close_time, tz=timezone.utc).weekday() == 4
  assert reason == "active_session"
