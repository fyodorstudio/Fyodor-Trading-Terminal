import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit

from fastapi import HTTPException
from pydantic import ValidationError
from storage.app import create_app
from storage.wildcards import WildcardEntry, change_wildcard, wildcard_snapshot
from storage.legacy_news import NewsEntry, write_news
from storage.legacy_wildcards import WildcardSave, save_wildcards


class WildcardsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'data'
        self.entry = WildcardEntry(date='2026-11-14', at='2026-11-14T10:15:00+07:00', title='Manual development', details='Details')

    def test_global_crud_multiple_same_time_and_revision_conflict(self):
        self.assertEqual(wildcard_snapshot(self.root), {'schema': 1, 'revision': 0, 'items': []})
        first = change_wildcard(self.root, 0, self.entry)
        second = change_wildcard(self.root, 1, self.entry)
        self.assertEqual(len(second['items']), 2)
        self.assertNotEqual(second['items'][0]['id'], second['items'][1]['id'])
        self.assertEqual(first['items'][0]['at'], '2026-11-14T03:15:00Z')
        self.assertNotIn('source_id', first)
        self.assertNotIn('currencies', first['items'][0])
        with self.assertRaises(HTTPException) as error:
            change_wildcard(self.root, 0, self.entry)
        self.assertEqual(error.exception.status_code, 409)
        identity = first['items'][0]['id']
        updated = change_wildcard(self.root, 2, self.entry.model_copy(update={'title': 'Edited'}), identity)
        self.assertEqual(next(item for item in updated['items'] if item['id'] == identity)['title'], 'Edited')
        change_wildcard(self.root, 3, identity=identity, delete=True)
        with self.assertRaises(HTTPException) as error:
            change_wildcard(self.root, 4, identity=identity, delete=True)
        self.assertEqual(error.exception.status_code, 404)

    def test_dates_times_urls_and_empty_titles(self):
        for fields in ({'at': '2026-11-14T10:15:00'}, {'at': '2026-11-13T03:00:00Z'}, {'title': ' '}, {'date': '2026-02-30'}, {'url': 'javascript:alert(1)'}):
            with self.subTest(fields=fields), self.assertRaises(ValidationError):
                WildcardEntry.model_validate({**self.entry.model_dump(), **fields})
        self.assertIsNone(WildcardEntry(date='2026-11-14', title='Date only').at)

    def test_migration_preserves_originals_deduplicates_brokers_and_runs_once(self):
        write_news(self.root / 'manual-news', NewsEntry(date='2026-11-14', currencies=['AUD'], title='News', details='Old news'))
        row = {'id': 'a' * 32, 'title': 'An ongoing story', 'archived': False, 'notes': {'2026-11-12': 'First update', '2026-11-13': 'Second update'}}
        for broker in ('Pepperstone-Demo', 'Elev8-Demo2'):
            save_wildcards(self.root / 'cross-asset-wildcards', WildcardSave(source_id=broker, expected_revision=0, rows=[row]))
        originals = {path: path.read_bytes() for path in self.root.rglob('*.json')}
        migrated = wildcard_snapshot(self.root)
        self.assertEqual(len(migrated['items']), 3)
        self.assertEqual({item['details'] for item in migrated['items']}, {'Old news', 'First update', 'Second update'})
        self.assertTrue(all(item['at'] is None for item in migrated['items']))
        self.assertEqual({path: path.read_bytes() for path in originals}, originals)
        for item in migrated['items']:
            current = wildcard_snapshot(self.root)
            change_wildcard(self.root, current['revision'], identity=item['id'], delete=True)
        self.assertEqual(wildcard_snapshot(self.root)['items'], [], 'Deleted migrated notes never reappear')

    def test_failed_atomic_save_keeps_previous_snapshot(self):
        saved = change_wildcard(self.root, 0, self.entry)
        with patch('storage.wildcards.os.replace', side_effect=OSError('Disk full')), self.assertRaises(OSError):
            change_wildcard(self.root, 1, self.entry)
        self.assertEqual(wildcard_snapshot(self.root), saved)
        self.assertEqual(list((self.root / 'wildcards').glob('.wildcards-*')), [])

    def test_corrupt_legacy_data_is_not_silently_discarded(self):
        directory = self.root / 'manual-news'
        directory.mkdir(parents=True)
        (directory / 'news.json').write_text('broken')
        with self.assertRaises(ValueError): wildcard_snapshot(self.root)
        self.assertFalse((self.root / 'wildcards' / 'wildcards.json').exists())

    def test_backup_restore_contains_shared_wildcards(self):
        from storage.calendar_store import CalendarStore
        from storage.recovery import backup_directory, restore_directory
        store = CalendarStore(self.root / 'calendar.sqlite3'); store.close()
        saved = change_wildcard(self.root, 0, self.entry)
        backup = self.root.parent / 'backup'; restored = self.root.parent / 'restored'
        backup_directory(self.root, backup); restore_directory(backup, restored)
        self.assertEqual(wildcard_snapshot(restored), saved)

    def test_http_shared_routes_and_old_routes_retired(self):
        app = create_app(self.root, run_collector=False)
        async def request(method, path, body=None):
            route = urlsplit(path); sent = []
            async def receive(): return {'type': 'http.request', 'body': json.dumps(body).encode(), 'more_body': False}
            async def send(message): sent.append(message)
            await app({'type': 'http', 'http_version': '1.1', 'scheme': 'http', 'method': method, 'path': route.path, 'query_string': route.query.encode(), 'headers': [(b'content-type', b'application/json')], 'client': ('test', 1), 'server': ('test', 80)}, receive, send)
            return sent[0]['status'], json.loads(b''.join(message.get('body', b'') for message in sent if message['type'] == 'http.response.body'))
        async def run():
            self.assertEqual((await request('GET', '/api/v1/wildcards'))[1]['revision'], 0)
            body = {**self.entry.model_dump(mode='json'), 'expected_revision': 0}
            status, saved = await request('POST', '/api/v1/wildcards', body)
            self.assertEqual(status, 200); identity = saved['items'][0]['id']
            self.assertEqual((await request('POST', '/api/v1/wildcards', body))[0], 409)
            status, saved = await request('PUT', '/api/v1/wildcards/' + identity, {**body, 'expected_revision': 1, 'title': 'Edited'})
            self.assertEqual(status, 200); self.assertEqual(saved['items'][0]['title'], 'Edited')
            self.assertEqual((await request('DELETE', f'/api/v1/wildcards/{identity}?expected_revision=2'))[1]['items'], [])
            for route in ('currency-news', 'cross-asset/wildcards', 'heatmap/wildcards', 'external-sources'):
                self.assertEqual((await request('GET', '/api/v1/' + route))[0], 404)
            self.assertEqual((await request('POST', '/api/v1/wildcards', {**body, 'title': ' '}))[0], 422)
        asyncio.run(run())
