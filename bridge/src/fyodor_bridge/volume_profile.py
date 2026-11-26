from __future__ import annotations

import numpy as np

from .candle_activity import account_identity, candle_time, read_ticks
from .currency_indices import MEMBERS, SERVER

MAX_PROFILE_PAGE_SECONDS = 86_400
CHART_MODE_LAST = 1


def profile_instrument(mt5, symbol):
    account = account_identity(mt5)
    if account[0] == SERVER and symbol in MEMBERS:
        raise RuntimeError("Tick volume profiles require a broker symbol")
    info = mt5.symbol_info(symbol)
    if info is None or not mt5.symbol_select(symbol, True):
        raise RuntimeError(f"Unable to select {symbol} for a tick volume profile")

    return account, info


def volume_profile_days(mt5, symbol, start, end):
    account, info = profile_instrument(mt5, symbol)
    first = start // MAX_PROFILE_PAGE_SECONDS * MAX_PROFILE_PAGE_SECONDS
    rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_D1, candle_time(first), candle_time(end - 1))
    if account_identity(mt5) != account:
        raise RuntimeError("MT5 account changed during the volume profile read")
    dates = [] if rates is None else sorted(set((rates["time"] // MAX_PROFILE_PAGE_SECONDS
                                                   * MAX_PROFILE_PAGE_SECONDS).tolist()))
    return {"days": dates, "digits": int(info.digits)}


def read_volume_profile(mt5, symbol, start, end):
    account, info = profile_instrument(mt5, symbol)
    use_last = getattr(info, "chart_mode", 0) == CHART_MODE_LAST
    ticks = read_ticks(mt5, symbol, start, end, mt5.COPY_TICKS_TRADE if use_last else None)
    quotes = ticks["last" if use_last else "bid"]
    # Keep the full price resolution until all the requested pages are combined.
    valid = np.isfinite(quotes) & (quotes > 0)
    prices = np.rint(quotes[valid] * 10 ** info.digits).astype(np.int64)
    levels, counts = np.unique(prices, return_counts=True)
    rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M1, candle_time(start), candle_time(end - 1))
    # Minute bars help distinguish a quiet market from missing quote history.
    # An available minute establishes expected activity, not full tick coverage.
    missing_minutes = None
    if rates is not None:
        expected = rates["time"][(rates["time"] >= start) & (rates["time"] < end) & (rates["tick_volume"] > 0)]
        observed = np.unique(ticks["time_msc"][valid] // 60_000 * 60)
        missing_minutes = int(np.count_nonzero(~np.isin(expected, observed)))
    if account_identity(mt5) != account:
        raise RuntimeError("MT5 account changed during the volume profile read")
    return {"digits": int(info.digits), "levels": list(zip(levels.tolist(), counts.tolist())),
            "missing_minutes": missing_minutes}
