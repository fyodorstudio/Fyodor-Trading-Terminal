"""Publication-dated story projection over immutable currency research.

The index stores pointers, not duplicated research. Older assessments are loaded
only when requested through the existing exact-run API.
"""
from copy import deepcopy
from datetime import date, datetime
from functools import lru_cache
from hashlib import sha256
import json
import re

from .currency_news import CURRENCIES, DIRECTORY, JAKARTA, encoded, read_run, read_rows, read_state, valid_id


def publication_date(item, checked_at):
    if item.published_at:
        return item.published_at.astimezone(JAKARTA).date().isoformat()
    if item.published_date:
        return item.published_date.isoformat()
    if item.story_id:
        return checked_at.astimezone(JAKARTA).date().isoformat()
    # Compatibility for the old date-in-prose contract. New saves use the explicit
    # published_date field and never need to infer a date from headline text.
    note = item.timing_note
    match = re.search(r'\b(20\d{2}-\d{2}-\d{2})\b', note)
    if match:
        return date.fromisoformat(match[1]).isoformat()
    match = re.search(r'\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})(?:,? (20\d{2}))?\b', note)
    if match:
        year = int(match[3]) if match[3] else checked_at.astimezone(JAKARTA).year
        parsed = datetime.strptime(f'{match[1]} {match[2]} {year}', '%B %d %Y').date()
        if not match[3] and parsed > checked_at.astimezone(JAKARTA).date():
            parsed = parsed.replace(year=year - 1)
        return parsed.isoformat()
    return checked_at.astimezone(JAKARTA).date().isoformat()


def story_key(item):
    return item.story_id or 'legacy:' + sha256(encoded({
        'summary': item.summary, 'published_at': item.published_at.isoformat() if item.published_at else None,
        'sources': sorted(s.url for s in item.sources),
    })).hexdigest()


def add_stories(index, request, run_id, saved_at):
    result = deepcopy(index)
    for row in request.rows:
        seen = set()
        for collection in ('items', 'background'):
            for position, item in enumerate(getattr(row, collection)):
                key = story_key(item)
                if key in seen:
                    raise ValueError(f'Duplicate story for {row.currency}: {key}')
                seen.add(key)
                pointer = dict(run_id=run_id, collection=collection, position=position,
                    assessed_at=row.checked_at.isoformat(), saved_at=saved_at,
                    date=publication_date(item, row.checked_at),
                    order_at=(item.published_at or row.checked_at).isoformat())
                versions = result.setdefault(key, {}).setdefault(row.currency, [])
                if not any(v['run_id'] == run_id for v in versions):
                    versions.append(pointer)
                    versions.sort(key=lambda p: (p['assessed_at'], p['saved_at'], p['run_id']), reverse=True)
    return result


@lru_cache(maxsize=4)
def legacy_story_index(directory, history_json):
    result = {}
    for run_id, meta in json.loads(history_json).items():
        request, saved_at = read_run(directory, run_id)
        if saved_at != meta['saved_at']:
            raise ValueError('Story history does not match its saved refresh')
        result = add_stories(result, request, run_id, saved_at)
    return result


def story_index(directory, history, state=None):
    path = directory / 'latest.json'
    if path.exists():
        state = json.loads(path.read_text(encoding='utf-8')) if state is None else state
        if state.get('schema') == 3:
            index = state.get('stories')
            if not isinstance(index, dict):
                raise ValueError('Invalid story index; research history is preserved')
            for key, currencies in index.items():
                if not isinstance(key, str) or not isinstance(currencies, dict) or not currencies:
                    raise ValueError('Invalid story index entry')
                for currency, versions in currencies.items():
                    if currency not in CURRENCIES or not isinstance(versions, list) or not versions:
                        raise ValueError('Invalid story currency')
                    for p in versions:
                        if not isinstance(p, dict) or p.get('run_id') not in history or not valid_id(p['run_id']):
                            raise ValueError('Story points outside committed history')
                        if p.get('collection') not in ('items', 'background') or type(p.get('position')) is not int or p['position'] < 0:
                            raise ValueError('Invalid story item pointer')
                        for field in ('assessed_at', 'saved_at', 'order_at'):
                            value = datetime.fromisoformat(p[field])
                            if value.tzinfo is None or value.utcoffset() is None:
                                raise ValueError('Invalid story clock')
                        date.fromisoformat(p['date'])
                        if p['saved_at'] != history[p['run_id']]['saved_at'] or currency not in history[p['run_id']]['currencies']:
                            raise ValueError('Invalid story history metadata')
                    if versions != sorted(versions, key=lambda p: (p['assessed_at'], p['saved_at'], p['run_id']), reverse=True):
                        raise ValueError('Unordered story assessments')
            return index
    return legacy_story_index(str(directory), encoded(history).decode('utf-8'))


