"""Bounded minute summaries, never response bodies or an article archive."""
from hashlib import sha256

SCHEMA = '''
CREATE TABLE IF NOT EXISTS feed_checks (
    source_id TEXT NOT NULL,feed_key TEXT NOT NULL,minute INTEGER NOT NULL,
    first_at INTEGER NOT NULL,last_at INTEGER NOT NULL,
    ok INTEGER NOT NULL,unchanged INTEGER NOT NULL,limited INTEGER NOT NULL,errors INTEGER NOT NULL,
    http_status INTEGER,cache_age INTEGER,response_at INTEGER,item_count INTEGER,
    max_fetch_ms INTEGER NOT NULL,max_queue_ms INTEGER NOT NULL,
    PRIMARY KEY(source_id,feed_key,minute));
CREATE INDEX IF NOT EXISTS feed_checks_expiry ON feed_checks(minute);
CREATE TABLE IF NOT EXISTS collection_runs (
    id TEXT PRIMARY KEY,started_at INTEGER NOT NULL,heartbeat_at INTEGER NOT NULL,stopped_at INTEGER);
'''


def feed_key(url):
    return sha256(url.encode()).hexdigest()


def record_check(db, source, started, completed, elapsed, queued, metadata):
    status = metadata.get('http_status')
    failed = metadata.get('failed', False)
    values = (source['id'], feed_key(source['url']), completed // 60000 * 60000, started, completed,
              int(not failed and status != 304), int(not failed and status == 304),
              int(failed and status == 429), int(failed and status != 429), status,
              metadata.get('cache_age'), metadata.get('response_at'), metadata.get('item_count'), elapsed, queued)
    db.execute('''INSERT INTO feed_checks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(source_id,feed_key,minute) DO UPDATE SET
        last_at=excluded.last_at,ok=ok+excluded.ok,unchanged=unchanged+excluded.unchanged,
        limited=limited+excluded.limited,errors=errors+excluded.errors,
        http_status=excluded.http_status,cache_age=excluded.cache_age,response_at=excluded.response_at,
        item_count=COALESCE(excluded.item_count,item_count),
        max_fetch_ms=MAX(max_fetch_ms,excluded.max_fetch_ms),max_queue_ms=MAX(max_queue_ms,excluded.max_queue_ms)''', values)
    db.execute('DELETE FROM feed_checks WHERE minute<?', (completed - 86400000,))
    db.execute('DELETE FROM collection_runs WHERE heartbeat_at<?', (completed - 86400000,))


def snapshot(db, source_id, now):
    source = db.execute('SELECT * FROM sources WHERE id=?', (source_id,)).fetchone()
    if source is None:
        raise KeyError('Provider not found')
    rows = db.execute('SELECT * FROM feed_checks WHERE source_id=? AND feed_key=? AND minute>=? ORDER BY minute DESC LIMIT 60',
                      (source_id, feed_key(source['url']), now - 3600000)).fetchall()
    runs = db.execute('SELECT started_at,heartbeat_at,stopped_at FROM collection_runs ORDER BY started_at DESC LIMIT 5').fetchall()
    return {'checks': [{key: value for key, value in dict(row).items() if key not in ('source_id', 'feed_key')} for row in rows],
            'runs': [dict(row) for row in runs], 'retention_hours': 24}
