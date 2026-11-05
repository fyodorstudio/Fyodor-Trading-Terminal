"""Compact research preparation and scoped Detail persistence/read-back."""
from contextlib import closing
from datetime import datetime, timezone
from urllib.parse import urlencode

from storage.calendar_store import CalendarStore
from storage.currency_details import DetailRefresh, save_details
from storage.currency_news import read_state as news_state, read_rows as news_rows
from storage.detail_projection import detail_snapshot, prepare_details
from storage.detail_registry import metric_by_id, resolve_scope


def run_details(args, local_path, get_json):
    currencies = resolve_scope(args.scope)
    directory = local_path(args.database).parent / 'currency-details'
    with closing(CalendarStore(local_path(args.database), readonly=True)) as store:
        if args.action == 'save':
            if not args.input:
                raise ValueError('Detail save needs --input; see docs/CURRENCY-DETAILS.md')
            request = DetailRefresh.model_validate_json(local_path(args.input).read_text(encoding='utf-8-sig'))
            if (any(metric_by_id(c.metric_id)['currency'] not in currencies for c in request.checks)
                    or any(f.currency not in currencies for f in request.focus)):
                raise ValueError('Detail save exceeds the researched scope')
            return save_details(request, directory, store)
        now = int(datetime.now(timezone.utc).timestamp()*1000)
        snapshot = detail_snapshot(store, args.broker, currencies, directory, now_ms=now)
        if args.action == 'verify':
            served = get_json(args.storage, 'currency-details?' + urlencode(dict(source_id=args.broker, scope=args.scope, at_utc_ms=now)))
            if served != snapshot:
                raise ValueError("Running storage does not serve this checkout's Detail evidence; restart the correct stack and retry")
            return {'panel_delivery_verified': True, 'currencies': currencies, 'revision': snapshot['revision'],
                    'conflicts': [m['id'] for m in snapshot['metrics'] if m['comparison'] == 'conflict']}
        if args.action == 'prepare':
            prepared = prepare_details(snapshot, now)
            # Reuse only the requested current News, never raw archives.
            news_directory = local_path(args.database).parent / 'currency-news'
            index, _ = news_state(news_directory)
            prepared['news'] = [r for r in news_rows(news_directory, {c: index[c] for c in currencies if c in index}) if r['currency'] in currencies]
            return prepared
        return snapshot
