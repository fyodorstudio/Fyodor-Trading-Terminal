"""Immutable official observations/checks, independent from raw MT5 and News."""
from datetime import date, datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
from threading import RLock
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, model_validator

from .currency_news import JAKARTA, NewsPayload, NewsSource, atomic_write, clock, encoded
from .data_lock import data_lock
from .detail_registry import metric_by_id, registry

LOCK = RLock()
STAGES = Literal['flash', 'preliminary', 'advance', 'second', 'final', 'revised', 'decision', 'regular']


def check_sources(sources, metric=None):
    if metric:
        publisher = registry()['sources'][metric['source']]
        hosts = publisher.get('allowed_hosts', [urlsplit(publisher['url']).hostname])
        if not any(urlsplit(s.url).hostname in hosts for s in sources):
            raise ValueError('Detail needs a direct source from the registered publisher')


class BrokerReference(NewsPayload):
    source_id: str = Field(min_length=1, max_length=160)
    value_id: str = Field(min_length=1, max_length=32)
    basis_note: str = Field(min_length=1, max_length=600)


class DetailObservation(NewsPayload):
    # Period is an ISO date identifying the reference period, not publication.
    period: date
    stage: STAGES
    value: float = Field(allow_inf_nan=False)
    lower: float | None = Field(default=None, allow_inf_nan=False)
    released_at: datetime | None = None
    released_date: date
    verified_at: datetime
    sources: list[NewsSource] = Field(min_length=1, max_length=8)
    broker_reference: BrokerReference | None = None
    note: str = Field(default='', max_length=1000)

    @model_validator(mode='after')
    def valid(self):
        self.verified_at = clock(self.verified_at)
        if self.verified_at > datetime.now(timezone.utc):
            raise ValueError('Verification cannot be in the future')
        if self.released_at:
            self.released_at = clock(self.released_at)
            if self.released_at > self.verified_at:
                raise ValueError('An observation must already be published')
            if self.released_at.astimezone(JAKARTA).date() != self.released_date:
                raise ValueError('Release date must match its Jakarta instant')
        if self.released_date > self.verified_at.astimezone(JAKARTA).date() or self.period > self.released_date:
            raise ValueError('Observation period/publication is after verification')
        if self.lower is not None and self.lower > self.value:
            raise ValueError('Range lower bound exceeds upper bound')
        return self


class DetailSchedule(NewsPayload):
    stage: STAGES
    period: date | None = None
    at: datetime | None = None
    date: date
    sources: list[NewsSource] = Field(min_length=1, max_length=8)
    note: str = Field(default='', max_length=600)

    @model_validator(mode='after')
    def timing(self):
        if self.at:
            self.at = clock(self.at)
            if self.at.astimezone(JAKARTA).date() != self.date:
                raise ValueError('Schedule date must match its Jakarta instant')
        return self


class DetailCheck(NewsPayload):
    metric_id: str
    checked_at: datetime
    coverage: Literal['checked', 'partial', 'unavailable']
    coverage_note: str = Field(default='', max_length=1000)
    sources: list[NewsSource] = Field(min_length=1, max_length=8)
    observation: DetailObservation | None = None
    # null: schedule not checked; []: checked, no confirmed next occurrence.
    next_releases: list[DetailSchedule] | None = Field(default=None, max_length=6)

    @model_validator(mode='after')
    def valid(self):
        metric = metric_by_id(self.metric_id)
        self.checked_at = clock(self.checked_at)
        if self.checked_at > datetime.now(timezone.utc):
            raise ValueError('Source check cannot be in the future')
        if self.coverage != 'checked' and not self.coverage_note:
            raise ValueError('Incomplete checks need a coverage note')
        check_sources(self.sources, metric)
        if self.observation:
            check_sources(self.observation.sources, metric)
            if self.coverage == 'unavailable' or self.observation.verified_at > self.checked_at:
                raise ValueError('An unavailable or earlier check cannot verify an observation')
            if self.observation.lower is not None and self.metric_id != 'usd.rate':
                raise ValueError('Only the Fed target metric uses a range')
        for release in self.next_releases or []:
            check_sources(release.sources, metric)
        return self


class DetailFocus(NewsPayload):
    currency: str
    label: str = Field(min_length=1, max_length=160)
    reason: str = Field(min_length=1, max_length=1400)
    limitations: str = Field(min_length=1, max_length=800)
    assessed_at: datetime
    sources: list[NewsSource] = Field(min_length=1, max_length=8)

    @model_validator(mode='after')
    def valid(self):
        from .currencies import CURRENCIES
        self.assessed_at = clock(self.assessed_at)
        if self.currency not in CURRENCIES or self.assessed_at > datetime.now(timezone.utc):
            raise ValueError('Invalid focus currency or assessment time')
        return self


class DetailRefresh(NewsPayload):
    checks: list[DetailCheck] = Field(default_factory=list, max_length=128)
    focus: list[DetailFocus] = Field(default_factory=list, max_length=8)

    @model_validator(mode='after')
    def unique(self):
        if not self.checks and not self.focus:
            raise ValueError('Supply researched metrics or a sourced focus assessment')
        for values in ([c.metric_id for c in self.checks], [f.currency for f in self.focus]):
            if len(values) != len(set(values)):
                raise ValueError('Duplicate Detail identity')
        return self


