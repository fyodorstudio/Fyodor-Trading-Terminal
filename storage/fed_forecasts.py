"""Small, attributed Fed forecast cache. Reads never fetch or reconstruct evidence."""
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import tempfile
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, model_validator

from .contracts import Payload
from .data_lock import data_lock


def utc(value):
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('Evidence clocks require an explicit UTC offset')
    return value.astimezone(timezone.utc)


class Evidence(Payload):
    url: str = Field(min_length=1, max_length=2000)
    captured_at: datetime
    as_of: datetime | None = None
    timing: Literal['pre_release', 'historical_backfill']
    note: str = Field(min_length=1, max_length=1000)

    @model_validator(mode='after')
    def clocks(self):
        if not self.note.strip():
            raise ValueError('Describe the source field and matching meeting')
        self.captured_at = utc(self.captured_at)
        if self.as_of is not None:
            self.as_of = utc(self.as_of)
            if self.as_of > self.captured_at:
                raise ValueError('As-of cannot follow capture')
        return self

    def publisher(self, domains):
        parsed = urlsplit(self.url)
        if (parsed.scheme != 'https' or parsed.hostname not in domains or parsed.username or parsed.password
                or parsed.port not in (None, 443) or any(c.isspace() for c in self.url)):
            raise ValueError('Use a direct HTTPS URL from the named publisher')


class Consensus(Evidence):
    provider: Literal['investing', 'trading_economics']
    value: float = Field(ge=0, le=100, allow_inf_nan=False)

    @model_validator(mode='after')
    def source(self):
        self.publisher(('investing.com', 'www.investing.com') if self.provider == 'investing'
                       else ('tradingeconomics.com', 'www.tradingeconomics.com'))
        return self


class OfficialActual(Evidence):
    lower: float = Field(ge=0, le=100, allow_inf_nan=False)
    upper: float = Field(ge=0, le=100, allow_inf_nan=False)

    @model_validator(mode='after')
    def source(self):
        self.publisher(('federalreserve.gov', 'www.federalreserve.gov'))
        if self.lower > self.upper:
            raise ValueError('Invalid official target range')
        return self


class Probability(Payload):
    lower: float = Field(ge=0, le=100, allow_inf_nan=False)
    upper: float = Field(ge=0, le=100, allow_inf_nan=False)
    probability: float = Field(ge=0, le=100, allow_inf_nan=False)


class FedWatch(Evidence):
    outcomes: list[Probability] = Field(min_length=1, max_length=32)

    @model_validator(mode='after')
    def distribution(self):
        self.publisher(('cmegroup.com', 'www.cmegroup.com', 'cmegroup-tools.quikstrike.net'))
        rows = sorted(self.outcomes, key=lambda row: row.lower)
        if any(row.lower >= row.upper for row in rows) or any(a.upper > b.lower for a, b in zip(rows, rows[1:])):
            raise ValueError('FedWatch ranges must be distinct and nonoverlapping')
        if abs(sum(row.probability for row in rows) - 100) > 0.2:
            raise ValueError('Save the full FedWatch probability distribution')
        return self


class FedMeeting(Payload):
    released_at: datetime
    actual: OfficialActual | None = None
    consensus: list[Consensus] = Field(default_factory=list, max_length=2)
    fedwatch: FedWatch | None = None

    @model_validator(mode='after')
    def evidence(self):
        self.released_at = utc(self.released_at)
        now = datetime.now(timezone.utc)
        if self.released_at > now:
            raise ValueError('This cache is for released Fed decisions')
        if len({row.provider for row in self.consensus}) != len(self.consensus):
            raise ValueError('Only one consensus per provider and meeting')
        for row in [*self.consensus, *([self.actual] if self.actual else []), *([self.fedwatch] if self.fedwatch else [])]:
            if row.captured_at > now:
                raise ValueError('Capture cannot be in the future')
            if row is self.actual:
                if row.captured_at < self.released_at or row.timing != 'historical_backfill':
                    raise ValueError('Official actual must be captured after publication')
            elif row.timing == 'pre_release':
                if row.captured_at >= self.released_at or row.as_of is None or row.as_of >= self.released_at:
                    raise ValueError('Pre-release evidence needs a pre-decision capture and as-of')
            elif row.captured_at < self.released_at:
                raise ValueError('Historical backfill must be captured after the release')
            if row is self.fedwatch and (row.as_of is None or row.as_of >= self.released_at):
                raise ValueError('FedWatch always requires an original pre-decision as-of')
            if row is not self.actual and row.as_of is not None and row.as_of >= self.released_at:
                raise ValueError('Expectations must describe a time before the decision')
        return self


class FedRefresh(Payload):
    meetings: list[FedMeeting] = Field(min_length=1, max_length=128)

    @model_validator(mode='after')
    def unique(self):
        if len({row.released_at for row in self.meetings}) != len(self.meetings):
            raise ValueError('Duplicate meeting publication instant')
        return self


def read_forecasts(directory: Path):
    path = directory / 'latest.json'
    if not path.exists():
        return {'schema': 1, 'meetings': []}
    body = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(body, dict) or body.get('schema') != 1 or set(body) != {'schema', 'meetings'}:
        raise ValueError('Unsupported Fed forecast schema')
    if not isinstance(body.get('meetings'), list):
        raise ValueError('Invalid Fed forecast cache')
    rows = [FedMeeting.model_validate(row) for row in body['meetings']]
    if len({row.released_at for row in rows}) != len(rows):
        raise ValueError('Duplicate saved Fed meeting')
    return {'schema': 1, 'meetings': [row.model_dump(mode='json') for row in rows]}


def write_json(path, body):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(prefix='.fed-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as handle:
            json.dump(body, handle, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def save_forecasts(request: FedRefresh, directory: Path):
    body = request.model_dump(mode='json')
    revision = sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
    with data_lock(directory):
        current = read_forecasts(directory)
        rows = {row['released_at']: row for row in current['meetings']}
        rows.update({row['released_at']: row for row in body['meetings']})
        archive = directory / 'history' / f'{revision}.json'
        if not archive.exists():
            write_json(archive, {'schema': 1, 'saved_at': datetime.now(timezone.utc).isoformat(), **body})
        write_json(directory / 'latest.json', {'schema': 1, 'meetings': [rows[key] for key in sorted(rows)]})
    return {'revision': revision, 'meetings': len(rows)}
