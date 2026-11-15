"""Only this router exposes News Flow; the application only mounts it."""
from typing import Literal
import sqlite3

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from .feeds import http_url


class ProviderInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    url: str = Field(min_length=1, max_length=2000)

    @field_validator('name', 'url')
    @classmethod
    def clean(cls, value, info):
        value = value.strip()
        if not value:
            raise ValueError('Enter a provider name and feed URL')
        return http_url(value) if info.field_name == 'url' else value


def news_router(store, collector):
    router = APIRouter(prefix='/api/v1/news-flow')

    @router.get('/sources')
    def sources():
        return {'sources': [{key: value for key, value in source.items() if key not in ('etag', 'modified')} for source in store.sources()]}

    def save(body, identity=None):
        try:
            identity = store.save_source(body.name, body.url, identity)
        except sqlite3.IntegrityError as error:
            raise HTTPException(409, 'This feed URL is already configured') from error
        except KeyError as error:
            raise HTTPException(404, 'Provider not found') from error
        collector.refresh()
        return {'id': identity}

    @router.post('/sources')
    def add_source(body: ProviderInput):
        return save(body)

    @router.put('/sources/{identity}')
    def update_source(identity: str, body: ProviderInput):
        return save(body, identity)

    @router.get('/items')
    def items(source: list[str] = Query(default=[]), include: str = Query(default='', max_length=2000),
              exclude: str = Query(default='', max_length=2000), match: Literal['any', 'all'] = 'any',
              start: int | None = None, end: int | None = None, order: Literal['newest', 'oldest'] = 'newest',
              offset: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=200)):
        return store.query(source, include, exclude, match, start, end, order, offset, limit)

    @router.post('/refresh', status_code=202)
    def refresh():
        collector.refresh()
        return {'scheduled': True}

    return router
