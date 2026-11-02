"""Read seven visible FX legs from the already-connected terminal; never select/login."""
import json
import sys
import time
from datetime import datetime, timezone
from ..calendar_clock import chart_utc, PROFILES
from ..market_watch_daily import daily_record
from .daily import SOURCE, bounds
from .outcomes import LEGS


def read_day(mt5, request):
    identity, day = request['identity'], request['day']
    if identity['account_server'] != SOURCE:
        raise ValueError('Daily excursions require the verified Pepperstone source')
    if not mt5.initialize(path=identity['terminal_path'], timeout=3000):
        raise ValueError('Could not attach to the running terminal')
    try:
        def matches():
            account, terminal = mt5.account_info(), mt5.terminal_info()
            return (account is not None and terminal is not None and terminal.connected
                and account.server == SOURCE and account.login == identity['account_login'])
        if not matches():
            raise ValueError('Native account does not match connected source')
        visible = {s.name for s in mt5.symbols_get() or () if s.visible}
        raw = int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp())
        start, end = datetime.fromtimestamp(raw, timezone.utc), datetime.fromtimestamp(raw + 86399, timezone.utc)
        opens, samples = {}, {}
        for symbol, _ in LEGS.values():
            if symbol not in visible:
                opens[symbol], samples[symbol] = None, []
                continue
            daily = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_D1, start, end)
            opens[symbol] = daily_record(daily if daily is not None else [], raw)['open']
            observed_before_read = time.time()
            rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M1, start, end)
            samples[symbol] = []
            for bar in rates if rates is not None else []:
                at = chart_utc(SOURCE, int(bar['time']))
                if at is None:
                    raise ValueError('Ambiguous historical minute clock')
                if at + 60 <= observed_before_read:
                    samples[symbol].append([at, float(bar['close'])])
        if not matches():
            raise ValueError('Native account changed during excursion read')
        opening, closing = bounds(day)
        return dict(day=day, source_id=SOURCE, clock_profile=PROFILES[SOURCE],
            captured_utc=datetime.now(timezone.utc).isoformat(), opens=opens, samples=samples,
            from_utc=datetime.fromtimestamp(opening, timezone.utc).isoformat(),
            to_utc=datetime.fromtimestamp(closing, timezone.utc).isoformat())
    finally:
        mt5.shutdown()


if __name__ == '__main__':
    import MetaTrader5 as mt5
    print(json.dumps(read_day(mt5, json.load(sys.stdin)), allow_nan=False))
