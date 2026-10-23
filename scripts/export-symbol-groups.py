"""Capture symbol folders from the connected MT5 terminal, without account changes."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

import MetaTrader5 as mt5


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--terminal", required=True, help="Path to the running terminal64.exe")
    parser.add_argument("--server", required=True, help="Expected connected broker server")
    args = parser.parse_args()
    if not mt5.initialize(path=args.terminal, timeout=10000):
        raise SystemExit(f"MT5 unavailable: {mt5.last_error()}")
    try:
        account = mt5.account_info()
        if account is None or account.server != args.server:
            raise SystemExit("Connected broker does not match --server; catalog not changed")
        rows = mt5.symbols_get()
        if not rows:
            raise SystemExit("MT5 returned no symbols; catalog not changed")
        groups: dict[str, list[str]] = {}
        for row in rows:
            groups.setdefault(row.path.rsplit("\\", 1)[0], []).append(row.name)
        payload = {
            "server": account.server,
            "captured_utc": datetime.now(timezone.utc).isoformat(),
            "groups": {key: sorted(value) for key, value in sorted(groups.items())},
        }
        # Keep large folders compact, with one independently reviewable line per group.
        contents = '{\n  "server": ' + json.dumps(payload["server"])
        contents += ',\n  "captured_utc": ' + json.dumps(payload["captured_utc"])
        contents += ',\n  "groups": {\n' + ',\n'.join(
            '    ' + json.dumps(key) + ': ' + json.dumps(value) for key, value in payload["groups"].items()
        ) + '\n  }\n}\n'
        destination = Path(__file__).resolve().parents[1] / "config" / "broker-symbol-groups.json"
        temporary = destination.with_suffix(".json.tmp")
        temporary.write_text(contents, encoding="utf-8")
        temporary.replace(destination)
        print(f"Captured {len(rows)} symbols in {len(groups)} folders for {account.server}")
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    main()