def read_state(directory):
    path = Path(directory) / 'latest.json'
    if not path.exists():
        return {'schema': 1, 'metrics': {}, 'focus': {}, 'history': {}}
    state = json.loads(path.read_text(encoding='utf-8'))
    if state.get('schema') != 1 or any(not isinstance(state.get(k), dict) for k in ('metrics', 'focus', 'history')):
        raise ValueError('Invalid Detail state; preserve history and recover from backup')
    return state


def read_records(directory, state=None, currencies=None):
    state = read_state(directory) if state is None else state
    runs = {}
    def entry(pointer, kind, identity):
        if pointer not in state['history']:
            raise ValueError('Uncommitted Detail run')
        if pointer not in runs:
            path = Path(directory) / 'runs' / (pointer + '.json')
            body = json.loads(path.read_text(encoding='utf-8'))
            if sha256(encoded(body['request'])).hexdigest() != pointer:
                raise ValueError('Detail run integrity mismatch')
            runs[pointer] = DetailRefresh.model_validate(body['request'])
        return next(r for r in getattr(runs[pointer], kind) if getattr(r, 'metric_id' if kind == 'checks' else 'currency') == identity).model_dump(mode='json')
    metrics = {}
    for identity, pointers in state['metrics'].items():
        if currencies and metric_by_id(identity)['currency'] not in currencies:
            continue
        current = entry(pointers['check'], 'checks', identity)
        current['observation'] = entry(pointers['observation'], 'checks', identity)['observation'] if pointers.get('observation') else None
        schedule = entry(pointers['schedule'], 'checks', identity) if pointers.get('schedule') else None
        current['next_releases'] = schedule['next_releases'] if schedule else None
        current['schedule_checked_at'] = schedule['checked_at'] if schedule else None
        metrics[identity] = current
    return metrics, {c: entry(pointer, 'focus', c) for c, pointer in state['focus'].items() if not currencies or c in currencies}


def save_details(request, directory, store):
    from .detail_projection import broker_matches, period_key
    directory = Path(directory)
    body = request.model_dump(mode='json')
    run_id = sha256(encoded(body)).hexdigest()
    with LOCK, data_lock(directory):
        state = read_state(directory)
        if run_id in state['history']:
            if (any(state['metrics'].get(c.metric_id, {}).get('check') != run_id for c in request.checks)
                    or any(state['focus'].get(f.currency) != run_id for f in request.focus)):
                raise ValueError('Saved run has been superseded; reread the latest Detail evidence')
            return {'saved': True, 'run_id': run_id, 'unchanged': True}
        metrics, focus = read_records(directory, state)
        for check in request.checks:
            previous = metrics.get(check.metric_id)
            metric = metric_by_id(check.metric_id)
            if previous and check.checked_at <= datetime.fromisoformat(previous['checked_at']):
                raise ValueError('An equal/newer Detail check exists; reread and reconcile')
            obs = check.observation
            if obs and ((metric['frequency'] == 'monthly' and obs.period.day != 1)
                        or (metric['frequency'] == 'quarterly' and (obs.period.day != 1 or obs.period.month not in (1, 4, 7, 10)))):
                raise ValueError('Normalize reference periods to the first day of their month/quarter')
            if obs and previous and previous['observation']:
                old = previous['observation']
                if obs.period.isoformat() < old['period'] or obs.verified_at <= datetime.fromisoformat(old['verified_at']):
                    raise ValueError('Do not replace a newer observation/verification with an older one')
                if obs.period.isoformat() == old['period']:
                    stages = {'flash': 0, 'preliminary': 0, 'advance': 0, 'second': 1, 'regular': 1, 'final': 2, 'revised': 3, 'decision': 0}
                    if obs.released_date.isoformat() < old['released_date'] or stages[obs.stage] < stages[old['stage']]:
                        raise ValueError('Do not replace a later publication stage with an earlier vintage')
            if obs and obs.broker_reference:
                ref = obs.broker_reference
                values = store.values(ref.source_id, [ref.value_id])
                if (len(values) != 1 or not broker_matches(values[0], metric)
                        or period_key(values[0], metric) != obs.period.isoformat()):
                    raise ValueError('Broker reference does not match the metric and reference period')
                value = values[0]
                release_date = datetime.fromtimestamp(value['release_at']/1000, timezone.utc).date().isoformat() if value['release_at'] else datetime.fromtimestamp(value['server_time_seconds'], timezone.utc).date().isoformat()
                official_date = obs.released_at.date().isoformat() if obs.released_at else obs.released_date.isoformat()
                if release_date != official_date:
                    raise ValueError('Broker reference needs the same publication date/stage; do not blend vintages')
        for item in request.focus:
            if item.currency in focus and item.assessed_at <= datetime.fromisoformat(focus[item.currency]['assessed_at']):
                raise ValueError('An equal/newer focus assessment exists')
        for check in request.checks:
            pointers = {**state['metrics'].get(check.metric_id, {}), 'check': run_id}
            if check.observation:
                pointers['observation'] = run_id
            if check.next_releases is not None:
                pointers['schedule'] = run_id
            state['metrics'][check.metric_id] = pointers
        state['focus'].update({f.currency: run_id for f in request.focus})
        state['history'][run_id] = {'saved_at': datetime.now(timezone.utc).isoformat(), 'metrics': [c.metric_id for c in request.checks], 'focus': [f.currency for f in request.focus]}
        atomic_write(directory / 'runs' / (run_id + '.json'), {'schema': 1, 'request': body})
        atomic_write(directory / 'latest.json', state)
        read_records(directory)
        return {'saved': True, 'run_id': run_id, 'metrics': [c.metric_id for c in request.checks], 'readback_verified': True}
