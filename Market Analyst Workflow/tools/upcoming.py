"""Bounded upcoming occurrences using the terminal's source-ID family definitions."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import re

from storage.currencies import CURRENCIES
from storage.research_reports import ResearchRequest, collect_evidence, evidence_row
from storage.highlights import highlight_snapshot


def family_index(root):
    # These eight maintained files declare plain literal objects. Fail visibly if
    # their representation changes; do not silently fall back to name matching.
    families = {}
    for currency in CURRENCIES:
        text = (Path(root) / f'frontend/src/economic-calendar/catalog/{currency}.ts').read_text(encoding='utf-8')
        objects = re.findall(r'\{\s*id:\s*.*?\}', text, re.DOTALL)
        if not objects:
            raise ValueError(f'No literal calendar families found for {currency}')
        for block in objects:
            fields = dict(re.findall(r"(id|label|country|currency|category):\s*'([^']*)'", block))
            events = re.search(r'events:\s*\[([^]]*)\]', block, re.DOTALL)
            if len(fields) != 5 or not events:
                raise ValueError('Calendar family format changed; update the analyst family reader')
            fields['events'] = re.findall(r"'([0-9]+)'", events[1])
            for identity in fields['events']:
                families[(fields['country'], fields['currency'], identity)] = fields
    # Match completeCalendarCatalog's inventory extension as well as the major
    # families. Source-labelled releases remain distinct, including unknown IDs.
    catalog = Path(root) / 'frontend/src/economic-calendar/catalog'
    text = (catalog / 'complete-catalog.ts').read_text(encoding='utf-8')
    def literal_table(name):
        table = re.search(rf'const {name}:.*?=\s*\{{(.*?)\}}', text, re.DOTALL)
        if not table:
            raise ValueError('Calendar category format changed; update the analyst reader')
        return dict(re.findall(r"([A-Za-z]+):\s*'([^']*)'", table[1]))
    categories, countries = literal_table('categories'), literal_table('countries')
    groups = {}
    for event in json.loads((catalog / 'source-events.json').read_text(encoding='utf-8')):
        key = (event['country'], event['currency'], event['id'])
        if key in families:
            continue
        category = categories.get(event['sector'], 'other')
        name = 'Holidays' if category == 'holidays' else re.sub(r'\s+(?:[myq]/\s*[myq]|s\.a\.)', '', event['name'] or f"MT5 event {event['id']}").strip()
        family = groups.setdefault((event['country'], event['currency'], category, name), {
            'id': f"mt5-{event['id']}", 'label': f"{countries.get(event['country'], event['country'])} · {name}",
            'country': event['country'], 'currency': event['currency'], 'category': category, 'events': [], 'source_labels': True})
        family['events'].append(event['id'])
        families[key] = family
    return families


def upcoming_snapshot(store, args, root, zone):
    now = datetime.fromisoformat(args.as_of.replace('Z', '+00:00')) if args.as_of else datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError('--as-of needs a timezone-aware instant')
    start = now.astimezone(zone).date()
    end = start + timedelta(days=args.days - 1)
    currencies = list(CURRENCIES) if args.scope == 'all' else [args.scope[:3]] + ([args.scope[3:]] if len(args.scope) == 6 else [])
    if any(currency not in CURRENCIES for currency in currencies) or len(set(currencies)) != len(currencies):
        raise ValueError('Choose all, a supported currency or a pair')
    families = family_index(root)
    pins = highlight_snapshot(store, args.broker, visibility='all')['items']
    groups, coverage = {}, {}
    revision = None
    for currency in currencies:
        request = ResearchRequest(source_id=args.broker, title='Upcoming candidates', scope=currency, kind='upcoming',
            from_date=start, to_date=end, from_utc_ms=int(datetime.combine(start, datetime.min.time(), zone).timestamp()*1000),
            to_utc_ms=int(datetime.combine(end+timedelta(days=1), datetime.min.time(), zone).timestamp()*1000), timezone=args.zone, context_days=0)
        selected, _, gaps, revision = collect_evidence(store, request)
        coverage.update(gaps)
        for event in selected:
            at = event['release_at']
            if at is not None and at <= now.timestamp()*1000:
                continue
            family = families.get((event['country_code'], currency, event['event_id']))
            family_id = family['id'] if family else f'{currency.lower()}-other'
            label = family['label'] if family else event['name']
            category = family['category'] if family else 'other'
            if (args.currency and currency != args.currency) or (args.family and family_id not in args.family) or (args.category and category not in args.category):
                continue
            if args.match and not any(term.casefold() in (label+' '+event['name']+' '+event['event_id']).casefold() for term in args.match.split('|') if term):
                continue
            time = evidence_row(event, 'selected')['time']
            # Source-labelled speech publications must remain distinct.
            suffix = event['name'] if not family or family.get('source_labels') or family_id.endswith('-speakers') or family_id in ('fed-chair', 'ecb-president', 'boe-governor') else ''
            group = groups.setdefault((currency, event['country_code'], family_id, time, suffix), {
                'time': time, 'currency': currency, 'country': event['country_code'], 'family_id': family_id,
                'label': suffix or label, 'category': category, 'value_ids': [], 'event_ids': [], 'readings': [],
                'release_at': at,
                'publication_stage_note': 'Exact publication windows; verify policy decision, projections and press-conference stages on the official schedule.'})
            group['value_ids'].append(event['value_id'])
            if event['event_id'] not in group['event_ids']:
                group['event_ids'].append(event['event_id'])
            group['readings'].append(evidence_row(event, 'selected'))
    items = sorted(groups.values(), key=lambda item: (item['time'], item['currency'], item['label']))
    for item in items:
        matching = [pin for pin in pins if set(pin['value_ids']) & set(item['value_ids'])]
        item['highlights'] = [{'id': pin['id'], 'archived_utc': pin['archived_utc']} for pin in matching]
        related = [pin for pin in pins if pin['currency'] == item['currency'] and
            (pin['family_id'] == item['family_id'] or set(pin['event_ids']) & set(item['event_ids'])) and pin not in matching
            and pin['release_at'] is not None and item['release_at'] is not None and pin['release_at'] < item['release_at']]
        item['prior_investigations'] = [{'highlight_id': pin['id'], 'label': pin['label'], 'archived_utc': pin['archived_utc'],
            'research': [{'id': entry['id'], 'as_of_utc': entry['as_of_utc'], 'scope': entry['scope'], 'phase': entry['phase']}
                         for entry in pin['journal']]} for pin in related if pin['journal']]
    return {'broker': args.broker, 'scope': args.scope, 'as_of_utc': now.isoformat(), 'zone': args.zone,
        'calendar_revision': revision, 'coverage_raw_broker_clock': coverage,
        'note': 'Research candidates, not scored recommendations. Calendar gaps and missing publisher series require official web research. Stored vintages are current, even with an earlier --as-of.',
        'matches': len(items), 'offset': args.offset, 'next_offset': args.offset+args.limit if args.offset+args.limit < len(items) else None,
        'items': items[args.offset:args.offset+args.limit]}
