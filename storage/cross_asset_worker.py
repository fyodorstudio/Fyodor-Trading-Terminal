"""Isolated MT5 reads. Never logs in, selects symbols, trades or changes accounts."""
import json
import math
import sys
import time
from datetime import datetime, timezone


def read_history(mt5, request):
    identity = request['identity']
    if not mt5.initialize(path=identity['terminal_path'], timeout=3000):
        raise ValueError('Could not attach to the running terminal')
    try:
        def matches():
            account, terminal = mt5.account_info(), mt5.terminal_info()
            return (account is not None and terminal is not None and terminal.connected
                    and account.server == identity['account_server'] and account.login == identity['account_login'])
        if not matches():
            raise ValueError('Native account does not match connected source')
        visible = {s.name for s in mt5.symbols_get() or () if s.visible}
        records, deadline = {}, time.monotonic() + 3
        for symbol in request['symbols']:
            if time.monotonic() >= deadline:
                break
            if symbol not in visible:
                records[symbol] = dict(bars=[], availability='not_visible')
                continue
            rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_D1,
                datetime.fromtimestamp(request['starts'][symbol], timezone.utc),
                datetime.fromtimestamp(request['end'], timezone.utc))
            bars = []
            if rates is not None:
                for rate in rates:
                    at = int(rate['time'])
                    values = {k: float(rate[k]) for k in ('open', 'high', 'low', 'close')}
                    if (request['starts'][symbol] <= at <= request['end']
                            and all(math.isfinite(v) and v > 0 for v in values.values())
                            and values['low'] <= min(values['open'], values['close'])
                            and values['high'] >= max(values['open'], values['close'])):
                        bars.append(dict(time=at, **values))
            bars = sorted({b['time']: b for b in bars}.values(), key=lambda b: b['time'])
            records[symbol] = dict(bars=bars, availability='unavailable' if rates is None
                                  else 'available' if bars else 'no_history')
        if not matches():
            raise ValueError('Native account changed during read')
        return records
    finally:
        mt5.shutdown()


if __name__ == '__main__':
    import MetaTrader5 as mt5
    print(json.dumps(read_history(mt5, json.load(sys.stdin))))
