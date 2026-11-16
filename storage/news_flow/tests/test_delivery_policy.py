import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest

from fastapi import FastAPI
from storage.news_flow.api import news_router
from storage.news_flow.collector import NewsCollector
from storage.news_flow.notifications import NewsNotifier
from storage.news_flow.store import NewsStore
from storage.news_flow.tests.test_notifications import request


class NewsDeliveryPolicyTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.store = NewsStore(self.root)
        self.source = self.store.sources()[0]; self.now = int(time.time()*1000)
        self.store.success(self.source, [], '', '', self.now)
        self.sent = []; self.notifier = NewsNotifier(self.store, lambda setup, body: self.sent.append(body))
        self.notifier.configure(dict(include='oil',exclude='',hidden=[],market_relevance=True,preset_version=3),'included')
        (self.notifier.root/'setup.json').write_text(json.dumps({'topic':'test'}),encoding='utf-8')
        self.app = FastAPI(); self.app.include_router(news_router(self.store, NewsCollector(self.store), self.notifier))

    def add(self, identity, publication, title='Oil supply development'):
        self.store.success(self.source, [dict(identity=identity,title=title,url='https://example.com/'+identity,summary='',publisher='Reuters',published_at=publication)], '', '', self.now+1)

    def test_publication_age_not_collection_age_and_no_filtered_backlog(self):
        baseline = self.store.arrivals()['cursor']
        self.add('six-days-old',self.now-6*86400000)
        self.add('recent',self.now-1800000)
        self.add('unknown',None)
        self.add('scheduled',self.now+86400000)
        selected=self.store.arrivals(baseline,'oil',now=self.now+2,max_age_seconds=3600)
        self.assertEqual([row['url'] for row in selected['items']],['https://example.com/recent'])
        self.assertEqual(self.store.query()['total'],4,'Age exception never hides cached research headlines')
        self.assertEqual(self.store.arrivals(selected['cursor'],'oil',now=self.now+2,max_age_seconds=None)['items'],[], 'Expanding the limit does not replay suppressed arrivals')
        self.assertEqual(len(self.store.arrivals(baseline,'oil',now=self.now+2,max_age_seconds=None)['items']),4)
        self.assertEqual(self.store.arrivals(baseline,'oil',now=self.now+86400000,max_age_seconds=3600)['items'],[], 'Scheduled feed times cannot later become trusted publication times')

    def test_shared_settings_control_desktop_and_phone_without_rule_loss(self):
        baseline=self.store.arrivals()['cursor']
        self.add('old',self.now-6*86400000)
        self.add('fresh',self.now-1800000)
        self.add('unknown',None)
        self.add('irrelevant',self.now-1000,'Sports final')
        async def run():
            prefix='/api/v1/news-flow'
            status,body=await request(self.app,'PUT',prefix+'/notifications/settings',dict(mode='included',max_age_seconds=3600))
            self.assertEqual(status,200); self.assertEqual(json.loads(body)['max_age_seconds'],3600)
            self.assertEqual(self.notifier.settings()['include'],'oil')
            status,body=await request(self.app,'GET',prefix+f'/arrivals?configured=true&after={baseline}')
            desktop=json.loads(body); self.assertEqual(status,200)
            self.assertEqual([row['url'] for row in desktop['items']],['https://example.com/fresh'])
            self.notifier.tick()
            self.assertEqual(self.notifier.last_sent['url'],desktop['items'][0]['url'])
            self.assertEqual(len(self.sent),1)
            await request(self.app,'PUT',prefix+'/notifications/settings',dict(mode='all',max_age_seconds=3600))
            body=(await request(self.app,'GET',prefix+f'/arrivals?configured=true&after={baseline}'))[1]
            self.assertEqual(len(json.loads(body)['items']),2,'All still enforces publication age')
            await request(self.app,'PUT',prefix+'/notifications/settings',dict(mode='off',max_age_seconds=3600))
            body=(await request(self.app,'GET',prefix+f'/arrivals?configured=true&after={baseline}'))[1]
            self.assertEqual(json.loads(body)['items'],[])
        asyncio.run(run())

    def test_age_limits_validate_and_rule_sync_preserves_delivery(self):
        async def run():
            prefix='/api/v1/news-flow'
            for age in (0,-1,True,3599,3601,31536001,'3600'):
                self.assertEqual((await request(self.app,'PUT',prefix+'/notifications/settings',dict(mode='included',max_age_seconds=age)))[0],422)
            self.assertEqual((await request(self.app,'PUT',prefix+'/notifications/settings',dict(mode='all',max_age_seconds=None)))[0],200)
            await request(self.app,'PUT',prefix+'/notifications/rules',dict(include='yen',exclude='India',hidden=['hidden'],market_relevance=True,preset_version=3))
            profile=self.notifier.settings()
            self.assertEqual(profile['mode'],'all'); self.assertIsNone(profile['max_age_seconds']); self.assertEqual(profile['include'],'yen')
        asyncio.run(run())

    def test_exact_age_boundary(self):
        baseline=self.store.arrivals()['cursor']
        self.add('boundary',self.now-3600000); self.add('one-ms-old',self.now-3600001)
        self.assertEqual([r['url'] for r in self.store.arrivals(baseline,'oil',now=self.now,max_age_seconds=3600)['items']],['https://example.com/boundary'])
