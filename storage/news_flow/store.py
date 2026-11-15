"""Separate SQLite history; no calendar or Wildcard tables are touched."""
from contextlib import closing, contextmanager
from pathlib import Path
import sqlite3
import time
import re
from threading import RLock
from uuid import uuid4

from .providers import PROVIDERS
from .rules import matches, priority_reason


class NewsStore:
    def __init__(self, root):
        self.path = Path(root) / 'news-flow' / 'news.sqlite3'
        self.lock = RLock()
        self.initialized = False

    @contextmanager
    def database(self):
        with self.lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with closing(sqlite3.connect(self.path, timeout=10)) as db:
                db.row_factory = sqlite3.Row
                db.create_function('casefold', 1, lambda value: value.casefold())
                db.create_function('news_matches', 2, matches, deterministic=True)
                db.create_function('news_priority', 2, priority_reason, deterministic=True)
                if not self.initialized:
                    db.executescript('''
                        CREATE TABLE IF NOT EXISTS sources (
                            id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
                            etag TEXT NOT NULL DEFAULT '', modified TEXT NOT NULL DEFAULT '',
                            last_success INTEGER, error TEXT NOT NULL DEFAULT '');
                        CREATE TABLE IF NOT EXISTS items (
                            id TEXT PRIMARY KEY, source_id TEXT NOT NULL, identity TEXT NOT NULL,
                            title TEXT NOT NULL, summary TEXT NOT NULL, publisher TEXT NOT NULL,
                            url TEXT NOT NULL, published_at INTEGER, first_seen INTEGER NOT NULL,
                            UNIQUE(source_id, identity));
                        CREATE INDEX IF NOT EXISTS news_time ON items(COALESCE(published_at, first_seen) DESC, id);
                        CREATE INDEX IF NOT EXISTS news_source ON items(source_id);
                        CREATE INDEX IF NOT EXISTS news_url ON items(url);
                        CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY);
                        CREATE TABLE IF NOT EXISTS pins (url TEXT PRIMARY KEY);
                        CREATE TABLE IF NOT EXISTS arrivals (
                            sequence INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT NOT NULL UNIQUE,
                            received_at INTEGER NOT NULL);
                        CREATE TABLE IF NOT EXISTS history_searches (
                            source_id TEXT NOT NULL, url TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL,
                            searched_at INTEGER NOT NULL, found INTEGER NOT NULL, error TEXT NOT NULL,
                            retry_at INTEGER NOT NULL, failures INTEGER NOT NULL,
                            PRIMARY KEY(source_id,url,start,end));
                    ''')
                    columns = {row['name'] for row in db.execute('PRAGMA table_info(sources)')}
                    for column, definition in (('poll_seconds', 'INTEGER NOT NULL DEFAULT 1'), ('next_fetch_at', 'INTEGER NOT NULL DEFAULT 0'),
                                               ('retry_at', 'INTEGER NOT NULL DEFAULT 0'), ('failures', 'INTEGER NOT NULL DEFAULT 0')):
                        if column not in columns:
                            db.execute(f'ALTER TABLE sources ADD COLUMN {column} {definition}')
                    if 'retry_at' not in columns:
                        # Older versions only persisted the retry message. Conservatively
                        # honour its full delay once instead of bypassing it on upgrade.
                        for source in db.execute("SELECT id,error FROM sources WHERE error<>''").fetchall():
                            delay = re.search(r'(?:Retrying in|Retry after) (\d+)s', source['error'])
                            if delay:
                                deadline = int(time.time() * 1000) + min(86400, int(delay[1])) * 1000
                                db.execute('UPDATE sources SET retry_at=?,next_fetch_at=?,failures=1 WHERE id=?', (deadline, deadline, source['id']))
                    if not db.execute('SELECT 1 FROM migrations WHERE name=?', ('starter-providers-v2',)).fetchone():
                        for identity, name, url, _ in PROVIDERS:
                            db.execute('INSERT OR IGNORE INTO sources(id,name,url) VALUES (?,?,?)', (identity, name, url))
                        db.execute('INSERT INTO migrations VALUES (?)', ('starter-providers-v2',))
                    db.commit()
                    self.initialized = True
                with db:
                    yield db

    def sources(self):
        with self.database() as db:
            return [dict(row) for row in db.execute('SELECT * FROM sources ORDER BY rowid')]

    def save_source(self, name, url, identity=None, poll_seconds=None):
        with self.database() as db:
            if identity is None:
                identity = uuid4().hex
                db.execute('INSERT INTO sources(id,name,url,poll_seconds) VALUES (?,?,?,?)', (identity, name, url, poll_seconds or 1))
            else:
                current = db.execute('SELECT url FROM sources WHERE id=?', (identity,)).fetchone()
                if current is None:
                    raise KeyError('Provider not found')
                db.execute('UPDATE sources SET name=?,url=?,etag=CASE WHEN url=? THEN etag ELSE ? END, modified=CASE WHEN url=? THEN modified ELSE ? END, last_success=CASE WHEN url=? THEN last_success ELSE NULL END,next_fetch_at=CASE WHEN url=? THEN next_fetch_at ELSE 0 END WHERE id=?',
                           (name, url, url, '', url, '', url, url, identity))
                if poll_seconds is not None:
                    db.execute('UPDATE sources SET poll_seconds=?,next_fetch_at=COALESCE(last_success,0)+? WHERE id=?', (poll_seconds, poll_seconds * 1000, identity))
            return identity

    def success(self, source, items, etag, modified, now, update_status=True):
        with self.database() as db:
            # Ignore an in-flight response if the user changed this feed's URL.
            current = db.execute('SELECT url,last_success,poll_seconds FROM sources WHERE id=?', (source['id'],)).fetchone()
            if current is None or current['url'] != source['url']:
                return False
            for item in items or []:
                identity = source['id'] + ':' + item['identity']
                known = db.execute('SELECT 1 FROM items WHERE id=? OR url=? LIMIT 1', (identity, item['url'])).fetchone()
                db.execute('''INSERT INTO items(id,source_id,identity,title,summary,publisher,url,published_at,first_seen)
                    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,identity) DO UPDATE SET
                    title=excluded.title,summary=excluded.summary,publisher=excluded.publisher,url=excluded.url,
                    published_at=COALESCE(excluded.published_at,items.published_at)''',
                    (source['id'] + ':' + item['identity'], source['id'], item['identity'], item['title'], item['summary'],
                     item['publisher'], item['url'], item['published_at'], now))
                # Historical imports and subsequent edits never create live alerts.
                if update_status and not known and current['last_success'] is not None:
                    db.execute('INSERT OR IGNORE INTO arrivals(item_id,received_at) VALUES (?,?)', (identity, now))
            if update_status:
                db.execute('UPDATE sources SET etag=?,modified=?,last_success=?,error=?,next_fetch_at=?,retry_at=0,failures=0 WHERE id=?', (etag, modified, now, '', now + current['poll_seconds'] * 1000, source['id']))
            return True

    def failure(self, source, error, retry_at=0, failures=0):
        with self.database() as db:
            db.execute('UPDATE sources SET error=?,retry_at=?,next_fetch_at=?,failures=? WHERE id=? AND url=?', (error[:300], retry_at, retry_at, failures, source['id'], source['url']))

    def refresh(self):
        with self.database() as db:
            db.execute('UPDATE sources SET next_fetch_at=0 WHERE retry_at<=?', (int(time.time() * 1000),))

    def pin(self, url, pinned):
        with self.database() as db:
            if pinned:
                db.execute('INSERT OR IGNORE INTO pins VALUES (?)', (url,))
            else:
                db.execute('DELETE FROM pins WHERE url=?', (url,))

    def history_search(self, source, start, end):
        with self.database() as db:
            row = db.execute('SELECT * FROM history_searches WHERE source_id=? AND url=? AND start=? AND end=?', (source['id'], source['url'], start, end)).fetchone()
            return dict(row) if row else None

    def save_history_search(self, source, start, end, now, found, error='', retry_at=0, failures=0):
        with self.database() as db:
            db.execute('INSERT OR REPLACE INTO history_searches VALUES (?,?,?,?,?,?,?,?,?)',
                       (source['id'], source['url'], start, end, now, found, error, retry_at, failures))

    def query(self, sources=(), include='', exclude='', start=None, end=None, order='newest', offset=0, limit=100, mode='all', priority=False):
        clauses, args = [], []
        if sources:
            clauses.append('i.source_id IN (' + ','.join('?' for _ in sources) + ')')
            args.extend(sources)
        if mode in ('included', 'excluded'):
            condition = '(news_matches(i.title,?)=1 AND news_matches(i.title,?)=0)'
            clauses.append(('NOT ' if mode == 'excluded' else '') + condition)
            args.extend((include, exclude))
        if priority:
            clauses.append('(news_priority(i.title,i.summary)<>? OR p.url IS NOT NULL)')
            args.append('')
        for bound, sign in ((start, '>='), (end, '<')):
            if bound is not None:
                clauses.append(f'COALESCE(i.published_at,i.first_seen) {sign} ?')
                args.append(bound)
        where = ' WHERE ' + ' AND '.join(clauses) if clauses else ''
        direction = 'ASC' if order == 'oldest' else 'DESC'
        with self.database() as db:
            # Deduplicate overlapping feeds after filtering, preserving per-provider browsing.
            candidates = 'WITH candidates AS (SELECT i.*,s.name AS source_name,p.url IS NOT NULL AS pinned,ROW_NUMBER() OVER (PARTITION BY i.url ORDER BY i.first_seen,i.id) AS duplicate FROM items i JOIN sources s ON s.id=i.source_id LEFT JOIN pins p ON p.url=i.url' + where + ') '
            total = db.execute(candidates + 'SELECT count(*) FROM candidates WHERE duplicate=1', args).fetchone()[0]
            rows = db.execute(candidates + 'SELECT *,news_priority(title,summary) AS priority_reason FROM candidates WHERE duplicate=1' +
                              (' ORDER BY pinned DESC,' if priority else ' ORDER BY ') + f'COALESCE(published_at,first_seen) {direction},id {direction} LIMIT ? OFFSET ?', [*args, limit, offset])
            return {'items': [{key: value for key, value in dict(row).items() if key != 'duplicate'} for row in rows], 'total': total}

    def arrivals(self, after=None, include='', exclude='', hidden=(), now=None):
        now = int(time.time() * 1000) if now is None else now
        with self.database() as db:
            cursor = db.execute('SELECT COALESCE(MAX(sequence),0) FROM arrivals').fetchone()[0]
            if after is None or not include.strip():
                return {'cursor': cursor, 'items': []}
            clauses = ['a.sequence>?', 'a.sequence<=?', 'i.published_at>=?', 'i.published_at<=?', 'a.received_at>=?']
            args = [after, cursor, now - 900_000, now + 60_000, now - 900_000]
            clauses.extend(('news_matches(i.title,?)=1', 'news_matches(i.title,?)=0'))
            args.extend((include, exclude))
            if hidden:
                clauses.append('i.source_id NOT IN (' + ','.join('?' for _ in hidden) + ')')
                args.extend(hidden)
            rows = db.execute('SELECT i.*,s.name AS source_name FROM arrivals a JOIN items i ON i.id=a.item_id JOIN sources s ON s.id=i.source_id WHERE ' + ' AND '.join(clauses) + ' ORDER BY a.sequence LIMIT 200', args)
            return {'cursor': cursor, 'items': [dict(row) for row in rows]}


def backup_news(source, destination):
    """Use SQLite backup rather than copying a potentially journalled database."""
    path = Path(source) / 'news-flow' / 'news.sqlite3'
    if not path.exists():
        return
    if path.parent.is_symlink() or any(file.is_symlink() for file in path.parent.iterdir()):
        raise ValueError('News Flow symlinks are not supported in backups')
    target = Path(destination) / 'news-flow' / 'news.sqlite3'
    target.parent.mkdir(parents=True)
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as original:
        with closing(sqlite3.connect(target)) as copied:
            original.backup(copied)
