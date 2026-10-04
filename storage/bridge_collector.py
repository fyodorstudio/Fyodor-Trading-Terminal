from __future__ import annotations

import json
import threading
from urllib.request import urlopen

from .contracts import CalendarEvent


class BridgeCollector:
    """Reads existing endpoints; never changes bridge state or calendar protocol."""

    def __init__(self, store, bridge_url="http://127.0.0.1:8001/api/v1", fetch=None):
        self.store = store
        self.bridge_url = bridge_url.rstrip("/")
        self.fetch = fetch or self._fetch
        self.revisions = {}
        self.error = None
        self.stop_event = threading.Event()
        self.thread = None

    def _fetch(self, path):
        with urlopen(self.bridge_url + path, timeout=2) as response:
            return json.load(response)

    def poll(self):
        try:
            sources = self.store.publisher_sources()
            if not sources:
                return
            health = self.fetch("/health")["calendar"]
            if health.get("last_snapshot_at") is None:
                return
            for source in sources:
                if source["instance_id"] != health["instance_id"]:
                    continue
                revision = (health["instance_id"], health["last_update_at"], health["event_count"])
                if self.revisions.get(source["id"]) == revision:
                    continue
                snapshot = self.fetch("/calendar")
                if snapshot["source"]["instance_id"] != health["instance_id"] or snapshot["source"].get("last_snapshot_at") is None:
                    continue
                events = [CalendarEvent.model_validate({key: value for key, value in row.items() if key in CalendarEvent.model_fields}).model_dump()
                          for row in snapshot["events"] if row["currency"] in ("EUR", "USD")]
                if self.store.collect(source["id"], events, health["instance_id"], snapshot["source"]["last_update_at"] / 1000,
                                      snapshot["source"].get("server_utc_offset_seconds")):
                    self.revisions[source["id"]] = (snapshot["source"]["instance_id"], snapshot["source"]["last_update_at"], snapshot["source"]["event_count"])
            self.error = None
        except Exception as error:
            self.error = str(error)

    def start(self):
        def run():
            while not self.stop_event.is_set():
                self.poll()
                self.stop_event.wait(2)
        self.thread = threading.Thread(target=run, name="calendar-storage-collector", daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=5)
