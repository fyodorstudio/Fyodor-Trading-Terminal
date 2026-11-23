from __future__ import annotations

from queue import Empty
from typing import Any

from .currency_indices import SERVER, SYMBOLS, CurrencyIndexHistory
from .market_data import read_market_watch, read_ohlc


def _last_error(mt5: Any, prefix: str) -> str:
    try:
        code, description = mt5.last_error()
        return f"{prefix}: [{code}] {description}"
    except Exception:
        return prefix


def run_mt5_adapter(
    command_queue: Any,
    response_queue: Any,
    terminal_path: str,
    initialize_timeout_ms: int,
) -> None:
    try:
        import MetaTrader5 as mt5
    except Exception as error:
        response_queue.put({"kind": "ready", "ok": False, "error": f"Unable to import MetaTrader5: {error}"})
        return

    try:
        initialized = bool(mt5.initialize(terminal_path, timeout=initialize_timeout_ms))
        if not initialized:
            response_queue.put({"kind": "ready", "ok": False, "error": _last_error(mt5, "MT5 initialize failed")})
            return

        terminal_info = mt5.terminal_info()
        if not terminal_info or not bool(getattr(terminal_info, "connected", False)):
            response_queue.put(
                {
                    "kind": "ready",
                    "ok": False,
                    "error": _last_error(mt5, "Terminal is running but broker connection is unavailable"),
                },
            )
            return

        account_info = mt5.account_info()
        index_history = CurrencyIndexHistory()
        response_queue.put(
            {
                "kind": "ready",
                "ok": True,
                "package_version": getattr(mt5, "__version__", None),
                "account_login": int(account_info.login) if account_info else None,
                "account_server": str(account_info.server) if account_info else None,
            },
        )

        while True:
            try:
                command = command_queue.get(timeout=0.5)
            except Empty:
                continue
            if command.get("operation") == "shutdown":
                return

            request_id = int(command["request_id"])
            operation = str(command["operation"])
            arguments = command.get("arguments", {})
            try:
                if operation == "market-watch":
                    result = read_market_watch(mt5)
                    account = mt5.account_info()
                    if account and account.server == SERVER:
                        result = [row for row in result if row["symbol"] not in SYMBOLS] + index_history.quotes(mt5, account)
                elif operation == "ohlc":
                    symbol = str(arguments["symbol"])
                    timeframe = str(arguments["timeframe"])
                    count = int(arguments["count"])
                    if symbol in SYMBOLS and account_info and account_info.server == SERVER:
                        result = index_history.read(mt5, symbol, timeframe, count, arguments.get("before"))
                    else:
                        result = read_ohlc(mt5, symbol, timeframe, int(arguments["start_pos"]), count)
                else:
                    raise RuntimeError(f"Unsupported MT5 adapter operation: {operation}")
            except Exception as error:
                response_queue.put({"kind": "result", "request_id": request_id, "ok": False, "error": str(error)})
            else:
                response_queue.put({"kind": "result", "request_id": request_id, "ok": True, "result": result})
    finally:
        try:
            mt5.shutdown()
        except Exception:
            pass
