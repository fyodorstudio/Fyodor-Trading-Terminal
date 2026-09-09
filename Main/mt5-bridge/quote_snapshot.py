from __future__ import annotations

from threading import Lock
from typing import Any, Callable, Dict, List, Optional
import time


class QuoteSnapshotConflict(ValueError):
  """Raised when a delta cannot be applied to the current publisher snapshot."""


class QuoteSnapshotStore:
  """Thread-safe, process-local quote snapshot fed independently from Python MT5 IPC."""

  def __init__(self, monotonic: Callable[[], float] = time.monotonic) -> None:
    self._monotonic = monotonic
    self._lock = Lock()
    self._publisher_id: Optional[str] = None
    self._broker_identity: Optional[str] = None
    self._catalog_revision: Optional[str] = None
    self._sequence = -1
    self._received_at_monotonic: Optional[float] = None
    self._sent_at: Optional[int] = None
    self._rows: Dict[str, Dict[str, Any]] = {}

  def ingest(
    self,
    *,
    publisher_id: str,
    broker_identity: str,
    catalog_revision: str,
    sequence: int,
    complete: bool,
    sent_at: Optional[int],
    rows: List[Dict[str, Any]],
  ) -> Dict[str, Any]:
    names = [str(row.get("name") or "").strip() for row in rows]
    if any(not name for name in names):
      raise QuoteSnapshotConflict("Every quote row requires a symbol name")
    if len(set(names)) != len(names):
      raise QuoteSnapshotConflict("Quote payload contains duplicate symbol names")

    with self._lock:
      same_stream = (
        publisher_id == self._publisher_id
        and broker_identity == self._broker_identity
        and catalog_revision == self._catalog_revision
      )
      if not same_stream and not complete:
        raise QuoteSnapshotConflict("A new publisher or catalog must begin with a complete snapshot")
      if same_stream and sequence <= self._sequence:
        return self._status_unlocked(accepted=False, reason="duplicate_or_out_of_order")

      if complete:
        self._rows = {name: dict(row) for name, row in zip(names, rows)}
      else:
        if not self._rows:
          raise QuoteSnapshotConflict("A delta requires an existing complete snapshot")
        for name, row in zip(names, rows):
          if name not in self._rows:
            raise QuoteSnapshotConflict("A delta cannot add a symbol outside the current catalog")
          self._rows[name] = dict(row)

      self._publisher_id = publisher_id
      self._broker_identity = broker_identity
      self._catalog_revision = catalog_revision
      self._sequence = sequence
      self._sent_at = sent_at
      self._received_at_monotonic = self._monotonic()
      return self._status_unlocked(accepted=True, reason="complete" if complete else "delta")

  def read_fresh(self, max_age_seconds: float) -> Optional[List[Dict[str, Any]]]:
    with self._lock:
      age = self._age_unlocked()
      if not self._rows or age is None or age > max_age_seconds:
        return None
      return [dict(row) for row in self._rows.values()]

  def status(self, max_age_seconds: float) -> Dict[str, Any]:
    with self._lock:
      status = self._status_unlocked(accepted=None, reason=None)
      age = self._age_unlocked()
      status.update({
        "fresh": bool(self._rows) and age is not None and age <= max_age_seconds,
        "age_seconds": round(age, 3) if age is not None else None,
      })
      return status

  def _age_unlocked(self) -> Optional[float]:
    if self._received_at_monotonic is None:
      return None
    return max(0.0, self._monotonic() - self._received_at_monotonic)

  def _status_unlocked(self, accepted: Optional[bool], reason: Optional[str]) -> Dict[str, Any]:
    return {
      "accepted": accepted,
      "reason": reason,
      "publisher_id": self._publisher_id,
      "broker_identity": self._broker_identity,
      "catalog_revision": self._catalog_revision,
      "sequence": self._sequence,
      "sent_at": self._sent_at,
      "symbol_count": len(self._rows),
    }
