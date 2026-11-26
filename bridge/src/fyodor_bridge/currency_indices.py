"""Pepperstone FX baskets on the same broker wall-clock timeline as MT5 candles."""
from collections import OrderedDict
from datetime import datetime, timezone
from itertools import combinations
from math import exp, isfinite, log


SERVER = "Pepperstone-Demo"
CURRENCIES = ("EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY")
SYMBOLS = {currency + "X": currency for currency in ("GBP", "CHF", "CAD", "AUD", "NZD")}
STEPS = {"M1": 60, "M5": 300, "M15": 900, "M30": 1800, "H1": 3600, "H4": 14400, "D1": 86400}
ANCHOR = int(datetime(2025, 1, 6, tzinfo=timezone.utc).timestamp())
INDEX_DIGITS = 3


def basket_members(currency):
    return [(base + quote, 1 if base == currency else -1)
            for base, quote in combinations(CURRENCIES, 2) if currency in (base, quote)]


MEMBERS = {symbol: basket_members(currency) for symbol, currency in SYMBOLS.items()}
PAIR_NAMES = sorted({pair for members in MEMBERS.values() for pair, _ in members})


def read_prices(mt5, pair, frame, count, before):
    if before is None:
        rates = mt5.copy_rates_from_pos(pair, frame, 0, count)
    else:
        rates = mt5.copy_rates_from(pair, frame, datetime.fromtimestamp(before - 1, timezone.utc), count)
    if rates is None:
        code, message = mt5.last_error()
        if code == -4:  # MT5 RES_E_NOT_FOUND
            return {}
        raise RuntimeError(f"Unable to read {pair} for the synthetic index: {message}")
    return {int(rate["time"]): (float(rate["open"]), float(rate["close"])) for rate in rates}


def index_price(prices, reference):
    log_return = sum(weight * (log(price) - baseline)
                     for price, (weight, baseline) in zip(prices, reference))
    return 100 * exp(log_return)


def synchronized_prices(legs, reference):
    common = set.intersection(*(set(leg) for leg in legs))
    for at in sorted(common):
        observations = [leg[at] for leg in legs]
        if not all(isfinite(value) and value > 0 for prices in observations for value in prices):
            continue
        yield at, [index_price(prices, reference) for prices in zip(*observations)]


def sampled_candles(legs, reference, step):
    candles = {}
    # The oldest returned minute can be in the middle of a candle when one leg
    # has less history or the native read reaches its limit.
    if not all(legs):
        return candles
    overlap_start = max(min(leg) for leg in legs)
    for at, (opening, close) in synchronized_prices(legs, reference):
        bucket = at - at % step
        if bucket < overlap_start:
            continue
        candle = candles.get(bucket)
        if candle is None:
            candles[bucket] = dict(time=bucket, open=opening, high=max(opening, close),
                                   low=min(opening, close), close=close)
        else:
            candle["high"] = max(candle["high"], opening, close)
            candle["low"] = min(candle["low"], opening, close)
            candle["close"] = close
    return candles


def fill_daily_candles(mt5, members, reference, candles, count, before):
    daily = [read_prices(mt5, pair, mt5.TIMEFRAME_D1, count + 1, before) for pair, _ in members]
    closed = list(synchronized_prices(daily, reference))
    missing = [(at, prices) for at, prices in closed if at not in candles]
    if not missing:
        return

    day = STEPS["D1"]
    # H4 opens and closes reach beyond M1 history. Use observations shared by
    # all seven pairs instead of combining highs and lows from different times.
    stop = missing[-1][0] + day
    samples = [read_prices(mt5, pair, mt5.TIMEFRAME_H4, (count + 1) * 6, stop) for pair, _ in members]
    older = sampled_candles(samples, reference, day)
    for at, (opening, close) in missing:
        intraday = older.get(at)
        high, low = max(opening, close), min(opening, close)
        if intraday:
            high, low = max(high, intraday["high"]), min(low, intraday["low"])
        candles[at] = dict(time=at, open=opening, high=high, low=low, close=close)