def latest_pointer(currencies):
    return max((versions[0] for versions in currencies.values()), key=lambda p: (p['assessed_at'], p['saved_at'], p['run_id']))


def legacy_prose(item):
    """Move explicit legacy qualification sentences to commentary, verbatim.

    Do not infer an economic view or rewrite source facts during migration.
    """
    markers = (' This is an attributed brief headline,', ' This is expectation and analyst opinion,',
               ' This is reported cross-market context,', ' Negotiation reports do not establish restored supply.')
    split = min((item.summary.find(m) for m in markers if m in item.summary), default=-1)
    return (item.summary[:split], item.summary[split:].strip()) if split >= 0 else (item.summary, '')


def news_feed(directory=DIRECTORY, selected_date=None, after_revision=None):
    selected_date = date.fromisoformat(selected_date).isoformat()
    path = directory / 'latest.json'
    state = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    latest, history = read_state(directory, legacy_history=True, state=state)
    index = story_index(directory, history, state=state)
    selected = {key: currencies for key, currencies in index.items() if latest_pointer(currencies)['date'] == selected_date}
    checks = {c: rid for c, rid in latest.items()
              if datetime.fromisoformat(history[rid]['saved_at']).astimezone(JAKARTA).date().isoformat() == selected_date}
    revision = sha256(encoded({'date': selected_date, 'stories': selected, 'checks': checks})).hexdigest()
    result = dict(schema=2, date=selected_date, revision=revision)
    if revision == after_revision:
        return {**result, 'unchanged': True}
    runs = {}

    def load(pointer, currency, key):
        rid = pointer['run_id']
        if rid not in runs:
            runs[rid] = read_run(directory, rid)
        request, saved_at = runs[rid]
        row = next(r for r in request.rows if r.currency == currency)
        item = getattr(row, pointer['collection'])[pointer['position']]
        if (story_key(item) != key or pointer['date'] != publication_date(item, row.checked_at)
                or pointer['assessed_at'] != row.checked_at.isoformat() or pointer['saved_at'] != saved_at
                or pointer['order_at'] != (item.published_at or row.checked_at).isoformat()):
            raise ValueError('Story pointer does not match immutable research')
        return row, item

    stories = []
    for key, currencies in selected.items():
        pointer = latest_pointer(currencies)
        lead_currency = next(c for c, v in currencies.items() if v[0] == pointer)
        _, headline = load(pointer, lead_currency, key)
        summary, _ = legacy_prose(headline) if headline.story_id is None else (headline.summary, '')
        implications, sources = [], {}
        for currency in CURRENCIES:
            if currency not in currencies:
                continue
            versions = currencies[currency]
            row, item = load(versions[0], currency, key)
            _, qualification = legacy_prose(item) if item.story_id is None else (item.summary, '')
            implications.append(dict(currency=currency,
                legacy=item.bias is None,
                bias=item.bias or dict(supportive='bullish', negative='bearish', mixed='conditional', no_clear_signal='neutral')[row.implication],
                reason=' '.join(x for x in (item.reason or row.reason, qualification) if x),
                bullish_if=item.bullish_if, bearish_if=item.bearish_if,
                coverage_note=row.coverage_note, timing_note=item.timing_note,
                versions=[{k: p[k] for k in ('run_id', 'assessed_at', 'collection', 'position')} for p in versions]))
            for source in item.sources:
                sources[source.url] = source.model_dump()
        stories.append(dict(id=key, summary=summary, published_at=headline.published_at.isoformat() if headline.published_at else None,
            published_date=publication_date(headline, datetime.fromisoformat(pointer['assessed_at'])),
            assessed_at=pointer['assessed_at'], order_at=pointer['order_at'], sources=list(sources.values()), implications=implications))
    stories.sort(key=lambda s: (s['order_at'], s['id']), reverse=True)
    coverage = [dict(currency=r['currency'], checked_at=r['snapshot']['checked_at'], coverage=r['snapshot']['coverage'],
        note=r['snapshot']['coverage_note']) for r in read_rows(directory, checks, runs) if r['snapshot']]
    updates = [p['saved_at'] for currencies in selected.values() for versions in currencies.values() for p in versions[:1]]
    updates.extend(history[rid]['saved_at'] for rid in checks.values())
    return {**result, 'updated_at': max(updates, default=None), 'stories': stories, 'coverage': coverage}
