from __future__ import annotations

import json
import hashlib
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
          ea_completed_at INTEGER,
          bridge_acknowledged_at INTEGER,
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

        CREATE TABLE IF NOT EXISTS fms_sequences (
          kind TEXT PRIMARY KEY,
          next_value INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS fms_experiments (
          id TEXT PRIMARY KEY,
          friendly_name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          status TEXT NOT NULL,
          configuration_json TEXT NOT NULL,
          configuration_hash TEXT NOT NULL,
          catalog_snapshot_json TEXT NOT NULL,
          dataset_fingerprint TEXT NOT NULL,
          result_json TEXT,
          error TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_fms_experiments_created
          ON fms_experiments (created_at DESC);

        CREATE TABLE IF NOT EXISTS fms_candidates (
          id TEXT PRIMARY KEY,
          experiment_id TEXT NOT NULL UNIQUE,
          friendly_name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          failed_gate_acknowledged INTEGER NOT NULL,
          checks_json TEXT NOT NULL,
          configuration_hash TEXT NOT NULL,
          dataset_fingerprint TEXT NOT NULL,
          FOREIGN KEY (experiment_id) REFERENCES fms_experiments(id)
        );

        CREATE INDEX IF NOT EXISTS idx_fms_candidates_created
          ON fms_candidates (created_at DESC);

        CREATE TABLE IF NOT EXISTS fms_qualification_audits (
          id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL, qualification_version TEXT NOT NULL,
          configuration_hash TEXT NOT NULL, dataset_fingerprint TEXT NOT NULL, method_hash TEXT NOT NULL,
          created_at INTEGER NOT NULL, result_json TEXT NOT NULL,
          UNIQUE(experiment_id, qualification_version, configuration_hash, dataset_fingerprint, method_hash)
        );
        CREATE TABLE IF NOT EXISTS fms_sweeps (id TEXT PRIMARY KEY, manifest_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, status TEXT NOT NULL, manifest_json TEXT NOT NULL, error TEXT);
        CREATE TABLE IF NOT EXISTS fms_sweep_entries (sweep_id TEXT NOT NULL, entry_id TEXT NOT NULL, state TEXT NOT NULL, experiment_id TEXT, audit_id TEXT, error TEXT, PRIMARY KEY(sweep_id, entry_id));
        CREATE TABLE IF NOT EXISTS fms_live_decisions (
          model_id TEXT NOT NULL,
          market TEXT NOT NULL,
          pattern_id TEXT NOT NULL,
          event_time INTEGER NOT NULL,
          first_decided_at INTEGER NOT NULL,
          status TEXT NOT NULL,
          direction TEXT,
          prospective_eligible INTEGER NOT NULL DEFAULT 0,
          eligibility_reason TEXT NOT NULL DEFAULT 'legacy_unverified',
          assessment_json TEXT NOT NULL,
          signal_json TEXT,
          PRIMARY KEY (model_id, market, pattern_id, event_time)
        );
        CREATE INDEX IF NOT EXISTS idx_fms_live_decisions_recent
          ON fms_live_decisions (first_decided_at DESC);
        CREATE TABLE IF NOT EXISTS fms_live_execution_observations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          model_id TEXT NOT NULL,
          market TEXT NOT NULL,
          pattern_id TEXT NOT NULL,
          event_time INTEGER NOT NULL,
          observed_at INTEGER NOT NULL,
          state TEXT NOT NULL,
          result_r REAL,
          snapshot_hash TEXT NOT NULL,
          signal_json TEXT NOT NULL,
          quote_json TEXT,
          UNIQUE (model_id, market, pattern_id, event_time, snapshot_hash)
        );
        CREATE INDEX IF NOT EXISTS idx_fms_live_execution_latest
          ON fms_live_execution_observations
          (model_id, market, pattern_id, event_time, observed_at DESC, id DESC);
        CREATE TABLE IF NOT EXISTS fms_demo_deals (
          account_login INTEGER NOT NULL,
          deal_ticket INTEGER NOT NULL,
          signal_tag TEXT NOT NULL,
          captured_at INTEGER NOT NULL,
          deal_time INTEGER NOT NULL,
          symbol TEXT NOT NULL,
          position_id INTEGER,
          entry_type INTEGER,
          deal_type INTEGER,
          volume REAL NOT NULL,
          price REAL NOT NULL,
          commission REAL NOT NULL,
          swap REAL NOT NULL,
          profit REAL NOT NULL,
          fee REAL NOT NULL,
          comment TEXT NOT NULL,
          deal_json TEXT NOT NULL,
          PRIMARY KEY (account_login, deal_ticket)
        );
        CREATE INDEX IF NOT EXISTS idx_fms_demo_deals_signal
          ON fms_demo_deals (signal_tag, deal_time, deal_ticket);
        """
      )
      decision_columns = {
        str(row["name"]) for row in connection.execute("PRAGMA table_info(fms_live_decisions)").fetchall()
      }
      if "prospective_eligible" not in decision_columns:
        connection.execute(
          "ALTER TABLE fms_live_decisions ADD COLUMN prospective_eligible INTEGER NOT NULL DEFAULT 0"
        )
      if "eligibility_reason" not in decision_columns:
        connection.execute(
          "ALTER TABLE fms_live_decisions ADD COLUMN eligibility_reason TEXT NOT NULL DEFAULT 'legacy_unverified'"
        )
      observation_columns = {
        str(row["name"]) for row in connection.execute("PRAGMA table_info(release_observations)").fetchall()
      }
      if "ea_completed_at" not in observation_columns:
        connection.execute("ALTER TABLE release_observations ADD COLUMN ea_completed_at INTEGER")
      if "bridge_acknowledged_at" not in observation_columns:
        connection.execute("ALTER TABLE release_observations ADD COLUMN bridge_acknowledged_at INTEGER")

  def set_metadata(self, key: str, value: str) -> None:
    with self._write_lock, self._connect() as connection:
      connection.execute(
        "INSERT INTO metadata(key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
      )

  def record_fms_live_decision(
    self,
    model_id: str,
    market: str,
    pattern_id: str,
    event_time: int,
    first_decided_at: int,
    status: str,
    direction: Optional[str],
    assessment: Dict[str, Any],
    signal: Optional[Dict[str, Any]],
    prospective_eligible: bool = False,
    eligibility_reason: str = "legacy_unverified",
  ) -> bool:
    with self._write_lock, self._connect() as connection:
      cursor = connection.execute(
        "INSERT OR IGNORE INTO fms_live_decisions(model_id, market, pattern_id, event_time, first_decided_at, status, direction, prospective_eligible, eligibility_reason, assessment_json, signal_json) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
          model_id, market.upper(), pattern_id, int(event_time), int(first_decided_at), status, direction,
          1 if prospective_eligible else 0, eligibility_reason,
          json.dumps(assessment, sort_keys=True, separators=(",", ":")),
          None if signal is None else json.dumps(signal, sort_keys=True, separators=(",", ":")),
        ),
      )
      return cursor.rowcount > 0

  def list_fms_live_decisions(self, market: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    bounded_limit = max(1, min(int(limit), 500))
    with self._connect() as connection:
      if market:
        rows = connection.execute(
          "SELECT * FROM fms_live_decisions WHERE market = ? ORDER BY first_decided_at DESC, event_time DESC LIMIT ?",
          (market.upper(), bounded_limit),
        ).fetchall()
      else:
        rows = connection.execute(
          "SELECT * FROM fms_live_decisions ORDER BY first_decided_at DESC, event_time DESC LIMIT ?",
          (bounded_limit,),
        ).fetchall()
    return [{
      "modelId": str(row["model_id"]),
      "market": str(row["market"]),
      "patternId": str(row["pattern_id"]),
      "eventTime": int(row["event_time"]),
      "firstDecidedAt": int(row["first_decided_at"]),
      "status": str(row["status"]),
      "direction": None if row["direction"] is None else str(row["direction"]),
      "prospectiveEligible": bool(row["prospective_eligible"]),
      "eligibilityReason": str(row["eligibility_reason"]),
      "assessment": json.loads(row["assessment_json"]),
      "signal": None if row["signal_json"] is None else json.loads(row["signal_json"]),
    } for row in rows]

  def record_fms_live_execution_observation(
    self,
    model_id: str,
    market: str,
    pattern_id: str,
    event_time: int,
    observed_at: int,
    signal: Dict[str, Any],
    quote: Optional[Dict[str, Any]] = None,
  ) -> bool:
    """Append a changed forward-paper lifecycle snapshot without rewriting history."""
    with self._write_lock, self._connect() as connection:
      quote_json = None if quote is None else json.dumps(quote, sort_keys=True, separators=(",", ":"))
      if quote_json is None:
        prior_quote = connection.execute(
          "SELECT quote_json FROM fms_live_execution_observations "
          "WHERE model_id = ? AND market = ? AND pattern_id = ? AND event_time = ? AND quote_json IS NOT NULL "
          "ORDER BY observed_at DESC, id DESC LIMIT 1",
          (model_id, market.upper(), pattern_id, int(event_time)),
        ).fetchone()
        quote_json = None if prior_quote is None else str(prior_quote["quote_json"])
      signal_json = json.dumps(signal, sort_keys=True, separators=(",", ":"))
      hash_signal = json.loads(signal_json)
      if isinstance(hash_signal.get("pendingLifecycle"), dict):
        hash_signal["pendingLifecycle"].pop("asOf", None)
      stable_signal_json = json.dumps(hash_signal, sort_keys=True, separators=(",", ":"))
      snapshot_hash = hashlib.sha256(f"{stable_signal_json}|{quote_json or ''}".encode("utf-8")).hexdigest()
      state = str(signal.get("outcomeStatus") or "unknown")
      result = signal.get("resultR")
      result_r = None if result is None else float(result)
      cursor = connection.execute(
        "INSERT OR IGNORE INTO fms_live_execution_observations("
        "model_id, market, pattern_id, event_time, observed_at, state, result_r, snapshot_hash, signal_json, quote_json"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
          model_id, market.upper(), pattern_id, int(event_time), int(observed_at), state,
          result_r, snapshot_hash, signal_json, quote_json,
        ),
      )
      if cursor.rowcount > 0:
        connection.execute(
          "INSERT INTO metadata(key, value) VALUES ('fms_live_execution_revision', ?) "
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          (f"{int(observed_at)}:{snapshot_hash}",),
        )
      return cursor.rowcount > 0

  def list_fms_live_execution_cases(
    self,
    market: Optional[str] = None,
    limit: int = 500,
  ) -> List[Dict[str, Any]]:
    """Return the latest lifecycle snapshot while retaining the append-only audit trail."""
    bounded_limit = max(1, min(int(limit), 2000))
    market_clause = "AND market = ?" if market else ""
    params: tuple[Any, ...] = ((market.upper(), bounded_limit) if market else (bounded_limit,))
    with self._connect() as connection:
      rows = connection.execute(
        f"""
        SELECT * FROM (
          SELECT observation.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY model_id, market, pattern_id, event_time
                   ORDER BY observed_at DESC, id DESC
                 ) AS row_number
          FROM fms_live_execution_observations AS observation
          WHERE 1 = 1 {market_clause}
        ) WHERE row_number = 1
        ORDER BY observed_at DESC, event_time DESC
        LIMIT ?
        """,
        params,
      ).fetchall()
    return [{
      "modelId": str(row["model_id"]),
      "market": str(row["market"]),
      "patternId": str(row["pattern_id"]),
      "eventTime": int(row["event_time"]),
      "observedAt": int(row["observed_at"]),
      "state": str(row["state"]),
      "resultR": None if row["result_r"] is None else float(row["result_r"]),
      "signal": json.loads(row["signal_json"]),
      "entryQuote": None if row["quote_json"] is None else json.loads(row["quote_json"]),
    } for row in rows]

  def count_fms_live_execution_observations(
    self,
    model_id: str,
    market: str,
    pattern_id: str,
    event_time: int,
  ) -> int:
    with self._connect() as connection:
      row = connection.execute(
        "SELECT COUNT(*) AS count FROM fms_live_execution_observations "
        "WHERE model_id = ? AND market = ? AND pattern_id = ? AND event_time = ?",
        (model_id, market.upper(), pattern_id, int(event_time)),
      ).fetchone()
    return int(row["count"])

  def record_fms_demo_deal(
    self,
    account_login: int,
    signal_tag: str,
    captured_at: int,
    deal: Dict[str, Any],
  ) -> bool:
    with self._write_lock, self._connect() as connection:
      cursor = connection.execute(
        "INSERT OR IGNORE INTO fms_demo_deals("
        "account_login, deal_ticket, signal_tag, captured_at, deal_time, symbol, position_id, entry_type, deal_type, "
        "volume, price, commission, swap, profit, fee, comment, deal_json"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
          int(account_login), int(deal["ticket"]), signal_tag, int(captured_at), int(deal.get("time") or 0),
          str(deal.get("symbol") or "").upper(), int(deal.get("position_id") or 0) or None,
          None if deal.get("entry") is None else int(deal["entry"]),
          None if deal.get("type") is None else int(deal["type"]),
          float(deal.get("volume") or 0), float(deal.get("price") or 0),
          float(deal.get("commission") or 0), float(deal.get("swap") or 0),
          float(deal.get("profit") or 0), float(deal.get("fee") or 0),
          str(deal.get("comment") or ""),
          json.dumps(deal, sort_keys=True, separators=(",", ":"), default=str),
        ),
      )
      return cursor.rowcount > 0

  def list_fms_demo_deals(self, signal_tag: Optional[str] = None, limit: int = 5000) -> List[Dict[str, Any]]:
    bounded_limit = max(1, min(int(limit), 20000))
    with self._connect() as connection:
      if signal_tag:
        rows = connection.execute(
          "SELECT * FROM fms_demo_deals WHERE signal_tag = ? ORDER BY deal_time, deal_ticket LIMIT ?",
          (signal_tag, bounded_limit),
        ).fetchall()
      else:
        rows = connection.execute(
          "SELECT * FROM fms_demo_deals ORDER BY deal_time DESC, deal_ticket DESC LIMIT ?",
          (bounded_limit,),
        ).fetchall()
    return [{
      "accountLogin": int(row["account_login"]),
      "dealTicket": int(row["deal_ticket"]),
      "signalTag": str(row["signal_tag"]),
      "capturedAt": int(row["captured_at"]),
      "time": int(row["deal_time"]),
      "symbol": str(row["symbol"]),
      "positionId": None if row["position_id"] is None else int(row["position_id"]),
      "entryType": None if row["entry_type"] is None else int(row["entry_type"]),
      "dealType": None if row["deal_type"] is None else int(row["deal_type"]),
      "volume": float(row["volume"]),
      "price": float(row["price"]),
      "commission": float(row["commission"]),
      "swap": float(row["swap"]),
      "profit": float(row["profit"]),
      "fee": float(row["fee"]),
      "comment": str(row["comment"]),
      "deal": json.loads(row["deal_json"]),
    } for row in rows]

  def get_metadata(self, key: str) -> Optional[str]:
    with self._connect() as connection:
      row = connection.execute("SELECT value FROM metadata WHERE key = ?", (key,)).fetchone()
    return str(row["value"]) if row else None

  def metadata_values(self, prefix: str) -> List[str]:
    with self._connect() as connection:
      rows = connection.execute(
        "SELECT value FROM metadata WHERE key LIKE ?", (f"{prefix}%",)
      ).fetchall()
    return [str(row["value"]) for row in rows]

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

  def capture_release_observations(
    self,
    activated_at: int,
    observed_at: int,
    released_through: Optional[int] = None,
    ea_completed_at: Optional[int] = None,
  ) -> int:
    """Freeze first-seen released values after the forward ledger was activated."""
    release_cutoff = observed_at if released_through is None else released_through
    with self._write_lock, self._connect() as connection:
      cursor = connection.execute(
        """
        INSERT OR IGNORE INTO release_observations(
          id, time, country_code, currency, title, impact,
          actual, forecast, previous, first_seen_at, ea_completed_at, bridge_acknowledged_at
        )
        SELECT id, time, country_code, currency, title, impact,
               actual, forecast, previous, ?, ?, ?
        FROM calendar_events
        WHERE time >= ? AND time <= ?
          AND actual IS NOT NULL
          AND TRIM(actual) NOT IN ('', '-', '—')
        """,
        (observed_at, ea_completed_at, observed_at, activated_at, release_cutoff),
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
        "SELECT id, time, country_code, currency, title, impact, actual, forecast, previous, first_seen_at, ea_completed_at, bridge_acknowledged_at "
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
        "eaCompletedAt": None if row["ea_completed_at"] is None else int(row["ea_completed_at"]),
        "bridgeAcknowledgedAt": None if row["bridge_acknowledged_at"] is None else int(row["bridge_acknowledged_at"]),
      }
      for row in rows
    ]

  def release_observation_revision(self, currencies: Sequence[str]) -> str:
    normalized = [currency.upper() for currency in currencies]
    if not normalized:
      return "0:0:0"
    placeholders = ",".join(["?"] * len(normalized))
    with self._connect() as connection:
      row = connection.execute(
        f"SELECT COUNT(*) AS count, MAX(first_seen_at) AS latest_seen, MAX(time) AS latest_release "
        f"FROM release_observations WHERE currency IN ({placeholders})",
        normalized,
      ).fetchone()
    return f"{int(row['count'])}:{int(row['latest_seen'] or 0)}:{int(row['latest_release'] or 0)}"

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

  def candle_coverage(self, symbol: str, timeframe: str) -> Dict[str, Optional[int]]:
    with self._connect() as connection:
      row = connection.execute(
        "SELECT COUNT(*) AS count, MIN(time) AS earliest, MAX(time) AS latest "
        "FROM candle_cache WHERE symbol = ? AND timeframe = ?",
        (symbol.upper(), timeframe.upper()),
      ).fetchone()
    return {
      "count": int(row["count"] or 0),
      "earliest": None if row["earliest"] is None else int(row["earliest"]),
      "latest": None if row["latest"] is None else int(row["latest"]),
    }

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

  def latest_backtest_run_header(self, version_id: str) -> Optional[Dict[str, Any]]:
    """Return run identity without decoding the potentially very large result JSON."""
    with self._connect() as connection:
      row = connection.execute(
        "SELECT id, version_id, dataset_fingerprint, created_at, status, error "
        "FROM backtest_runs WHERE version_id = ? ORDER BY created_at DESC LIMIT 1",
        (version_id,),
      ).fetchone()
    if row is None:
      return None
    return {
      "id": str(row["id"]),
      "versionId": str(row["version_id"]),
      "datasetFingerprint": str(row["dataset_fingerprint"]),
      "createdAt": int(row["created_at"]),
      "status": str(row["status"]),
      "error": row["error"],
    }

  def mark_unfinished_runs_failed(self, reason: str) -> int:
    with self._write_lock, self._connect() as connection:
      cursor = connection.execute(
        "UPDATE backtest_runs SET status = 'failed', error = ? WHERE status IN ('queued', 'running')",
        (reason,),
      )
      return int(cursor.rowcount)

  def allocate_fms_id(self, kind: str, market: str = "EURUSD") -> str:
    normalized = kind.upper()
    if normalized not in {"E", "C", "M"}:
      raise ValueError(f"Unsupported FMS identifier kind: {kind}")
    normalized_market = market.upper()
    if normalized_market not in {
      "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD", "USDCHF",
    }:
      raise ValueError(f"Unsupported FMS market: {market}")
    # EURUSD retains its original sequence key and identifiers; new markets are isolated.
    sequence_key = normalized if normalized_market == "EURUSD" else f"{normalized_market}:{normalized}"
    with self._write_lock, self._connect() as connection:
      connection.execute("BEGIN IMMEDIATE")
      connection.execute(
        "INSERT OR IGNORE INTO fms_sequences(kind, next_value) VALUES (?, 1)",
        (sequence_key,),
      )
      row = connection.execute(
        "SELECT next_value FROM fms_sequences WHERE kind = ?", (sequence_key,)
      ).fetchone()
      value = int(row["next_value"])
      connection.execute(
        "UPDATE fms_sequences SET next_value = ? WHERE kind = ?",
        (value + 1, sequence_key),
      )
    return f"FMS-{normalized_market}-H4-{normalized}{value:03d}"

  def create_fms_experiment(
    self,
    experiment_id: str,
    friendly_name: str,
    created_at: int,
    configuration: Dict[str, Any],
    configuration_hash: str,
    catalog_snapshot: Dict[str, Any],
    dataset_fingerprint: str,
  ) -> None:
    with self._write_lock, self._connect() as connection:
      connection.execute(
        """
        INSERT INTO fms_experiments(
          id, friendly_name, created_at, status, configuration_json,
          configuration_hash, catalog_snapshot_json, dataset_fingerprint
        ) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?)
        """,
        (
          experiment_id,
          friendly_name,
          created_at,
          json.dumps(configuration, sort_keys=True, separators=(",", ":")),
          configuration_hash,
          json.dumps(catalog_snapshot, sort_keys=True, separators=(",", ":")),
          dataset_fingerprint,
        ),
      )

  def update_fms_experiment(
    self,
    experiment_id: str,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
  ) -> None:
    if status not in {"queued", "running", "completed", "failed"}:
      raise ValueError(f"Unsupported FMS experiment status: {status}")
    result_json = json.dumps(result, sort_keys=True, separators=(",", ":")) if result is not None else None
    with self._write_lock, self._connect() as connection:
      connection.execute(
        "UPDATE fms_experiments SET status = ?, result_json = ?, error = ? WHERE id = ?",
        (status, result_json, error, experiment_id),
      )

  def get_fms_experiment(self, experiment_id: str) -> Optional[Dict[str, Any]]:
    with self._connect() as connection:
      row = connection.execute(
        "SELECT * FROM fms_experiments WHERE id = ?", (experiment_id,)
      ).fetchone()
    return self._deserialize_fms_experiment(row) if row else None

  def list_fms_experiments(self, limit: int = 100) -> List[Dict[str, Any]]:
    with self._connect() as connection:
      rows = connection.execute(
        "SELECT * FROM fms_experiments ORDER BY created_at DESC, id DESC LIMIT ?",
        (max(1, min(limit, 500)),),
      ).fetchall()
    return [self._deserialize_fms_experiment(row) for row in rows]

  def list_fms_experiment_headers(
    self, market: str = "EURUSD", limit: int = 500,
  ) -> List[Dict[str, Any]]:
    """List lightweight Workbench rows without decoding complete result artifacts."""
    normalized_market = market.upper()
    with self._connect() as connection:
      rows = connection.execute(
        "SELECT id, friendly_name, created_at, status, "
        "configuration_hash, catalog_snapshot_json, dataset_fingerprint, error "
        "FROM fms_experiments "
        "WHERE COALESCE(json_extract(configuration_json, '$.market'), 'EURUSD') = ? "
        "ORDER BY created_at DESC, id DESC LIMIT ?",
        (normalized_market, max(1, min(limit, 500))),
      ).fetchall()
    headers: List[Dict[str, Any]] = []
    for row in rows:
      snapshot = json.loads(row["catalog_snapshot_json"])
      headers.append({
        "id": str(row["id"]),
        "friendlyName": str(row["friendly_name"]),
        "createdAt": int(row["created_at"]),
        "status": str(row["status"]),
        "configurationHash": str(row["configuration_hash"]),
        "catalogSnapshot": {
          "id": str(snapshot.get("id", "")),
          "label": str(snapshot.get("label", "Economic setup")),
        },
        "datasetFingerprint": str(row["dataset_fingerprint"]),
        "error": row["error"],
      })
    return headers

  def find_completed_fms_experiment(
    self, configuration_hash: str, dataset_fingerprint: str
  ) -> Optional[Dict[str, Any]]:
    with self._connect() as connection:
      row = connection.execute(
        """
        SELECT * FROM fms_experiments
        WHERE configuration_hash = ? AND dataset_fingerprint = ?
          AND status = 'completed' AND result_json IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
        """,
        (configuration_hash, dataset_fingerprint),
      ).fetchone()
    return self._deserialize_fms_experiment(row) if row else None

  def mark_unfinished_fms_experiments_failed(self, reason: str) -> int:
    with self._write_lock, self._connect() as connection:
      cursor = connection.execute(
        "UPDATE fms_experiments SET status = 'failed', error = ? "
        "WHERE status IN ('queued', 'running')",
        (reason,),
      )
      return int(cursor.rowcount)

  def create_fms_candidate(
    self,
    candidate_id: str,
    experiment_id: str,
    friendly_name: str,
    created_at: int,
    failed_gate_acknowledged: bool,
    checks: Dict[str, bool],
    configuration_hash: str,
    dataset_fingerprint: str,
  ) -> None:
    with self._write_lock, self._connect() as connection:
      connection.execute(
        """
        INSERT INTO fms_candidates(
          id, experiment_id, friendly_name, created_at,
          failed_gate_acknowledged, checks_json, configuration_hash,
          dataset_fingerprint
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
          candidate_id,
          experiment_id,
          friendly_name,
          created_at,
          int(failed_gate_acknowledged),
          json.dumps(checks, sort_keys=True, separators=(",", ":")),
          configuration_hash,
          dataset_fingerprint,
        ),
      )

  def list_fms_candidates(self) -> List[Dict[str, Any]]:
    with self._connect() as connection:
      rows = connection.execute(
        """
        SELECT candidate.*, experiment.status AS experiment_status,
          experiment.result_json AS experiment_result_json,
          experiment.configuration_json AS experiment_configuration_json,
          experiment.catalog_snapshot_json AS experiment_catalog_snapshot_json
        FROM fms_candidates AS candidate
        JOIN fms_experiments AS experiment ON experiment.id = candidate.experiment_id
        ORDER BY candidate.created_at DESC, candidate.id DESC
        """
      ).fetchall()
    return [self._deserialize_fms_candidate(row) for row in rows]

  def get_fms_qualification_audit(self, experiment_id: str, version: str, configuration_hash: str, dataset_fingerprint: str, method_hash: str) -> Optional[Dict[str, Any]]:
    with self._connect() as connection:
      row = connection.execute("SELECT * FROM fms_qualification_audits WHERE experiment_id=? AND qualification_version=? AND configuration_hash=? AND dataset_fingerprint=? AND method_hash=?", (experiment_id, version, configuration_hash, dataset_fingerprint, method_hash)).fetchone()
    return json.loads(row["result_json"]) if row else None

  def latest_fms_qualification_audit(self, experiment_id: str) -> Optional[Dict[str, Any]]:
    """Return the newest immutable qualification record for one experiment."""
    with self._connect() as connection:
      row = connection.execute(
        """
        SELECT result_json FROM fms_qualification_audits
        WHERE experiment_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """,
        (experiment_id,),
      ).fetchone()
    return json.loads(row["result_json"]) if row else None

  def save_fms_qualification_audit(self, audit: Dict[str, Any], method_hash: str) -> None:
    with self._write_lock, self._connect() as connection:
      connection.execute("INSERT OR IGNORE INTO fms_qualification_audits(id,experiment_id,qualification_version,configuration_hash,dataset_fingerprint,method_hash,created_at,result_json) VALUES(?,?,?,?,?,?,?,?)", (audit["auditId"], audit["experimentId"], audit["version"], audit["configurationHash"], audit["datasetFingerprint"], method_hash, audit["createdAt"], json.dumps(audit, sort_keys=True, separators=(",", ":"))))

  def create_fms_sweep(self, sweep_id: str, manifest_hash: str, created_at: int, manifest: Dict[str, Any]) -> None:
    with self._write_lock, self._connect() as connection:
      connection.execute("INSERT INTO fms_sweeps(id,manifest_hash,created_at,status,manifest_json) VALUES(?,?,?,'queued',?)", (sweep_id, manifest_hash, created_at, json.dumps(manifest, sort_keys=True, separators=(",", ":"))))
      connection.executemany("INSERT INTO fms_sweep_entries(sweep_id,entry_id,state) VALUES(?,?,'waiting_for_source')", [(sweep_id, row["id"]) for row in manifest["entries"]])

  def get_fms_sweep(self, sweep_id: str) -> Optional[Dict[str, Any]]:
    with self._connect() as connection:
      sweep=connection.execute("SELECT * FROM fms_sweeps WHERE id=?",(sweep_id,)).fetchone(); entries=connection.execute("SELECT * FROM fms_sweep_entries WHERE sweep_id=? ORDER BY entry_id",(sweep_id,)).fetchall()
    return None if not sweep else {"id":sweep["id"],"manifestHash":sweep["manifest_hash"],"createdAt":sweep["created_at"],"status":sweep["status"],"manifest":json.loads(sweep["manifest_json"]),"entries":[dict(row) for row in entries]}

  def list_fms_sweeps(self) -> List[Dict[str, Any]]:
    with self._connect() as connection: rows=connection.execute("SELECT id FROM fms_sweeps ORDER BY created_at DESC").fetchall()
    return [self.get_fms_sweep(str(row["id"])) for row in rows]

  def update_fms_sweep_entry(self, sweep_id: str, entry_id: str, state: str, experiment_id: Optional[str] = None, audit_id: Optional[str] = None, error: Optional[str] = None) -> None:
    with self._write_lock, self._connect() as connection: connection.execute("UPDATE fms_sweep_entries SET state=?,experiment_id=COALESCE(?,experiment_id),audit_id=COALESCE(?,audit_id),error=? WHERE sweep_id=? AND entry_id=?",(state,experiment_id,audit_id,error,sweep_id,entry_id))

  def update_fms_sweep_status(self, sweep_id: str, status: str, error: Optional[str] = None) -> None:
    with self._write_lock, self._connect() as connection: connection.execute("UPDATE fms_sweeps SET status=?,error=? WHERE id=?",(status,error,sweep_id))

  def list_signal_version_archive(self) -> List[Dict[str, Any]]:
    with self._connect() as connection:
      rows = connection.execute(
        """
        SELECT version.*, run.id AS run_id, run.created_at AS run_created_at,
          run.status AS run_status, run.dataset_fingerprint, run.error
        FROM signal_versions AS version
        LEFT JOIN backtest_runs AS run ON run.id = (
          SELECT latest.id FROM backtest_runs AS latest
          WHERE latest.version_id = version.id
          ORDER BY latest.created_at DESC LIMIT 1
        )
        ORDER BY version.created_at DESC, version.id DESC
        """
      ).fetchall()
    return [{
      "id": str(row["id"]),
      "createdAt": int(row["created_at"]),
      "configuration": json.loads(row["configuration_json"]),
      "configurationHash": str(row["configuration_hash"]),
      "latestRun": None if row["run_id"] is None else {
        "id": str(row["run_id"]),
        "createdAt": int(row["run_created_at"]),
        "status": str(row["run_status"]),
        "datasetFingerprint": str(row["dataset_fingerprint"]),
        "error": row["error"],
      },
    } for row in rows]

  @staticmethod
  def _deserialize_fms_experiment(row: sqlite3.Row) -> Dict[str, Any]:
    return {
      "id": str(row["id"]),
      "friendlyName": str(row["friendly_name"]),
      "createdAt": int(row["created_at"]),
      "status": str(row["status"]),
      "configuration": json.loads(row["configuration_json"]),
      "configurationHash": str(row["configuration_hash"]),
      "catalogSnapshot": json.loads(row["catalog_snapshot_json"]),
      "datasetFingerprint": str(row["dataset_fingerprint"]),
      "result": json.loads(row["result_json"]) if row["result_json"] else None,
      "error": row["error"],
    }

  @staticmethod
  def _deserialize_fms_candidate(row: sqlite3.Row) -> Dict[str, Any]:
    return {
      "id": str(row["id"]),
      "experimentId": str(row["experiment_id"]),
      "friendlyName": str(row["friendly_name"]),
      "createdAt": int(row["created_at"]),
      "failedGateAcknowledged": bool(row["failed_gate_acknowledged"]),
      "checks": json.loads(row["checks_json"]),
      "configurationHash": str(row["configuration_hash"]),
      "datasetFingerprint": str(row["dataset_fingerprint"]),
      "experimentStatus": str(row["experiment_status"]),
      "result": json.loads(row["experiment_result_json"]) if row["experiment_result_json"] else None,
      "configuration": json.loads(row["experiment_configuration_json"]),
      "catalogSnapshot": json.loads(row["experiment_catalog_snapshot_json"]),
    }

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
