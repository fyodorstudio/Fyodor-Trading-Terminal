"""Bounded native reads in an isolated process, attached to the running terminal."""
import json
import sys
import time

from .market_watch_daily import daily_record


def read_daily(mt5, request):
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
        # Read the existing visible catalog, without symbol_select or login calls.
        visible = {symbol.name for symbol in mt5.symbols_get() or () if symbol.visible}
        # Warm missing history incrementally so a large stocks catalog cannot
        # delay the selected chart's range or the user's FX shortlist.
        records, deadline = {}, time.monotonic() + 2
        for symbol in request['symbols']:
            if time.monotonic() >= deadline:
                break
            if symbol not in visible:
                continue
            rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_D1, 0, 3)
            records[symbol] = daily_record(rates if rates is not None else [], request['day'])
        if not matches():
            raise ValueError('Native account changed during read')
        return records
    finally:
        mt5.shutdown()


if __name__ == '__main__':
    import MetaTrader5 as mt5
    print(json.dumps(read_daily(mt5, json.load(sys.stdin))))
