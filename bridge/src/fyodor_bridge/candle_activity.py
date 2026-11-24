from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from itertools import combinations

import numpy as np

from .currency_indices import CURRENCIES, MEMBERS, SERVER, STEPS
from .market_data import TIMEFRAME_NAMES


def candle_time(seconds):
    # The bridge passes MT5's chart-clock times back to MT5 unchanged.
    return datetime.fromtimestamp(seconds, timezone.utc)


def read_ticks(mt5, symbol, start, end):
    ticks = mt5.copy_ticks_range(symbol, candle_time(start), candle_time(end), mt5.COPY_TICKS_INFO)
    code, message = mt5.last_error()
    if ticks is None or code < 0:
        raise RuntimeError(f"Quote ticks unavailable for {symbol}: {message}")
    return ticks[(ticks["time_msc"] >= start * 1000) & (ticks["time_msc"] < end * 1000)]


def quote_prices(ticks, multiplier, midpoint):
    bid, ask = ticks["bid"], ticks["ask"]
    valid = np.isfinite(bid) & (bid > 0)
    if midpoint:
        valid &= np.isfinite(ask) & (ask >= bid)
    # Integer price units prevent floating-point noise from counting unchanged
    # midpoints as moves. Twice the midpoint has the same directional sign.
    bid_units = np.rint(bid * multiplier)
    prices = bid_units + np.rint(ask * multiplier) if midpoint else bid_units
    return np.where(valid, prices, np.nan)


def quote_series(mt5, symbol, start, end, midpoint, observed_at):
    info = mt5.symbol_info(symbol)
    if info is None or not mt5.symbol_select(symbol, True):
        raise RuntimeError(f"Quote history unavailable for {symbol}")
    multiplier = 10 ** info.digits
    ticks = read_ticks(mt5, symbol, start, end)
    prices = quote_prices(ticks, multiplier, midpoint)
    previous_minute = mt5.copy_rates_from(symbol, mt5.TIMEFRAME_M1, candle_time(start - 1), 1)
    previous = np.nan
    if previous_minute is not None and len(previous_minute):
        minute = int(previous_minute[-1]["time"])
        seed = quote_prices(read_ticks(mt5, symbol, minute, min(start, minute + 60)), multiplier, midpoint)
        if seed.size:
            previous = seed[-1]
    # A live read can include newer ticks across later legs. Use one observation
    # cutoff for all legs of the same request.
    observed = ticks["time_msc"] <= observed_at
    return ticks["time_msc"][observed], prices[observed], previous


def count_moves(changes, tolerance=0):
    up = int(np.count_nonzero(changes > tolerance))
    down = int(np.count_nonzero(changes < -tolerance))
    unknown = int(np.count_nonzero(~np.isfinite(changes)))
    return dict(up=up, down=down, flat=len(changes) - up - down - unknown, unknown=unknown)


def basket_moves(legs):
    timestamps, changes = [], []
    for times, prices, previous, sign in legs:
        if not np.isfinite(previous) or not np.all(np.isfinite(prices)):
            raise RuntimeError("The basket needs continuous valid Bid quotes and an opening quote for all seven pairs")
        deltas = np.diff(np.log(np.r_[previous, prices])) * sign
        timestamps.append(times)
        changes.append(deltas)
    times = np.concatenate(timestamps)
    if not times.size:
        return np.array([])
    order = np.argsort(times, kind="stable")
    # MT5 gives no cross-symbol ordering inside one millisecond. Apply those
    # updates together so the basket direction cannot depend on pair order.
    starts = np.r_[0, np.flatnonzero(np.diff(times[order])) + 1]
    return np.add.reduceat(np.concatenate(changes)[order], starts)


def account_identity(mt5):
    account = mt5.account_info()
    if account is None:
        raise RuntimeError("MT5 account is unavailable")
    return account.server, account.login


@dataclass
class BasketTickRead:
    account: tuple
    cutoff: int
    legs: list = field(default_factory=list)


class CandleTickReader:
    def __init__(self):
        self.pending = {}

    def read(self, mt5, symbol, timeframe, start, read_id, begin):
        account = account_identity(mt5)
        end = start + STEPS[timeframe]
        members = MEMBERS.get(symbol) if account[0] == SERVER else None
        if members is None:
            _, prices, previous = quote_series(mt5, symbol, start, end, True, end * 1000 - 1)
            counts = count_moves(np.diff(np.r_[previous, prices]))
        else:
            # Read one pair per adapter operation so chart and alert calls can
            # run between cold tick-history reads. Keep the arrays in MT5's process.
            state = self.pending.pop(read_id, None)
            if begin:
                snapshots = [mt5.symbol_info_tick(pair) for pair, _ in members]
                cutoff = max((tick.time_msc for tick in snapshots if tick is not None), default=0)
                if cutoff < start * 1000:
                    raise RuntimeError("A broker quote is needed to read the synthetic basket")
                state = BasketTickRead(account, cutoff)
            if state is None or state.account != account:
                raise RuntimeError("The basket tick read was interrupted. Retry the candle.")
            pair, sign = members[len(state.legs)]
            state.legs.append((*quote_series(mt5, pair, start, end, False, state.cutoff), sign))
            if len(state.legs) < len(members):
                if account_identity(mt5) != account:
                    raise RuntimeError("MT5 account changed during the candle read")
                self.pending[read_id] = state
                if len(self.pending) > 3:
                    self.pending.pop(next(iter(self.pending)))
                return None
            counts = count_moves(basket_moves(state.legs), tolerance=1e-12)
        if not sum(counts.values()):
            raise RuntimeError(f"No quote ticks returned for {symbol} in this candle")
        if account_identity(mt5) != account:
            raise RuntimeError("MT5 account changed during the candle read")
        return dict(**counts, synthetic=bool(members))


def read_currency_activity(mt5, timeframe, start):
    account = account_identity(mt5)
    if account[0] != SERVER:
        raise RuntimeError("Currency activity requires the Pepperstone-Demo FX pairs")
    frame = getattr(mt5, TIMEFRAME_NAMES[timeframe])
    totals = {currency: 0 for currency in CURRENCIES}
    missing = {currency: [] for currency in CURRENCIES}
    for base, quote in combinations(CURRENCIES, 2):
        pair = base + quote
        rates = mt5.copy_rates_from(pair, frame, candle_time(start), 1)
        row = rates[-1] if rates is not None and len(rates) else None
        for currency in (base, quote):
            if row is None or int(row["time"]) != start:
                missing[currency].append(pair)
            else:
                totals[currency] += int(row["tick_volume"])
    if account_identity(mt5) != account:
        raise RuntimeError("MT5 account changed during the activity read")
    rows = [dict(currency=currency, updates=None if missing[currency] else totals[currency], missing=missing[currency])
            for currency in CURRENCIES]
    return sorted(rows, key=lambda row: (row["updates"] is None, -(row["updates"] or 0), row["currency"]))