class CurrencyIndexHistory:
    def __init__(self):
        self.account = None
        self.references = {}
        self.pages = OrderedDict()

    def set_account(self, identity):
        if self.account != identity:
            self.account = identity
            self.references.clear()
            self.pages.clear()

    def reference(self, mt5, members):
        for pair, _ in members:
            if pair not in self.references:
                prices = read_prices(mt5, pair, mt5.TIMEFRAME_D1, 1, ANCHOR + 1).get(ANCHOR)
                if prices is None or not isfinite(prices[0]) or prices[0] <= 0:
                    raise RuntimeError(f"{pair} requires 6 Jan 2025 D1 history for the synthetic index")
                self.references[pair] = log(prices[0])
        return [(direction / 7, self.references[pair]) for pair, direction in members]

    def quotes(self, mt5, account):
        identity = (account.server, account.login)
        self.set_account(identity)
        ticks = {pair: mt5.symbol_info_tick(pair) for pair in PAIR_NAMES}
        rows = []
        for symbol, members in MEMBERS.items():
            row = dict(symbol=symbol, description=f"Synthetic {SYMBOLS[symbol]} index", synthetic=True,
                       bid=0, ask=0, daily_change=None, precision=INDEX_DIGITS)
            rows.append(row)
            legs = [ticks[pair] for pair, _ in members]
            if not all(tick and tick.time > 0 and isfinite(tick.bid) and tick.bid > 0 for tick in legs):
                continue
            try:
                reference = self.reference(mt5, members)
            except RuntimeError:
                continue
            # FX chart candles are in constituent Bid prices. Use the same
            # inputs and anchor for the synthetic level monitored by alerts.
            row.update(index_level=index_price([tick.bid for tick in legs], reference),
                       oldest_tick=min(tick.time for tick in legs), newest_tick=max(tick.time for tick in legs))
        current = mt5.account_info()
        if current is None or (current.server, current.login) != identity:
            self.set_account(None)
            return []
        return rows

    def read(self, mt5, symbol, timeframe, count, before):
        account = mt5.account_info()
        if account is None or account.server != SERVER:
            raise RuntimeError("Synthetic currency indices require Pepperstone-Demo")
        identity = (account.server, account.login)
        self.set_account(identity)
        cache_key = (symbol, timeframe, count, before)
        if before is not None and cache_key in self.pages:
            self.pages.move_to_end(cache_key)
            return self.pages[cache_key]

        members = MEMBERS[symbol]
        reference = self.reference(mt5, members)

        step = STEPS[timeframe]
        minute_count = min(21_600, (count + 2) * (step // 60))
        minutes = [read_prices(mt5, pair, mt5.TIMEFRAME_M1, minute_count, before) for pair, _ in members]
        candles = sampled_candles(minutes, reference, step)
        if timeframe == "D1":
            fill_daily_candles(mt5, members, reference, candles, count, before)

        current = mt5.account_info()
        if current is None or (current.server, current.login) != identity:
            self.set_account(None)
            raise RuntimeError("MT5 account changed during the synthetic index read")
        if not candles and before is None:
            raise RuntimeError(f"No synchronized {timeframe} history for {symbol}. Check the seven FX pairs in MT5.")
        bars = [candles[at] for at in sorted(candles)]
        selected = bars[-count:]
        # When the read hit its minute limit there may be older pages even if
        # weekends or sparse synchronization reduced the number of candles.
        has_older = len(bars) > count or (
            timeframe != "D1" and bool(selected) and all(len(leg) == minute_count for leg in minutes)
        )
        page = dict(bars=selected, start_pos=0, next_start_pos=0, has_older=has_older,
                    next_before=selected[0]["time"] if selected and has_older else None)
        if before is not None and selected:
            self.pages[cache_key] = page
            if len(self.pages) > 24:
                self.pages.popitem(last=False)
        return page
