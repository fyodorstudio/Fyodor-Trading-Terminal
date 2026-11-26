from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .candle_activity import account_identity, basket_moves, candle_time, quote_series, read_ticks
from .currency_indices import INDEX_DIGITS, MEMBERS, SERVER, index_price

MAX_PROFILE_PAGE_SECONDS = 86_400
CHART_MODE_LAST = 1


def profile_instrument(mt5, symbol):
    info = mt5.symbol_info(symbol)
    if info is None or not mt5.symbol_select(symbol, True):
        raise RuntimeError(f"Unable to select {symbol} for a tick volume profile")

    return info


def volume_profile_days(mt5, symbol, start, end):
    account = account_identity(mt5)
    members = MEMBERS.get(symbol) if account[0] == SERVER else None
    first = start // MAX_PROFILE_PAGE_SECONDS * MAX_PROFILE_PAGE_SECONDS
    pairs = [pair for pair, _ in members] if members else [symbol]
    digits = INDEX_DIGITS
    days = []
    for pair in pairs:
        info = profile_instrument(mt5, pair)
        if not members:
            digits = int(info.digits)
        rates = mt5.copy_rates_range(pair, mt5.TIMEFRAME_D1, candle_time(first), candle_time(end - 1))
        days.append(set() if rates is None else set((rates["time"] // MAX_PROFILE_PAGE_SECONDS
                                                     * MAX_PROFILE_PAGE_SECONDS).tolist()))
    if account_identity(mt5) != account:
        raise RuntimeError("MT5 account changed during the volume profile read")
    # A missing constituent session is a coverage gap when other legs traded.
    return {"days": sorted(set.union(*days)), "digits": digits}


def price_profile(quotes, digits, missing_minutes):
    # Keep the full price resolution until all the requested pages are combined.
    prices = np.rint(quotes * 10 ** digits).astype(np.int64)
    levels, counts = np.unique(prices, return_counts=True)
    return {"digits": digits, "levels": list(zip(levels.tolist(), counts.tolist())),
            "missing_minutes": missing_minutes}


def missing_quote_minutes(mt5, symbol, start, end, times):
    rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M1, candle_time(start), candle_time(end - 1))
    # Minute bars help distinguish a quiet market from missing quote history.
    # An available minute establishes expected activity, not full tick coverage.
    if rates is None:
        return None
    expected = rates["time"][(rates["time"] >= start) & (rates["time"] < end) & (rates["tick_volume"] > 0)]
    observed = np.unique(times // 60_000 * 60)
    return int(np.count_nonzero(~np.isin(expected, observed)))


def read_volume_profile(mt5, symbol, start, end):
    account = account_identity(mt5)
    info = profile_instrument(mt5, symbol)
    use_last = getattr(info, "chart_mode", 0) == CHART_MODE_LAST
    ticks = read_ticks(mt5, symbol, start, end, mt5.COPY_TICKS_TRADE if use_last else None)
    quotes = ticks["last" if use_last else "bid"]
    valid = np.isfinite(quotes) & (quotes > 0)
    missing = missing_quote_minutes(mt5, symbol, start, end, ticks["time_msc"][valid])
    if account_identity(mt5) != account:
        raise RuntimeError("MT5 account changed during the volume profile read")
    return price_profile(quotes[valid], int(info.digits), missing)


@dataclass
class IndexProfileRead:
    account: tuple
    cutoff: int
    legs: list = field(default_factory=list)
    coverage: list = field(default_factory=list)


class VolumeProfileReader:
    def __init__(self, index_history):
        self.index_history = index_history
        self.pending = {}

    def read(self, mt5, symbol, start, end, read_id, begin):
        account = account_identity(mt5)
        members = MEMBERS.get(symbol) if account[0] == SERVER else None
        if members is None:
            return read_volume_profile(mt5, symbol, start, end)

        state = self.pending.pop(read_id, None)
        if begin:
            quotes = [mt5.symbol_info_tick(pair) for pair, _ in members]
            latest = max((quote.time_msc for quote in quotes if quote), default=end * 1000 - 1)
            cutoff = min(end * 1000 - 1, latest)
            if cutoff < start * 1000:
                return price_profile(np.array([]), INDEX_DIGITS, None)
            state = IndexProfileRead(account, cutoff)
        if state is None or state.account != account:
            raise RuntimeError("The synthetic volume profile read was interrupted")

        pair, sign = members[len(state.legs)]
        times, prices, previous = quote_series(mt5, pair, start, end, False, state.cutoff, normalize=True)
        covered_end = min(end, (state.cutoff // 60_000 + 1) * 60)
        coverage = missing_quote_minutes(mt5, pair, start, covered_end, times[np.isfinite(prices)])
        state.legs.append((times, prices, previous, sign))
        state.coverage.append(coverage)
        if account_identity(mt5) != account:
            raise RuntimeError("MT5 account changed during the volume profile read")
        if len(state.legs) < len(members):
            self.pending[read_id] = state
            if len(self.pending) > 8:
                self.pending.pop(next(iter(self.pending)))
            return None

        # The same simultaneous Bid changes as Tick Delta, applied to the
        # index's actual opening level. Never substitute constituent prices.
        if any(state.coverage):
            return price_profile(np.array([]), INDEX_DIGITS, max(minutes or 0 for minutes in state.coverage))
        _, moves = basket_moves(state.legs)
        self.index_history.set_account(account)
        reference = self.index_history.reference(mt5, members)
        opening = index_price([leg[2] for leg in state.legs], reference)
        prices = opening * np.exp(np.cumsum(moves) / len(members))
        missing = None if None in state.coverage else 0
        if account_identity(mt5) != account:
            raise RuntimeError("MT5 account changed during the volume profile read")
        return price_profile(prices, INDEX_DIGITS, missing)
