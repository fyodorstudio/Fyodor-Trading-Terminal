"""Separate SQLite history; no calendar or Wildcard tables are touched."""
from collections import OrderedDict
from concurrent.futures import Future
from contextlib import closing, contextmanager, nullcontext
from pathlib import Path
import sqlite3
import time
import re
from threading import Lock, RLock
from uuid import uuid4

from .providers import FXSTREET_FEED, FXSTREET_FEED_MIGRATION, FXSTREET_LEGACY_URL, PROVIDERS, PROVIDER_MIGRATION, RETIRED
from .rules import matches, priority_reason
from .policy import policy_currencies, policy_details
from .diagnostics import SCHEMA, record_check, snapshot as diagnostic_snapshot
from .importance import decision, level
from .priority import attention_reason
from .relevance import headline_key

# Freeze the fallback against first collection, so a scheduled date never promotes
# an old announcement when wall-clock time catches up with the feed timestamp.
TIMELINE = 'CASE WHEN i.published_at IS NULL OR i.published_at-i.first_seen>=60000 THEN i.first_seen ELSE i.published_at END'
MAX_EXPORT_ITEMS = 10000
PAGE_CACHE_SIZE = 24


class NewsStore:
    def __init__(self, root):
        self.path = Path(root) / 'news-flow' / 'news.sqlite3'
        self.lock = RLock()
        self.initialized = False
        self.page_lock = Lock()
        self.pages = OrderedDict()

    @contextmanager
    def database(self, *, reader=False):
        with nullcontext() if reader and self.initialized else self.lock:
            if not self.initialized:
                self.path.parent.mkdir(parents=True, exist_ok=True)
            with closing(sqlite3.connect(self.path, timeout=10)) as db:
                db.row_factory = sqlite3.Row
                db.create_function('casefold', 1, lambda value: value.casefold())
                db.create_function('news_matches', 2, matches, deterministic=True)
                db.create_function('news_level', 11, level, deterministic=True)
                db.create_function('news_headline_key', 1, headline_key, deterministic=True)
                db.create_function('news_clear_title', 1, lambda title: bool(attention_reason(title)), deterministic=True)
                db.create_function('news_priority', 2, priority_reason, deterministic=True)
                db.create_function('news_banks', 5, lambda *args: '|'.join(policy_currencies(*args)), deterministic=True)
                if not self.initialized:
                    db.execute('PRAGMA journal_mode=WAL')
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
                    db.execute(f'CREATE INDEX IF NOT EXISTS news_timeline ON items({TIMELINE.replace("i.", "")},id)')
                    db.execute('DROP INDEX IF EXISTS news_time')
                    db.execute('CREATE TABLE IF NOT EXISTS reader_revision (value INTEGER NOT NULL)')
                    db.execute('INSERT INTO reader_revision SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM reader_revision)')
                    for table, operations in (
                        ('items', ('INSERT', 'UPDATE', 'DELETE')),
                        ('pins', ('INSERT', 'UPDATE', 'DELETE')),
                        ('sources', ('INSERT', 'DELETE', 'UPDATE OF name,url')),
                    ):
                        for operation in operations:
                            trigger = f'reader_{table}_{operation.split()[0].lower()}'
                            when = ' WHEN OLD.name IS NOT NEW.name OR OLD.url IS NOT NEW.url' if operation == 'UPDATE OF name,url' else ''
                            db.execute(f'CREATE TRIGGER IF NOT EXISTS {trigger} AFTER {operation} ON {table}{when}'
                                       ' BEGIN UPDATE reader_revision SET value=value+1; END')
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
                    if not db.execute('SELECT 1 FROM migrations WHERE name=?', (FXSTREET_FEED_MIGRATION,)).fetchone():
                        db.execute("""UPDATE OR IGNORE sources
                            SET name=CASE WHEN name='FXStreet' THEN 'FXStreet (Google News)' ELSE name END,
                                url=?,etag='',modified='',last_success=NULL,error='',next_fetch_at=0,retry_at=0,failures=0
                            WHERE id='fxstreet' AND url=?""", (FXSTREET_FEED, FXSTREET_LEGACY_URL))
                        db.execute('INSERT INTO migrations VALUES (?)', (FXSTREET_FEED_MIGRATION,))
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
                    published_at=COALESCE(excluded.published_at,items.published_at)
                    WHERE excluded.title IS NOT items.title OR excluded.summary IS NOT items.summary
                       OR excluded.publisher IS NOT items.publisher OR excluded.url IS NOT items.url
                       OR COALESCE(excluded.published_at,items.published_at) IS NOT items.published_at''',
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
        # Reject out-of-range rows before running the text classifiers.
        for bound, sign in ((start, '>='), (end, '<')):
            if bound is not None:
                clauses.append(f'{TIMELINE} {sign} ?')
                args.append(bound)
        levels = {'excluded': (0,), 'included': (1,), 'priority': (2,), 'relevant': (1, 2),
                  'priority-excluded': (0, 2), 'included-excluded': (0, 1), 'none': ()}.get(mode)
        if levels:
            # Checkbox combinations are filtered before counts, pagination and
            # exports. Alert delivery keeps its separate shared trigger.
            clauses.append('news_level(i.title,i.source_id,i.url,s.url,?,?,?,p.url IS NOT NULL,?,i.summary,i.published_at) IN (' + ','.join('?' for _ in levels) + ')')
            args.extend((include, exclude, market_relevance, filter_policy))
            args.extend(levels)
        elif levels is not None:
            clauses.append('0')
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
        where = ' WHERE ' + ' AND '.join(clauses) if clauses else ''
        direction = 'ASC' if order == 'oldest' else 'DESC'
        sort_column = 'first_seen' if sort_by == 'collected' else 'timeline_at'
        # Sort and deduplicate narrow rows before loading the selected headlines and summaries.
        candidates = (
            f'WITH candidates AS (SELECT i.id,i.url,i.first_seen,{TIMELINE} AS timeline_at,'
            'p.url IS NOT NULL AS pinned,ROW_NUMBER() OVER (PARTITION BY i.url ORDER BY i.first_seen,i.id) AS duplicate '
            'FROM items i JOIN sources s ON s.id=i.source_id LEFT JOIN pins p ON p.url=i.url' + where + ')'
        )
        relation, selected = 'candidates', 'duplicate=1'
        if mode == 'priority':
            candidates += (
                ', grouped AS (SELECT c.*,ROW_NUMBER() OVER (PARTITION BY '
                'CASE WHEN c.pinned OR NOT news_clear_title(i.title) THEN c.url ELSE news_headline_key(i.title) END,'
                'CAST(c.timeline_at/86400000 AS INTEGER) ORDER BY c.first_seen,c.id) AS repeat '
                'FROM candidates c JOIN items i ON i.id=c.id WHERE c.duplicate=1)'
            )
            relation, selected = 'grouped', 'repeat=1'
        candidates += f', matched AS MATERIALIZED (SELECT id,url,first_seen,timeline_at,pinned FROM {relation} WHERE {selected})'
        order_by = f'p.{sort_column} {direction},p.id {direction}'
        if headlines_only:
            with self.database(reader=True) as db:
                rows = db.execute(candidates + ' SELECT i.title,p.url FROM matched p JOIN items i ON i.id=p.id'
                                  + f' ORDER BY {order_by} LIMIT ?', [*args, MAX_EXPORT_ITEMS + 1]).fetchall()
            if len(rows) > MAX_EXPORT_ITEMS:
                raise OverflowError(f'More than {MAX_EXPORT_ITEMS:,} headlines match. Choose a shorter range or fewer providers.')
            return {'items': [dict(row) for row in rows], 'total': len(rows)}
        if priority:
            order_by = 'p.pinned DESC,' + order_by
        sql = (candidates + f', page AS (SELECT p.* FROM matched p ORDER BY {order_by} LIMIT ? OFFSET ?)'
               ' SELECT i.*,p.timeline_at,s.name AS source_name,s.url AS source_feed,p.pinned,totals.reader_total'
               ' FROM (SELECT count(*) AS reader_total FROM matched) totals LEFT JOIN page p ON 1'
               ' LEFT JOIN items i ON i.id=p.id LEFT JOIN sources s ON s.id=i.source_id'
               f' ORDER BY {order_by}')
        profile = (include, exclude, market_relevance, filter_policy)
        return self._page(sql, (*args, limit, offset), profile)

    def _page(self, sql, args, profile):
        owner = False
        try:
            with self.database(reader=True) as db:
                # Use the same SQLite snapshot for the revision and its rows.
                db.execute('BEGIN')
                revision = db.execute('SELECT value FROM reader_revision').fetchone()[0]
                key = (revision, sql, args, profile)
                with self.page_lock:
                    pending = self.pages.get(key)
                    if pending is None:
                        owner = True
                        pending = self.pages[key] = Future()
                        if len(self.pages) > PAGE_CACHE_SIZE:
                            self.pages.popitem(last=False)
                    self.pages.move_to_end(key)
                if owner:
                    rows = db.execute(sql, args).fetchall()
            if not owner:
                return pending.result()
            include, exclude, market_relevance, filter_policy = profile
            items = []
            for row in rows:
                if row['id'] is None:
                    break  # An empty page still carries the total for this scope.
                title, summary, source, url, feed = (row[k] for k in ('title', 'summary', 'source_id', 'url', 'source_feed'))
                item = {key: value for key, value in dict(row).items() if key not in ('source_feed', 'reader_total')}
                item.update(priority_reason=priority_reason(title, summary),
                            relevance=decision(title, source, url, feed, include, exclude, market_relevance,
                                               row['pinned'], filter_policy, summary, row['published_at']),
                            **policy_details(title, summary, source, url, feed))
                items.append(item)
            page = {'items': items, 'total': rows[0]['reader_total']}
            pending.set_result(page)
            return page
        except BaseException as error:
            if owner:
                with self.page_lock:
                    if self.pages.get(key) is pending:
                        del self.pages[key]
                pending.set_exception(error)
            raise

    def export_headlines(self, **scope):
        # One SQLite snapshot, all matching rows, same scopes and URL deduplication
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
                clauses.append('news_level(i.title,i.source_id,i.url,s.url,?,?,?,p.url IS NOT NULL,?,i.summary,i.published_at)' + ('=2' if mode == 'priority' else '>0'))
                args.extend((include, exclude, market_relevance, filter_policy))
            if hidden:
                clauses.append('i.source_id NOT IN (' + ','.join('?' for _ in hidden) + ')')
                args.extend(hidden)
            if mode == 'priority':
                # Both delivery channels derive suppression from arrival history,
                # so separate polling batches still suppress title republication.
                previous = ['earlier.sequence<a.sequence', 'earlier.received_at>=a.received_at-7200000',
                            'news_headline_key(e.title)=news_headline_key(i.title)',
                            'news_level(e.title,e.source_id,e.url,es.url,?,?,?,ep.url IS NOT NULL,?,e.summary,e.published_at)=2']
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
                      'relevance': decision(row['title'], row['source_id'], row['url'], row['source_feed'], include, exclude, market_relevance, row['pinned'], filter_policy, row['summary'], row['published_at'])} for row in rows]
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
            copied.execute('PRAGMA journal_mode=DELETE')
