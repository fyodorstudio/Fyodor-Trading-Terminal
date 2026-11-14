import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
from pydantic import ValidationError
from storage.app import create_app
from storage.legacy_news import NewsEntry, read_news, write_news

class ManualNewsTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.directory = self.root / 'manual-news'
        self.entry = dict(date='2026-11-14', currencies=['EUR','USD'], title='My headline', details='My notes', url='https://example.com/news')

    def test_blank_slate_crud_and_reload(self):
        old = self.root / 'wildcards'; old.mkdir(); (old/'latest.json').write_text('{"old":true}')
        self.assertEqual(read_news(self.directory), {'items':[]})
        added=write_news(self.directory, NewsEntry(**self.entry)); identity=added['items'][0]['id']
        edited=write_news(self.directory, NewsEntry(**{**self.entry,'title':'Edited'}), identity)
        self.assertEqual(read_news(self.directory),edited)
        self.assertEqual(edited['items'][0]['title'],'Edited')
        self.assertEqual(write_news(self.directory, identity=identity, delete=True),{'items':[]})
        self.assertTrue((old/'latest.json').exists())

    def test_validation_and_failed_save_preserve_previous_news(self):
        for changes in [{'currencies':[]},{'currencies':['BTC']},{'title':' '},{'url':'javascript:alert(1)'},{'date':'2026-99-99'}]:
            with self.assertRaises(ValidationError):NewsEntry(**{**self.entry,**changes})
        saved=write_news(self.directory,NewsEntry(**self.entry))
        with patch('storage.legacy_news.os.replace',side_effect=OSError('disk full')),self.assertRaises(OSError):
            write_news(self.directory,NewsEntry(**{**self.entry,'title':'Failed'}))
        self.assertEqual(read_news(self.directory),saved)
        with self.assertRaises(KeyError):write_news(self.directory,identity='missing',delete=True)

    def test_manual_news_is_included_in_calendar_backups(self):
        from storage.calendar_store import CalendarStore
        from storage.recovery import backup_directory, restore_directory
        source = self.root / 'data'
        store = CalendarStore(source / 'calendar.sqlite3')
        store.close()
        saved = write_news(source / 'manual-news', NewsEntry(**self.entry))
        backup_directory(source, self.root / 'backup')
        restore_directory(self.root / 'backup', self.root / 'restored')
        self.assertEqual(read_news(self.root / 'restored' / 'manual-news'), saved)
