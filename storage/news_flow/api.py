"""Only this router exposes News Flow; the application only mounts it."""
from typing import Literal
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query
import time
from pydantic import BaseModel, Field, field_validator, model_validator

from .feeds import http_url
from .history import NewsHistory
from .rules import patterns, MAX_RULE_CHARS
from .notifications import NewsNotifier
from .filter_policy import canonical_policy
from .relevance import matching_terms, PROFILE
from .importance import decision


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
    collect_enabled: bool | None = None

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


class NotificationRules(BaseModel):
    include: str = Field(default='', max_length=MAX_RULE_CHARS)
    exclude: str = Field(default='', max_length=MAX_RULE_CHARS)
    hidden: list[str] = Field(default_factory=list, max_length=1000)
    market_relevance: bool = True
    preset_version: int = Field(default=PROFILE['version'], ge=1, le=PROFILE['version'])
    filter_policy: str | None = Field(default=None, max_length=16000)

    @field_validator('filter_policy')
    @classmethod
    def automatic_filters(cls, value):
        return canonical_policy(value) if value is not None else None


class HeadlineCheck(NotificationRules):
    title: str = Field(min_length=1, max_length=2000)
    url: str = Field(default='', max_length=2000)
    feed_url: str = Field(default='', max_length=4000)

    @field_validator('url', 'feed_url')
    @classmethod
    def context_urls(cls, value):
        return http_url(value) if value else ''


class NotificationInput(NotificationRules):
    mode: Literal['off', 'included', 'all']


class NotificationDelivery(BaseModel):
    mode: Literal['off', 'included', 'all']
    max_age_seconds: int | None = Field(default=86400, ge=3600, le=31536000, multiple_of=3600, strict=True)


def news_router(store, collector, notifier=None):
    router = APIRouter(prefix='/api/v1/news-flow')
    history = NewsHistory(store, collector)
    notifier = notifier or NewsNotifier(store)

    @router.get('/sources')
    def sources():
        return {'sources': [{key: value for key, value in source.items() if key not in ('etag', 'modified')} for source in store.sources()]}

    @router.get('/diagnostics')
    def diagnostics(source: str = Query(min_length=1, max_length=100)):
        try:
            return store.diagnostics(source)
        except KeyError as error:
            raise HTTPException(404, 'Provider not found') from error

    def save(body, identity=None):
        try:
            identity = store.save_source(body.name, body.url, identity, body.poll_seconds, body.collect_enabled)
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
              exclude: str = Query(default='', max_length=MAX_RULE_CHARS), mode: Literal['all', 'priority', 'included', 'excluded'] = 'all', priority: bool = False,
              search: str = Query(default='', max_length=500),
              organizer: Literal['all', 'central-banks', 'expectations', 'starred'] = 'all',
              market_relevance: bool = False,
              filter_policy: str = Query(default='', max_length=16000),
              currency: Literal['all', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'] = 'all'):
        validate_rules(include, exclude)
        try:
            filters = canonical_policy(filter_policy)
        except ValueError as error:
            raise HTTPException(422, 'Invalid automatic filter settings') from error
        return dict(sources=source, include=include, exclude=exclude, mode=mode, priority=priority, search=search, organizer=organizer, currency=currency, market_relevance=market_relevance, filter_policy=filters)

    @router.post('/classify')
    def check_headline(body: HeadlineCheck):
        validate_rules(body.include, body.exclude)
        return {'relevance': decision(body.title, url=body.url, feed_url=body.feed_url,
                                      include=body.include, exclude=body.exclude, enabled=body.market_relevance,
                                      filter_policy=body.filter_policy or '{}'),
                'matched_include': matching_terms(body.title, body.include),
                'matched_exclude': matching_terms(body.title, body.exclude)}

    @router.get('/items')
    def items(scope: dict = Depends(item_scope), start: int | None = None, end: int | None = None,
              order: Literal['newest', 'oldest'] = 'newest', sort_by: Literal['published', 'collected'] = 'published', offset: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=200)):
        return store.query(**scope, start=start, end=end, order=order, sort_by=sort_by, offset=offset, limit=limit)

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

    @router.get('/notifications')
    def notification_status():
        return notifier.status()

    @router.get('/phone-profile')
    def phone_profile():
        # Read-only gateway can expose the last desktop keyword/provider rules,
        # never ntfy setup credentials or publisher permissions.
        return {key: value for key, value in notifier.settings().items() if key != 'mode'}

    @router.put('/notifications')
    def notification_settings(body: NotificationInput):
        validate_rules(body.include, body.exclude)
        return notifier.configure(body.model_dump(exclude={'mode'}, exclude_none=True), body.mode)

    @router.put('/notifications/rules')
    def notification_rules(body: NotificationRules):
        validate_rules(body.include, body.exclude)
        return notifier.configure(body.model_dump(exclude_none=True))

    @router.put('/notifications/settings')
    def notification_delivery(body: NotificationDelivery):
        return notifier.configure({'max_age_seconds': body.max_age_seconds, 'unified_alerts': True}, body.mode)

    @router.post('/notifications/test')
    def notification_test():
        try:
            return notifier.test()
        except Exception as error:
            raise HTTPException(503, 'Could not reach local ntfy. Start pnpm run dev:all and check the phone service.') from error

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
                 mode: Literal['included', 'all'] = 'included', market_relevance: bool = False, configured: bool = False,
                 filter_policy: str = Query(default='', max_length=16000)):
        if configured:
            profile = notifier.settings()
            page = store.arrivals(after, profile['include'], profile['exclude'], profile['hidden'],
                                  mode='all' if profile['mode'] == 'off' else profile['mode'],
                                  market_relevance=profile.get('market_relevance', True), max_age_seconds=profile['max_age_seconds'], filter_policy=profile.get('filter_policy', '{}'))
            if profile['mode'] == 'off':
                page['items'] = []
            return page
        validate_rules(include, exclude)
        try:
            filters = canonical_policy(filter_policy)
        except ValueError as error:
            raise HTTPException(422, 'Invalid automatic filter settings') from error
        return store.arrivals(after, include, exclude, hidden, mode=mode, market_relevance=market_relevance, filter_policy=filters)

    @router.post('/refresh', status_code=202)
    def refresh():
        collector.refresh()
        return {'scheduled': True}

    return router
