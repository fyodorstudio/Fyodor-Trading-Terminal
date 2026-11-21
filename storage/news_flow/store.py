"""Separate SQLite history; no calendar or Wildcard tables are touched."""
from contextlib import closing, contextmanager
from pathlib import Path
import sqlite3
import time
import re
from threading import RLock
from uuid import uuid4

from .providers import PROVIDERS, PROVIDER_MIGRATION, RETIRED
from .rules import matches, priority_reason
from .policy import policy_currencies, policy_details
from .diagnostics import SCHEMA, record_check, snapshot as diagnostic_snapshot
from .importance import decision, level
from .relevance import headline_key

# Freeze the fallback against first collection, so a scheduled date never promotes
# an old announcement when wall-clock time catches up with the feed timestamp.
TIMELINE = 'CASE WHEN i.published_at IS NULL OR i.published_at-i.first_seen>=60000 THEN i.first_seen ELSE i.published_at END'
MAX_EXPORT_ITEMS = 10000


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
                db.create_function('news_level', 10, level, deterministic=True)
                db.create_function('news_headline_key', 1, headline_key, deterministic=True)
                db.create_function('news_priority', 2, priority_reason, deterministic=True)
                db.create_function('news_banks', 5, lambda *args: '|'.join(policy_currencies(*args)), deterministic=True)
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
                        CREATE INDEX IF NOT EXISTS news_arrival_time ON arrivals(received_at,sequence);
                        CREATE TABLE IF NOT EXISTS history_searches (
                            source_id TEXT NOT NULL, url TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL,
                            searched_at INTEGER NOT NULL, found INTEGER NOT NULL, error TEXT NOT NULL,
                            retry_at INTEGER NOT NULL, failures INTEGER NOT NULL,
                            PRIMARY KEY(source_id,url,start,end));
                    ''')
                    db.executescript(SCHEMA)
                    item_columns = {row['name'] for row in db.execute('PRAGMA table_info(items)')}
                    if 'previous_check_at' not in item_columns:
                        db.execute('ALTER TABLE items ADD COLUMN previous_check_at INTEGER')
                    columns = {row['name'] for row in db.execute('PRAGMA table_info(sources)')}
                    for column, definition in (('poll_seconds', 'INTEGER NOT NULL DEFAULT 1'), ('next_fetch_at', 'INTEGER NOT NULL DEFAULT 0'),
                                               ('retry_at', 'INTEGER NOT NULL DEFAULT 0'), ('failures', 'INTEGER NOT NULL DEFAULT 0')):
                        if column not in columns:
                            db.execute(f'ALTER TABLE sources ADD COLUMN {column} {definition}')
                    for column in ('fetch_ms', 'queue_ms'):
                        if column not in columns:
                            db.execute(f'ALTER TABLE sources ADD COLUMN {column} INTEGER')
                    if 'collect_enabled' not in columns:
                        db.execute('ALTER TABLE sources ADD COLUMN collect_enabled INTEGER NOT NULL DEFAULT 1')
                    if 'retry_at' not in columns:
                        # Older versions only persisted the retry message. Conservatively
                        # honour its full delay once instead of bypassing it on upgrade.
                        for source in db.execute("SELECT id,error FROM sources WHERE error<>''").fetchall():
                            delay = re.search(r'(?:Retrying in|Retry after) (\d+)s', source['error'])
                            if delay:
                                deadline = int(time.time() * 1000) + min(86400, int(delay[1])) * 1000
                                db.execute('UPDATE sources SET retry_at=?,next_fetch_at=?,failures=1 WHERE id=?', (deadline, deadline, source['id']))
                    if not db.execute('SELECT 1 FROM migrations WHERE name=?', (PROVIDER_MIGRATION,)).fetchone():
                        for identity, name, url, _ in PROVIDERS:
                            db.execute('INSERT OR IGNORE INTO sources(id,name,url) VALUES (?,?,?)', (identity, name, url))
                        for identity, url in RETIRED.items():
                            db.execute('UPDATE sources SET collect_enabled=0 WHERE id=? AND url=?', (identity, url))
                        db.execute('INSERT INTO migrations VALUES (?)', (PROVIDER_MIGRATION,))
                    db.commit()
                    self.initialized = True
                with db:
                    yield db

    def sources(self):
        with self.database() as db:
            return [dict(row) for row in db.execute('SELECT * FROM sources ORDER BY rowid')]

    def save_source(self, name, url, identity=None, poll_seconds=None, collect_enabled=None):
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
            if collect_enabled is not None:
                db.execute('UPDATE sources SET collect_enabled=? WHERE id=?', (int(collect_enabled), identity))
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
                db.execute('''INSERT INTO items(id,source_id,identity,title,summary,publisher,url,published_at,first_seen,previous_check_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,identity) DO UPDATE SET
                    title=excluded.title,summary=excluded.summary,publisher=excluded.publisher,url=excluded.url,
                    published_at=COALESCE(excluded.published_at,items.published_at)''',
                    (source['id'] + ':' + item['identity'], source['id'], item['identity'], item['title'], item['summary'],
                     item['publisher'], item['url'], item['published_at'], now, current['last_success'] if update_status and not known else None))
                # Historical imports and subsequent edits never create live alerts.
                if update_status and not known and current['last_success'] is not None:
                    db.execute('INSERT OR IGNORE INTO arrivals(item_id,received_at) VALUES (?,?)', (identity, now))
            if update_status:
                db.execute('UPDATE sources SET etag=?,modified=?,last_success=?,error=?,next_fetch_at=?,retry_at=0,failures=0 WHERE id=?', (etag, modified, now, '', now + current['poll_seconds'] * 1000, source['id']))
            return True

    def failure(self, source, error, retry_at=0, failures=0):
        with self.database() as db:
            db.execute('UPDATE sources SET error=?,retry_at=?,next_fetch_at=?,failures=? WHERE id=? AND url=?', (error[:300], retry_at, retry_at, failures, source['id'], source['url']))

    def fetch_timing(self, source, elapsed, queued, metadata=None, started=None, completed=None):
        with self.database() as db:
            elapsed, queued = max(0, int(elapsed)), max(0, int(queued))
            updated = db.execute('UPDATE sources SET fetch_ms=?,queue_ms=? WHERE id=? AND url=?',
                                 (elapsed, queued, source['id'], source['url']))
            if metadata is not None and updated.rowcount:
                record_check(db, source, int(started), int(completed), elapsed, queued, metadata)

    def diagnostics(self, source_id, now=None):
        with self.database() as db:
            return diagnostic_snapshot(db, source_id, int(time.time() * 1000) if now is None else now)

    def collection_run(self, identity=None, stopped=False):
        now = int(time.time() * 1000)
        with self.database() as db:
            if identity is None:
                identity = uuid4().hex
                db.execute('INSERT INTO collection_runs VALUES (?,?,?,NULL)', (identity, now, now))
            else:
                db.execute('UPDATE collection_runs SET heartbeat_at=?,stopped_at=? WHERE id=?', (now, now if stopped else None, identity))
        return identity

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

    def query(self, sources=(), include='', exclude='', start=None, end=None, order='newest', offset=0, limit=100, mode='all', priority=False, search='', organizer='all', currency='all', headlines_only=False, market_relevance=False, sort_by='published', filter_policy=''):
        clauses, args = [], []
        if sources:
            clauses.append('i.source_id IN (' + ','.join('?' for _ in sources) + ')')
            args.extend(sources)
        if mode in ('included', 'excluded', 'priority'):
            # Reader tiers are disjoint: Priority 1, Priority 2 and Excluded.
            clauses.append('news_level(i.title,i.source_id,i.url,s.url,?,?,?,p.url IS NOT NULL,?,i.summary)' +
                           {'excluded': '=0', 'included': '=1', 'priority': '=2'}[mode])
            args.extend((include, exclude, market_relevance, filter_policy))
        bank_expression = 'news_banks(i.title,i.summary,i.source_id,i.url,s.url)'
        # Compatibility for old research links. Current reading tabs use
        # mode=priority and news_level above, never these broad organizer scopes.
        if priority:
            clauses.append({'central-banks': bank_expression + "<>''", 'expectations': "news_priority(i.title,i.summary)<>''",
                            'starred': 'p.url IS NOT NULL'}.get(organizer,
                            "(news_priority(i.title,i.summary)<>'' OR " + bank_expression + "<>'' OR p.url IS NOT NULL)"))
            if currency != 'all':
                clauses.append("instr('|'||" + bank_expression + "||'|',?)>0")
                args.append('|' + currency + '|')
        if search.strip():
            clauses.append('instr(casefold(i.title),casefold(?))>0')
            args.append(search.strip())
        for bound, sign in ((start, '>='), (end, '<')):
            if bound is not None:
                clauses.append(f'{TIMELINE} {sign} ?')
                args.append(bound)
        where = ' WHERE ' + ' AND '.join(clauses) if clauses else ''
        direction = 'ASC' if order == 'oldest' else 'DESC'
        sort_column = 'first_seen' if sort_by == 'collected' else 'timeline_at'
        with self.database() as db:
            # Deduplicate overlapping feeds after filtering, preserving per-provider browsing.
            candidates = 'WITH candidates AS (SELECT i.*,' + TIMELINE + ' AS timeline_at,s.name AS source_name,s.url AS source_feed,p.url IS NOT NULL AS pinned,ROW_NUMBER() OVER (PARTITION BY i.url ORDER BY i.first_seen,i.id) AS duplicate FROM items i JOIN sources s ON s.id=i.source_id LEFT JOIN pins p ON p.url=i.url' + where + ') '
            total = db.execute(candidates + 'SELECT count(*) FROM candidates WHERE duplicate=1', args).fetchone()[0]
            if headlines_only:
                if total > MAX_EXPORT_ITEMS:
                    raise OverflowError(f'More than {MAX_EXPORT_ITEMS:,} headlines match. Choose a shorter range or fewer providers.')
                rows = db.execute(candidates + f'SELECT title,url FROM candidates WHERE duplicate=1 ORDER BY {sort_column} {direction},id {direction}', args)
                return {'items': [dict(row) for row in rows], 'total': total}
            rows = db.execute(candidates + 'SELECT *,news_priority(title,summary) AS priority_reason FROM candidates WHERE duplicate=1' +
                              (' ORDER BY pinned DESC,' if priority else ' ORDER BY ') + f'{sort_column} {direction},id {direction} LIMIT ? OFFSET ?', [*args, limit, offset])
            return {'items': [{**{key: value for key, value in dict(row).items() if key not in ('duplicate', 'source_feed')},
                               'relevance': decision(row['title'], row['source_id'], row['url'], row['source_feed'], include, exclude, market_relevance, row['pinned'], filter_policy, row['summary']),
                               **policy_details(row['title'], row['summary'], row['source_id'], row['url'], row['source_feed'])} for row in rows], 'total': total}

    def export_headlines(self, **scope):
        # One locked snapshot, all matching rows, same scopes and URL deduplication
        # as the reader. No page walking while collection changes the list.
        page = self.query(**scope, headlines_only=True)
        text = '\n\n'.join(row['title'] + '\n' + row['url'] for row in page['items'])
        return {'text': text, 'count': page['total']}

    def arrivals(self, after=None, include='', exclude='', hidden=(), now=None, mode='included', market_relevance=False, max_age_seconds=None, filter_policy=''):
        now = int(time.time() * 1000) if now is None else now
        with self.database() as db:
            cursor = db.execute('SELECT COALESCE(MAX(sequence),0) FROM arrivals').fetchone()[0]
            if after is None:
                return {'cursor': cursor, 'items': []}
            # Live discovery, not publication age. A feed may expose an article
            # long after publication. Backfills never enter this table.
            clauses = ['a.sequence>?', 'a.sequence<=?', 'a.received_at>=?']
            args = [after, cursor, now - 900_000]
            if max_age_seconds is not None:
                # Publication age, not discovery age. Unknown/scheduled dates
                # must not turn an old story into a fresh alert via first_seen.
                clauses.extend(('i.published_at IS NOT NULL', 'i.published_at-i.first_seen<60000',
                                'i.published_at>=?', 'i.published_at<=?'))
                args.extend((now - max_age_seconds * 1000, now))
            if mode in ('priority', 'included'):
                # Delivery can select Priority 1 only or Priority 1 + Priority 2.
                clauses.append('news_level(i.title,i.source_id,i.url,s.url,?,?,?,p.url IS NOT NULL,?,i.summary)' + ('=2' if mode == 'priority' else '>0'))
                args.extend((include, exclude, market_relevance, filter_policy))
            if hidden:
                clauses.append('i.source_id NOT IN (' + ','.join('?' for _ in hidden) + ')')
                args.extend(hidden)
            if mode == 'priority':
                # Both delivery channels derive suppression from arrival history,
                # so separate polling batches still suppress title republication.
                previous = ['earlier.sequence<a.sequence', 'earlier.received_at>=a.received_at-7200000',
                            'news_headline_key(e.title)=news_headline_key(i.title)',
                            'news_level(e.title,e.source_id,e.url,es.url,?,?,?,ep.url IS NOT NULL,?,e.summary)=2']
                args.extend((include, exclude, market_relevance, filter_policy))
                if hidden:
                    previous.append('e.source_id NOT IN (' + ','.join('?' for _ in hidden) + ')')
                    args.extend(hidden)
                if max_age_seconds is not None:
                    previous.extend(('e.published_at IS NOT NULL', 'e.published_at-e.first_seen<60000',
                                     'e.published_at>=earlier.received_at-?', 'e.published_at<=earlier.received_at'))
                    args.append(max_age_seconds * 1000)
                clauses.append('NOT EXISTS (SELECT 1 FROM arrivals earlier JOIN items e ON e.id=earlier.item_id '
                               'JOIN sources es ON es.id=e.source_id LEFT JOIN pins ep ON ep.url=e.url WHERE ' +
                               ' AND '.join(previous) + ')')
            rows = db.execute('SELECT i.*,' + TIMELINE + ' AS timeline_at,s.name AS source_name,s.url AS source_feed,p.url IS NOT NULL AS pinned,a.sequence,a.received_at FROM arrivals a JOIN items i ON i.id=a.item_id JOIN sources s ON s.id=i.source_id LEFT JOIN pins p ON p.url=i.url WHERE ' + ' AND '.join(clauses) + ' ORDER BY a.sequence LIMIT 200', args)
            items = [{**{key: value for key, value in dict(row).items() if key != 'source_feed'},
                      'relevance': decision(row['title'], row['source_id'], row['url'], row['source_feed'], include, exclude, market_relevance, row['pinned'], filter_policy, row['summary'])} for row in rows]
            # A large batch must not skip eligible arrivals beyond this page.
            return {'cursor': items[-1]['sequence'] if len(items) == 200 else cursor, 'items': items}


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
