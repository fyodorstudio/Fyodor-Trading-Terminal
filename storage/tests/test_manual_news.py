import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
from pydantic import ValidationError
from storage.app import create_app
from storage.manual_news import NewsEntry, read_news, write_news

class ManualNewsTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.directory = self.root / 'manual-news'
        self.entry = dict(date='2026-11-14', currencies=['EUR','USD'], title='My headline', details='My notes', url='https://example.com/news')

    def test_blank_slate_crud_and_reload(self):
        old = self.root / 'currency-news'; old.mkdir(); (old/'latest.json').write_text('{"old":true}')
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
        with patch('storage.manual_news.os.replace',side_effect=OSError('disk full')),self.assertRaises(OSError):
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

    def test_http_add_edit_delete_and_retired_routes(self):
        async def run():
            app=create_app(self.root,run_collector=False)
            async with app.router.lifespan_context(app):
                class Client:
                    async def request(self, method, path, json=None):
                        from types import SimpleNamespace
                        import json as codec
                        sent=[];raw=codec.dumps(json).encode() if json is not None else b''
                        async def receive():return {'type':'http.request','body':raw,'more_body':False}
                        async def send(message):sent.append(message)
                        scope={'type':'http','http_version':'1.1','scheme':'http','method':method,'path':path,'raw_path':path.encode(),'query_string':b'',
                               'headers':[(b'content-type',b'application/json')],'client':('127.0.0.1',1),'server':('127.0.0.1',80)}
                        await app(scope,receive,send)
                        payload=codec.loads(b''.join(m.get('body',b'') for m in sent if m['type']=='http.response.body'))
                        return SimpleNamespace(status_code=sent[0]['status'],json=lambda:payload)
                    async def get(self,path):return await self.request('GET',path)
                    async def post(self,path,json):return await self.request('POST',path,json)
                    async def put(self,path,json):return await self.request('PUT',path,json)
                    async def delete(self,path):return await self.request('DELETE',path)
                client=Client()
                self.assertEqual((await client.get('/api/v1/currency-news')).json(),{'items':[]})
                added=await client.post('/api/v1/currency-news',json=self.entry);self.assertEqual(added.status_code,200)
                identity=added.json()['items'][0]['id']
                edited=await client.put('/api/v1/currency-news/'+identity,json={**self.entry,'details':'Changed'})
                self.assertEqual(edited.json()['items'][0]['details'],'Changed')
                bad=await client.post('/api/v1/currency-news',json={**self.entry,'url':'javascript:alert(1)'})
                self.assertEqual(bad.status_code,422)
                for route in ['external-sources','legacy-research','alert-impact','currency-details','reports']:
                    self.assertEqual((await client.get('/api/v1/'+route)).status_code,404)
                self.assertEqual((await client.delete('/api/v1/currency-news/'+identity)).json(),{'items':[]})
                self.assertEqual((await client.delete('/api/v1/currency-news/'+identity)).status_code,404)
        asyncio.run(run())
