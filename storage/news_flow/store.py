"""Separate SQLite history; no calendar or Wildcard tables are touched."""
from contextlib import closing, contextmanager
from pathlib import Path
import sqlite3
import time
from threading import RLock
from uuid import uuid4

from .providers import PROVIDERS


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
                        CREATE TABLE IF NOT EXISTS arrivals (
                            sequence INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT NOT NULL UNIQUE,
                            received_at INTEGER NOT NULL);
                        CREATE TABLE IF NOT EXISTS history_searches (
                            source_id TEXT NOT NULL, url TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL,
                            searched_at INTEGER NOT NULL, found INTEGER NOT NULL, error TEXT NOT NULL,
                            retry_at INTEGER NOT NULL, failures INTEGER NOT NULL,
                            PRIMARY KEY(source_id,url,start,end));
                    ''')
                    if not db.execute('SELECT 1 FROM migrations WHERE name=?', ('starter-providers-v1',)).fetchone():
                        for identity, name, url, _ in PROVIDERS:
                            db.execute('INSERT OR IGNORE INTO sources(id,name,url) VALUES (?,?,?)', (identity, name, url))
                        db.execute('INSERT INTO migrations VALUES (?)', ('starter-providers-v1',))
                    db.commit()
                    self.initialized = True
                with db:
                    yield db

    def sources(self):
        with self.database() as db:
            return [dict(row) for row in db.execute('SELECT * FROM sources ORDER BY rowid')]

    def save_source(self, name, url, identity=None):
        with self.database() as db:
            if identity is None:
                identity = uuid4().hex
                db.execute('INSERT INTO sources(id,name,url) VALUES (?,?,?)', (identity, name, url))
            else:
                current = db.execute('SELECT url FROM sources WHERE id=?', (identity,)).fetchone()
                if current is None:
                    raise KeyError('Provider not found')
                db.execute('UPDATE sources SET name=?,url=?,etag=CASE WHEN url=? THEN etag ELSE ? END, modified=CASE WHEN url=? THEN modified ELSE ? END, last_success=CASE WHEN url=? THEN last_success ELSE NULL END, error=? WHERE id=?',
                           (name, url, url, '', url, '', url, '', identity))
            return identity

    def success(self, source, items, etag, modified, now, update_status=True):
        with self.database() as db:
            # Ignore an in-flight response if the user changed this feed's URL.
            current = db.execute('SELECT url,last_success FROM sources WHERE id=?', (source['id'],)).fetchone()
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
                db.execute('UPDATE sources SET etag=?,modified=?,last_success=?,error=? WHERE id=?', (etag, modified, now, '', source['id']))
            return True

    def failure(self, source, error):
        with self.database() as db:
            db.execute('UPDATE sources SET error=? WHERE id=? AND url=?', (error[:300], source['id'], source['url']))

    def history_search(self, source, start, end):
        with self.database() as db:
            row = db.execute('SELECT * FROM history_searches WHERE source_id=? AND url=? AND start=? AND end=?', (source['id'], source['url'], start, end)).fetchone()
            return dict(row) if row else None

    def save_history_search(self, source, start, end, now, found, error='', retry_at=0, failures=0):
        with self.database() as db:
            db.execute('INSERT OR REPLACE INTO history_searches VALUES (?,?,?,?,?,?,?,?,?)',
                       (source['id'], source['url'], start, end, now, found, error, retry_at, failures))

    def query(self, sources=(), include='', exclude='', start=None, end=None, order='newest', offset=0, limit=100):
        clauses, args = [], []
        if sources:
            clauses.append('i.source_id IN (' + ','.join('?' for _ in sources) + ')')
            args.extend(sources)
        for value, negate in ((include, False), (exclude, True)):
            terms = [part.strip().casefold() for part in value.replace('\n', ',').split(',') if part.strip()][:50]
            if terms:
                condition = ' OR '.join('instr(casefold(i.title), ?) > 0' for _ in terms)
                clauses.append(('NOT ' if negate else '') + '(' + condition + ')')
                args.extend(terms)
        for bound, sign in ((start, '>='), (end, '<')):
            if bound is not None:
                clauses.append(f'COALESCE(i.published_at,i.first_seen) {sign} ?')
                args.append(bound)
        where = ' WHERE ' + ' AND '.join(clauses) if clauses else ''
        direction = 'ASC' if order == 'oldest' else 'DESC'
        with self.database() as db:
            # Deduplicate overlapping feeds after filtering, preserving per-provider browsing.
            candidates = 'WITH candidates AS (SELECT i.*,s.name AS source_name,ROW_NUMBER() OVER (PARTITION BY i.url ORDER BY i.first_seen,i.id) AS duplicate FROM items i JOIN sources s ON s.id=i.source_id' + where + ') '
            total = db.execute(candidates + 'SELECT count(*) FROM candidates WHERE duplicate=1', args).fetchone()[0]
            rows = db.execute(candidates + 'SELECT * FROM candidates WHERE duplicate=1' +
                              f' ORDER BY COALESCE(published_at,first_seen) {direction},id {direction} LIMIT ? OFFSET ?', [*args, limit, offset])
            return {'items': [{key: value for key, value in dict(row).items() if key != 'duplicate'} for row in rows], 'total': total}

    def arrivals(self, after=None, include='', exclude='', hidden=(), now=None):
        now = int(time.time() * 1000) if now is None else now
        with self.database() as db:
            cursor = db.execute('SELECT COALESCE(MAX(sequence),0) FROM arrivals').fetchone()[0]
            if after is None or not include.strip():
                return {'cursor': cursor, 'items': []}
            clauses = ['a.sequence>?', 'a.sequence<=?', 'i.published_at>=?', 'i.published_at<=?', 'a.received_at>=?']
            args = [after, cursor, now - 900_000, now + 60_000, now - 900_000]
            for value, negate in ((include, False), (exclude, True)):
                terms = [term.strip().casefold() for term in value.replace('\n', ',').split(',') if term.strip()][:50]
                if terms:
                    clauses.append(('NOT ' if negate else '') + '(' + ' OR '.join('instr(casefold(i.title),?)>0' for _ in terms) + ')')
                    args.extend(terms)
                elif not negate:
                    return {'cursor': cursor, 'items': []}
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
