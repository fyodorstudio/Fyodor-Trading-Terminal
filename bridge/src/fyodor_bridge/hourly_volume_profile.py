from collections import Counter
from math import isfinite

from .candle_activity import account_identity, candle_time
from .currency_indices import MEMBERS, SERVER, STEPS
from .volume_profile import MAX_PROFILE_PAGE_SECONDS as DAY, profile_instrument

HOUR = STEPS["H1"]
HOURLY_PROFILE_PAGE_SECONDS = 180 * DAY


def read_hourly_bars(mt5, symbol, start, end):
    account = account_identity(mt5)
    info = profile_instrument(mt5, symbol)
    rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_H1, candle_time(start), candle_time(end - 1))
    bars = []
    if rates is not None:
        for row in rates:
            at, close, volume = int(row["time"]), float(row["close"]), int(row["tick_volume"])
            if start <= at < end and volume > 0 and isfinite(close) and close > 0:
                bars.append((at, close, volume))

    gaps = [(start, end)] if rates is None else []
    first_day = (start + DAY - 1) // DAY * DAY
    last_day = end // DAY * DAY
    if first_day < last_day:
        daily = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_D1, candle_time(first_day), candle_time(last_day - 1))
        if daily is None or (len(daily) == 0 and not bars and last_day - first_day >= 7 * DAY):
            gaps.append((first_day, last_day))
        else:
            expected = {int(row["time"]) // DAY for row in daily if row["tick_volume"] > 0}
            observed = {at // DAY for at, _, _ in bars}
            gaps.extend((day * DAY, (day + 1) * DAY) for day in sorted(expected - observed))
    if account_identity(mt5) != account:
        raise RuntimeError("MT5 account changed during the hourly profile read")
    return {"digits": int(info.digits), "bars": bars, "gaps": gaps}


def read_hourly_index_reference(mt5, index_history, symbol):
    account = account_identity(mt5)
    if account[0] != SERVER or symbol not in MEMBERS:
        raise RuntimeError("The synthetic index requires Pepperstone-Demo")
    index_history.set_account(account)
    reference = index_history.reference(mt5, MEMBERS[symbol])
    if account_identity(mt5) != account:
        raise RuntimeError("MT5 account changed during the hourly profile read")
    return reference


def weighted_profile(bars, digits, incomplete, start, end, observed_until):
    levels = Counter()
    scale = 10 ** digits
    for at, price, activity in bars:
        hour_end = min(at + HOUR, observed_until)
        overlap = min(end, hour_end) - max(start, at)
        if overlap > 0:
            count = round(activity * overlap / (hour_end - at))
            if count > 0:
                levels[round(price * scale)] += count
    return {"digits": digits, "levels": list(levels.items()), "missing_minutes": None if incomplete else 0}
