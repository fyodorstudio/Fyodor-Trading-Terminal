import asyncio
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlencode

from fastapi import HTTPException
from pydantic import ValidationError

from storage.app import create_app
from storage.calendar_store import CalendarStore
from storage.legacy_wildcards import WildcardSave, wildcard_snapshot, save_wildcards
from storage.recovery import backup_directory, restore_directory


class WildcardTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.directory = self.root / 'data' / 'heatmap-wildcards'
        self.row = dict(id='a' * 32, title='Iran developments', archived=False,
                        notes={'2026-11-12': 'First paragraph.\n\nSecond paragraph.\nhttps://example.com/source'})

    def tearDown(self):
        self.temporary.cleanup()

    def save(self, rows=None, revision=0, source='Pepperstone-Demo'):
        return save_wildcards(self.directory, WildcardSave(source_id=source, expected_revision=revision, rows=rows if rows is not None else [self.row]))

    def test_dates_paragraphs_order_archive_and_broker_isolation(self):
        self.assertEqual(wildcard_snapshot(self.directory, 'Pepperstone-Demo')['rows'], [])
        first = self.save()
        self.assertEqual(wildcard_snapshot(self.directory, 'Pepperstone-Demo'), first)
        self.assertEqual(first['rows'][0]['notes'], self.row['notes'])
        second = dict(id='b' * 32, title='Tariff negotiations', archived=False, notes={'2027-01-01': 'Future or historical date-only note'})
        next_row = {**self.row, 'title': '  Iran\n developments  ', 'archived': True, 'notes': {**self.row['notes'], '2026-11-13': 'Follow-up'}}
        changed = self.save([second, next_row], 1)
        self.assertEqual([row['id'] for row in changed['rows']], ['b' * 32, 'a' * 32])
        self.assertTrue(changed['rows'][1]['archived'])
        self.assertEqual(changed['rows'][1]['title'], 'Iran developments')
        self.assertEqual(changed['rows'][1]['notes']['2026-11-12'], self.row['notes']['2026-11-12'])
        self.assertEqual(wildcard_snapshot(self.directory, 'Other')['rows'], [])
        self.save(source='../escape')
        self.assertEqual(len(list(self.directory.glob('*.json'))), 2)
        self.assertFalse((self.root / 'escape').exists())
        restored = self.save([{**next_row, 'archived': False}], 2)
        self.assertFalse(restored['rows'][0]['archived'])
        self.assertEqual(self.save([], 3)['rows'], [])

    def test_stale_writer_cannot_overwrite_notes(self):
        before = self.save()
        with self.assertRaises(HTTPException) as raised:
            self.save([], 0)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(wildcard_snapshot(self.directory, 'Pepperstone-Demo'), before)

    def test_atomic_write_failure_preserves_snapshot_and_removes_temporary(self):
        before = self.save()
        with patch('storage.legacy_wildcards.os.replace', side_effect=OSError('Disk failure')):
            with self.assertRaises(OSError):
                self.save([], 1)
        self.assertEqual(wildcard_snapshot(self.directory, 'Pepperstone-Demo'), before)
        self.assertEqual(list(self.directory.glob('.wildcards-*')), [])

    def test_invalid_content_and_limits(self):
        invalid = [dict(title=' '), dict(title='x' * 121), dict(notes={'2026-02-30': 'bad date'}),
                   dict(notes={'20261112': 'bad format'}), dict(notes={'2014-01-01': 'too early'}),
                   dict(notes={'2101-01-01': 'too late'}), dict(notes={'2026-11-12': ' '}),
                   dict(notes={'2026-11-12': 'x' * 20001}), dict(id='../escape'), dict(unexpected=True)]
        for changes in invalid:
            with self.subTest(changes=list(changes)), self.assertRaises(ValidationError):
                self.save([{**self.row, **changes}])
        for rows in [[self.row, self.row], [dict(self.row, id=f'{index:032x}') for index in range(129)]]:
            with self.assertRaises(ValidationError):
                self.save(rows)
        with self.assertRaises(ValidationError):
            self.save(revision=True)
        self.assertFalse(list(self.directory.glob('*.json')))

    def test_corrupt_saved_notes_are_never_replaced(self):
        self.save()
        path = next(self.directory.glob('*.json'))
        path.write_text('{corrupt', encoding='utf-8')
        with self.assertRaises(ValueError):
            self.save([], 1)
        self.assertEqual(path.read_text(encoding='utf-8'), '{corrupt')

    def test_backup_restore_includes_notes_and_excludes_writer_files(self):
        data = self.directory.parent
        store = CalendarStore(data / 'calendar.sqlite3')
        store.close()
        expected = self.save()
        (self.directory / '.wildcards-incomplete').write_text('partial', encoding='utf-8')
        backup = self.root / 'backup'
        backup_directory(data, backup)
        self.assertFalse((backup / 'heatmap-wildcards/.fyodor-storage.lock').exists())
        self.assertFalse((backup / 'heatmap-wildcards/.wildcards-incomplete').exists())
        restored = self.root / 'restored'
        restore_directory(backup, restored)
        self.assertEqual(wildcard_snapshot(restored / 'heatmap-wildcards', 'Pepperstone-Demo'), expected)
