from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Iterable, List, Optional, Sequence


def default_research_db_path() -> Path:
  configured = os.environ.get("FYODOR_RESEARCH_DB")
  if configured:
    return Path(configured).expanduser().resolve()

  local_app_data = os.environ.get("LOCALAPPDATA")
  if local_app_data:
    return Path(local_app_data) / "Fyodor Trading Terminal" / "fyodor-research.sqlite3"

  return Path(__file__).resolve().parent / "data" / "fyodor-research.sqlite3"


class ResearchStore:
  """Durable local calendar, candle-cache, version, and backtest storage."""

  def __init__(self, path: Optional[Path] = None) -> None:
    self.path = (path or default_research_db_path()).resolve()
    self.path.parent.mkdir(parents=True, exist_ok=True)
    self._write_lock = Lock()
    self._initialize()

  def _connect(self) -> sqlite3.Connection:
    connection = sqlite3.connect(self.path, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 30000")
    return connection

  def _initialize(self) -> None:
    with self._connect() as connection:
      connection.execute("PRAGMA journal_mode = WAL")
      connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS calendar_events (
          id INTEGER NOT NULL,
          time INTEGER NOT NULL,
          country_code TEXT NOT NULL,
          currency TEXT NOT NULL,
          title TEXT NOT NULL,
          impact TEXT NOT NULL,
          actual TEXT,
          forecast TEXT,
          previous TEXT,
          ingested_at INTEGER NOT NULL,
          PRIMARY KEY (id, time)
        );

        CREATE INDEX IF NOT EXISTS idx_calendar_time
          ON calendar_events (time);
        CREATE INDEX IF NOT EXISTS idx_calendar_currency_time
          ON calendar_events (currency, time);

        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS candle_cache (
          symbol TEXT NOT NULL,
          timeframe TEXT NOT NULL,
          time INTEGER NOT NULL,
          open REAL NOT NULL,
          high REAL NOT NULL,
          low REAL NOT NULL,
          close REAL NOT NULL,
          volume INTEGER NOT NULL,
          PRIMARY KEY (symbol, timeframe, time)
        );

        CREATE INDEX IF NOT EXISTS idx_candle_cache_range
          ON candle_cache (symbol, timeframe, time);

        CREATE TABLE IF NOT EXISTS signal_versions (
          id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          configuration_json TEXT NOT NULL,
          configuration_hash TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS backtest_runs (
          id TEXT PRIMARY KEY,
          version_id TEXT NOT NULL,
          dataset_fingerprint TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          status TEXT NOT NULL,
          result_json TEXT,
          error TEXT,
          FOREIGN KEY (version_id) REFERENCES signal_versions(id)
        );

        CREATE INDEX IF NOT EXISTS idx_backtest_runs_version_created
          ON backtest_runs (version_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS release_observations (
          id INTEGER NOT NULL,
          time INTEGER NOT NULL,
          country_code TEXT NOT NULL,
          currency TEXT NOT NULL,
          title TEXT NOT NULL,
          impact TEXT NOT NULL,
          actual TEXT NOT NULL,
          forecast TEXT,
          previous TEXT,
          first_seen_at INTEGER NOT NULL,
          PRIMARY KEY (id, time)
        );

        CREATE INDEX IF NOT EXISTS idx_release_observations_time
          ON release_observations (time);

        CREATE TABLE IF NOT EXISTS paper_cases (
          version_id TEXT NOT NULL,
          event_time INTEGER NOT NULL,
          frozen_at INTEGER NOT NULL,
          state TEXT NOT NULL,
          candidate_json TEXT NOT NULL,
          outcomes_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (version_id, event_time),
          FOREIGN KEY (version_id) REFERENCES signal_versions(id)
        );

        CREATE INDEX IF NOT EXISTS idx_paper_cases_version_time
          ON paper_cases (version_id, event_time DESC);
        """
      )

  def set_metadata(self, key: str, value: str) -> None:
    with self._write_lock, self._connect() as connection:
      connection.execute(
        "INSERT INTO metadata(key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
      )

  def get_metadata(self, key: str) -> Optional[str]:
    with self._connect() as connection:
      row = connection.execute("SELECT value FROM metadata WHERE key = ?", (key,)).fetchone()
    return str(row["value"]) if row else None

  def upsert_calendar_events(self, events: Sequence[Dict[str, Any]], ingested_at: int) -> Dict[str, int]:
    if not events:
      return {"inserted": 0, "updated": 0, "total": self.calendar_count()}

    keys = [(int(event["id"]), int(event["time"])) for event in events]
    existing: Dict[tuple[int, int], sqlite3.Row] = {}
    with self._write_lock, self._connect() as connection:
      for offset in range(0, len(keys), 400):
        chunk = keys[offset:offset + 400]
        placeholders = ",".join(["(?, ?)"] * len(chunk))
        values = [value for pair in chunk for value in pair]
        rows = connection.execute(
          f"SELECT * FROM calendar_events WHERE (id, time) IN ({placeholders})",
          values,
        ).fetchall()
        existing.update({(int(row["id"]), int(row["time"])): row for row in rows})

      inserted = 0
      updated = 0
      for event in events:
        key = (int(event["id"]), int(event["time"]))
        old = existing.get(key)
        comparable = (
          str(event.get("countryCode", "")),
          str(event.get("currency", "")),
          str(event.get("title", "")),
          str(event.get("impact", "")),
          event.get("actual"),
          event.get("forecast"),
          event.get("previous"),
        )
        if old is None:
          inserted += 1
        else:
          previous = (
            str(old["country_code"]),
            str(old["currency"]),
            str(old["title"]),
            str(old["impact"]),
            old["actual"],
            old["forecast"],
            old["previous"],
          )
          if comparable != previous:
            updated += 1

        connection.execute(
          """
          INSERT INTO calendar_events(
            id, time, country_code, currency, title, impact,
            actual, forecast, previous, ingested_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id, time) DO UPDATE SET
            country_code = excluded.country_code,
            currency = excluded.currency,
            title = excluded.title,
            impact = excluded.impact,
            actual = excluded.actual,
            forecast = excluded.forecast,
            previous = excluded.previous,
            ingested_at = excluded.ingested_at
          """,
          (
            key[0],
            key[1],
            comparable[0],
            comparable[1],
            comparable[2],
            comparable[3],
            comparable[4],
            comparable[5],
            comparable[6],
            ingested_at,
          ),
        )

      connection.execute(
        "INSERT INTO metadata(key, value) VALUES ('last_calendar_ingest_at', ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (str(ingested_at),),
      )
      total = int(connection.execute("SELECT COUNT(*) FROM calendar_events").fetchone()[0])

    return {"inserted": inserted, "updated": updated, "total": total}

  def calendar_count(self) -> int:
    with self._connect() as connection:
      return int(connection.execute("SELECT COUNT(*) FROM calendar_events").fetchone()[0])

  def calendar_coverage(self, currencies: Optional[Sequence[str]] = None) -> Dict[str, Any]:
    clauses: List[str] = []
    params: List[Any] = []
    if currencies:
      normalized = [currency.upper() for currency in currencies]
      clauses.append(f"currency IN ({','.join(['?'] * len(normalized))})")
      params.extend(normalized)
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    with self._connect() as connection:
      row = connection.execute(
        f"SELECT COUNT(*) AS count, MIN(time) AS earliest, MAX(time) AS latest "
        f"FROM calendar_events{where}",
        params,
      ).fetchone()
      currency_rows = connection.execute(
        f"SELECT currency, COUNT(*) AS count, MIN(time) AS earliest, MAX(time) AS latest "
        f"FROM calendar_events{where} GROUP BY currency ORDER BY currency",
        params,
      ).fetchall()
    return {
      "count": int(row["count"] or 0),
      "earliest": int(row["earliest"]) if row["earliest"] is not None else None,
      "latest": int(row["latest"]) if row["latest"] is not None else None,
      "currencies": [
        {
          "currency": str(item["currency"]),
          "count": int(item["count"]),
          "earliest": int(item["earliest"]),
          "latest": int(item["latest"]),
        }
        for item in currency_rows
      ],
    }

  def query_calendar(
    self,
    from_time: Optional[int] = None,
    to_time: Optional[int] = None,
    impacts: Optional[Iterable[str]] = None,
    countries: Optional[Iterable[str]] = None,
    currencies: Optional[Iterable[str]] = None,
  ) -> List[Dict[str, Any]]:
    clauses: List[str] = []
    params: List[Any] = []
    if from_time is not None:
      clauses.append("time >= ?")
      params.append(from_time)
    if to_time is not None:
      clauses.append("time <= ?")
      params.append(to_time)
    for column, values in (
      ("impact", impacts),
      ("country_code", countries),
      ("currency", currencies),
    ):
      normalized = [str(value) for value in values] if values else []
      if normalized:
        clauses.append(f"{column} IN ({','.join(['?'] * len(normalized))})")
        params.extend(normalized)
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    with self._connect() as connection:
      rows = connection.execute(
        "SELECT id, time, country_code, currency, title, impact, actual, forecast, previous "
        f"FROM calendar_events{where} ORDER BY time, currency, title, id",
        params,
      ).fetchall()
    return [
      {
        "id": int(row["id"]),
        "time": int(row["time"]),
        "countryCode": str(row["country_code"]),
        "currency": str(row["currency"]),
        "title": str(row["title"]),
        "impact": str(row["impact"]),
        "actual": row["actual"],
        "forecast": row["forecast"],
        "previous": row["previous"],
      }
      for row in rows
    ]

  def capture_release_observations(self, activated_at: int, observed_at: int) -> int:
    """Freeze first-seen released values after the forward ledger was activated."""
    with self._write_lock, self._connect() as connection:
      cursor = connection.execute(
        """
        INSERT OR IGNORE INTO release_observations(
          id, time, country_code, currency, title, impact,
          actual, forecast, previous, first_seen_at
        )
        SELECT id, time, country_code, currency, title, impact,
               actual, forecast, previous, ?
        FROM calendar_events
        WHERE time >= ? AND time <= ?
          AND actual IS NOT NULL
          AND TRIM(actual) NOT IN ('', '-', '—')
        """,
        (observed_at, activated_at, observed_at),
      )
      return int(cursor.rowcount)

  def query_release_observations(
    self,
    from_time: Optional[int] = None,
    currencies: Optional[Sequence[str]] = None,
  ) -> List[Dict[str, Any]]:
    clauses: List[str] = []
    params: List[Any] = []
    if from_time is not None:
      clauses.append("time >= ?")
      params.append(from_time)
    if currencies:
      normalized = [currency.upper() for currency in currencies]
      clauses.append(f"currency IN ({','.join(['?'] * len(normalized))})")
      params.extend(normalized)
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    with self._connect() as connection:
      rows = connection.execute(
        "SELECT id, time, country_code, currency, title, impact, actual, forecast, previous, first_seen_at "
        f"FROM release_observations{where} ORDER BY time, currency, title, id",
        params,
      ).fetchall()
    return [
      {
        "id": int(row["id"]),
        "time": int(row["time"]),
        "countryCode": str(row["country_code"]),
        "currency": str(row["currency"]),
        "title": str(row["title"]),
        "impact": str(row["impact"]),
        "actual": row["actual"],
        "forecast": row["forecast"],
        "previous": row["previous"],
        "firstSeenAt": int(row["first_seen_at"]),
      }
      for row in rows
    ]

  def save_paper_case(
    self,
    version_id: str,
    event_time: int,
    frozen_at: int,
    state: str,
    candidate: Dict[str, Any],
    outcomes: Dict[str, Any],
    updated_at: int,
  ) -> bool:
    candidate_json = json.dumps(candidate, sort_keys=True, separators=(",", ":"))
    outcomes_json = json.dumps(outcomes, sort_keys=True, separators=(",", ":"))
    with self._write_lock, self._connect() as connection:
      cursor = connection.execute(
        """
        INSERT OR IGNORE INTO paper_cases(
          version_id, event_time, frozen_at, state, candidate_json, outcomes_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (version_id, event_time, frozen_at, state, candidate_json, outcomes_json, updated_at),
      )
      return int(cursor.rowcount) > 0

  def update_paper_case(
    self,
    version_id: str,
    event_time: int,
    state: str,
    outcomes: Dict[str, Any],
    updated_at: int,
  ) -> None:
    outcomes_json = json.dumps(outcomes, sort_keys=True, separators=(",", ":"))
    with self._write_lock, self._connect() as connection:
      connection.execute(
        "UPDATE paper_cases SET state = ?, outcomes_json = ?, updated_at = ? "
        "WHERE version_id = ? AND event_time = ?",
        (state, outcomes_json, updated_at, version_id, event_time),
      )

  def query_paper_cases(self, version_id: str) -> List[Dict[str, Any]]:
    with self._connect() as connection:
      rows = connection.execute(
        "SELECT version_id, event_time, frozen_at, state, candidate_json, outcomes_json, updated_at "
        "FROM paper_cases WHERE version_id = ? ORDER BY event_time",
        (version_id,),
      ).fetchall()
    return [
      {
        "versionId": str(row["version_id"]),
        "eventTime": int(row["event_time"]),
        "frozenAt": int(row["frozen_at"]),
        "state": str(row["state"]),
        "candidate": json.loads(row["candidate_json"]),
        "outcomes": json.loads(row["outcomes_json"]),
        "updatedAt": int(row["updated_at"]),
      }
      for row in rows
    ]

  def upsert_candles(self, symbol: str, timeframe: str, candles: Sequence[Dict[str, Any]]) -> None:
    if not candles:
      return
    rows = [
      (
        symbol.upper(),
        timeframe.upper(),
        int(candle["time"]),
        float(candle["open"]),
        float(candle["high"]),
        float(candle["low"]),
        float(candle["close"]),
        int(candle.get("volume", 0)),
      )
      for candle in candles
    ]
    with self._write_lock, self._connect() as connection:
      connection.executemany(
        """
        INSERT INTO candle_cache(symbol, timeframe, time, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(symbol, timeframe, time) DO UPDATE SET
          open = excluded.open,
          high = excluded.high,
          low = excluded.low,
          close = excluded.close,
          volume = excluded.volume
        """,
        rows,
      )

  def query_candles(self, symbol: str, timeframe: str, from_time: int, to_time: int) -> List[Dict[str, Any]]:
    with self._connect() as connection:
      rows = connection.execute(
        "SELECT time, open, high, low, close, volume FROM candle_cache "
        "WHERE symbol = ? AND timeframe = ? AND time >= ? AND time <= ? ORDER BY time",
        (symbol.upper(), timeframe.upper(), from_time, to_time),
      ).fetchall()
    return [dict(row) for row in rows]

  def ensure_signal_version(
    self,
    version_id: str,
    created_at: int,
    configuration: Dict[str, Any],
    configuration_hash: str,
  ) -> None:
    configuration_json = json.dumps(configuration, sort_keys=True, separators=(",", ":"))
    with self._write_lock, self._connect() as connection:
      existing = connection.execute(
        "SELECT configuration_hash FROM signal_versions WHERE id = ?",
        (version_id,),
      ).fetchone()
      if existing and str(existing["configuration_hash"]) != configuration_hash:
        raise ValueError(f"Signal version {version_id} already exists with a different configuration")
      connection.execute(
        "INSERT OR IGNORE INTO signal_versions(id, created_at, configuration_json, configuration_hash) "
        "VALUES (?, ?, ?, ?)",
        (version_id, created_at, configuration_json, configuration_hash),
      )

  def save_backtest_run(
    self,
    run_id: str,
    version_id: str,
    dataset_fingerprint: str,
    created_at: int,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
  ) -> None:
    result_json = json.dumps(result, sort_keys=True, separators=(",", ":")) if result is not None else None
    with self._write_lock, self._connect() as connection:
      connection.execute(
        """
        INSERT INTO backtest_runs(
          id, version_id, dataset_fingerprint, created_at, status, result_json, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          dataset_fingerprint = excluded.dataset_fingerprint,
          status = excluded.status,
          result_json = excluded.result_json,
          error = excluded.error
        """,
        (run_id, version_id, dataset_fingerprint, created_at, status, result_json, error),
      )

  def get_backtest_run(self, run_id: str) -> Optional[Dict[str, Any]]:
    with self._connect() as connection:
      row = connection.execute("SELECT * FROM backtest_runs WHERE id = ?", (run_id,)).fetchone()
    return self._deserialize_run(row) if row else None

  def latest_backtest_run(self, version_id: str) -> Optional[Dict[str, Any]]:
    with self._connect() as connection:
      row = connection.execute(
        "SELECT * FROM backtest_runs WHERE version_id = ? ORDER BY created_at DESC LIMIT 1",
        (version_id,),
      ).fetchone()
    return self._deserialize_run(row) if row else None

  def mark_unfinished_runs_failed(self, reason: str) -> int:
    with self._write_lock, self._connect() as connection:
      cursor = connection.execute(
        "UPDATE backtest_runs SET status = 'failed', error = ? WHERE status IN ('queued', 'running')",
        (reason,),
      )
      return int(cursor.rowcount)

  @staticmethod
  def _deserialize_run(row: sqlite3.Row) -> Dict[str, Any]:
    return {
      "id": str(row["id"]),
      "versionId": str(row["version_id"]),
      "datasetFingerprint": str(row["dataset_fingerprint"]),
      "createdAt": int(row["created_at"]),
      "status": str(row["status"]),
      "result": json.loads(row["result_json"]) if row["result_json"] else None,
      "error": row["error"],
    }
