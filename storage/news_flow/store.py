"""Separate SQLite history; no calendar or Wildcard tables are touched."""
from contextlib import closing, contextmanager
from pathlib import Path
import sqlite3
from threading import RLock
from uuid import uuid4

DEFAULT_URL = 'https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US'


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
                    ''')
                    if not db.execute('SELECT 1 FROM sources LIMIT 1').fetchone():
                        db.execute('INSERT INTO sources(id,name,url) VALUES (?,?,?)', ('reuters', 'Reuters', DEFAULT_URL))
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
                db.execute('UPDATE sources SET name=?,url=?,etag=CASE WHEN url=? THEN etag ELSE ? END, modified=CASE WHEN url=? THEN modified ELSE ? END, error=? WHERE id=?',
                           (name, url, url, '', url, '', '', identity))
            return identity

    def success(self, source, items, etag, modified, now):
        with self.database() as db:
            # Ignore an in-flight response if the user changed this feed's URL.
            current = db.execute('SELECT url FROM sources WHERE id=?', (source['id'],)).fetchone()
            if current is None or current['url'] != source['url']:
                return
            for item in items or []:
                db.execute('''INSERT INTO items(id,source_id,identity,title,summary,publisher,url,published_at,first_seen)
                    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,identity) DO UPDATE SET
                    title=excluded.title,summary=excluded.summary,publisher=excluded.publisher,url=excluded.url,
                    published_at=COALESCE(excluded.published_at,items.published_at)''',
                    (source['id'] + ':' + item['identity'], source['id'], item['identity'], item['title'], item['summary'],
                     item['publisher'], item['url'], item['published_at'], now))
            db.execute('UPDATE sources SET etag=?,modified=?,last_success=?,error=? WHERE id=?', (etag, modified, now, '', source['id']))

    def failure(self, source, error):
        with self.database() as db:
            db.execute('UPDATE sources SET error=? WHERE id=? AND url=?', (error[:300], source['id'], source['url']))

    def query(self, sources=(), include='', exclude='', match='any', start=None, end=None, order='newest', offset=0, limit=100):
        clauses, args = [], []
        if sources:
            clauses.append('i.source_id IN (' + ','.join('?' for _ in sources) + ')')
            args.extend(sources)
        for value, negate in ((include, False), (exclude, True)):
            terms = [part.strip().casefold() for part in value.replace('\n', ',').split(',') if part.strip()][:50]
            if terms:
                joiner = ' OR ' if negate or match == 'any' else ' AND '
                condition = joiner.join('instr(casefold(i.title || char(10) || i.summary), ?) > 0' for _ in terms)
                clauses.append(('NOT ' if negate else '') + '(' + condition + ')')
                args.extend(terms)
        for bound, sign in ((start, '>='), (end, '<')):
            if bound is not None:
                clauses.append(f'COALESCE(i.published_at,i.first_seen) {sign} ?')
                args.append(bound)
        where = ' WHERE ' + ' AND '.join(clauses) if clauses else ''
        direction = 'ASC' if order == 'oldest' else 'DESC'
        with self.database() as db:
            total = db.execute('SELECT count(*) FROM items i' + where, args).fetchone()[0]
            rows = db.execute('SELECT i.*,s.name AS source_name FROM items i JOIN sources s ON s.id=i.source_id' + where +
                              f' ORDER BY COALESCE(i.published_at,i.first_seen) {direction},i.id {direction} LIMIT ? OFFSET ?', [*args, limit, offset])
            return {'items': [dict(row) for row in rows], 'total': total}


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
