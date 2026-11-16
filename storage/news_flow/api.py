"""Only this router exposes News Flow; the application only mounts it."""
from typing import Literal
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query
import time
from pydantic import BaseModel, Field, field_validator, model_validator

from .feeds import http_url
from .history import NewsHistory
from .rules import patterns, MAX_RULE_CHARS


class HistoryInput(BaseModel):
    start: int = Field(ge=0, le=4102444800000)
    end: int = Field(ge=0, le=4102444800000)
    source: list[str] = Field(default_factory=list, max_length=100)
    force: bool = False

    @model_validator(mode='after')
    def single_day(self):
        if not 0 < self.end - self.start <= 36 * 3600_000:
            raise ValueError('Choose a single calendar day')
        return self


class ProviderInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    url: str = Field(min_length=1, max_length=2000)
    poll_seconds: int | None = Field(default=None, ge=1, le=3600, strict=True)

    @field_validator('name', 'url')
    @classmethod
    def clean(cls, value, info):
        value = value.strip()
        if not value:
            raise ValueError('Enter a provider name and feed URL')
        return http_url(value) if info.field_name == 'url' else value


class PinInput(BaseModel):
    url: str = Field(max_length=2000)
    pinned: bool

    @field_validator('url')
    @classmethod
    def valid_url(cls, value):
        return http_url(value)


def news_router(store, collector):
    router = APIRouter(prefix='/api/v1/news-flow')
    history = NewsHistory(store, collector)

    @router.get('/sources')
    def sources():
        return {'sources': [{key: value for key, value in source.items() if key not in ('etag', 'modified')} for source in store.sources()]}

    def save(body, identity=None):
        try:
            identity = store.save_source(body.name, body.url, identity, body.poll_seconds)
        except sqlite3.IntegrityError as error:
            raise HTTPException(409, 'This feed URL is already configured') from error
        except KeyError as error:
            raise HTTPException(404, 'Provider not found') from error
        return {'id': identity}

    @router.post('/sources')
    def add_source(body: ProviderInput):
        return save(body)

    @router.put('/sources/{identity}')
    def update_source(identity: str, body: ProviderInput):
        return save(body, identity)

    def item_scope(source: list[str] = Query(default=[]), include: str = Query(default='', max_length=MAX_RULE_CHARS),
              exclude: str = Query(default='', max_length=MAX_RULE_CHARS), mode: Literal['all', 'included', 'excluded'] = 'all', priority: bool = False,
              search: str = Query(default='', max_length=500),
              organizer: Literal['all', 'central-banks', 'expectations', 'starred'] = 'all',
              currency: Literal['all', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'] = 'all'):
        validate_rules(include, exclude)
        return dict(sources=source, include=include, exclude=exclude, mode=mode, priority=priority, search=search, organizer=organizer, currency=currency)

    @router.get('/items')
    def items(scope: dict = Depends(item_scope), start: int | None = None, end: int | None = None,
              order: Literal['newest', 'oldest'] = 'newest', offset: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=200)):
        return store.query(**scope, start=start, end=end, order=order, offset=offset, limit=limit)

    @router.get('/export')
    def export(scope: dict = Depends(item_scope), amount: int = Query(default=1, ge=1, le=87600), unit: Literal['hours', 'days'] = 'hours'):
        window = amount * (3600_000 if unit == 'hours' else 86400_000)
        if window > 3650 * 86400_000:
            raise HTTPException(422, 'Choose up to 3650 days or 87600 hours')
        now = int(time.time() * 1000)
        try:
            return store.export_headlines(start=now - window, end=now + 1, **scope)
        except OverflowError as error:
            raise HTTPException(413, str(error)) from error

    def validate_rules(include, exclude):
        try:
            patterns(include); patterns(exclude)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @router.put('/priority')
    def pin(body: PinInput):
        store.pin(body.url, body.pinned)
        return {'saved': True}

    @router.post('/history')
    def historical_search(body: HistoryInput):
        return history.search(body.start, body.end, body.source, body.force)

    @router.get('/arrivals')
    def arrivals(after: int | None = Query(default=None, ge=0), include: str = Query(default='', max_length=MAX_RULE_CHARS),
                 exclude: str = Query(default='', max_length=MAX_RULE_CHARS), hidden: list[str] = Query(default=[]),
                 mode: Literal['included', 'all'] = 'included'):
        validate_rules(include, exclude)
        return store.arrivals(after, include, exclude, hidden, mode=mode)

    @router.post('/refresh', status_code=202)
    def refresh():
        collector.refresh()
        return {'scheduled': True}

    return router
