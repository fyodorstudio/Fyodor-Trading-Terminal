import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest

from storage.news_flow.importance import decision
from storage.news_flow.notification_format import payload
from storage.news_flow.notifications import NewsNotifier
from storage.news_flow.relevance import PRESET
from storage.news_flow.store import NewsStore

INCLUDE = ', '.join(PRESET)


class NewsAttentionTests(unittest.TestCase):
    def test_explicit_attention_and_routine_commentary_are_distinct(self):
        high = [
            'Fed cuts interest rates to keep the economy growing',
            'Fed cuts interest rates minutes before stocks close',
            'ECB cuts interest rates by 25 basis points', 'RBA holds cash rate as expected',
            'Markets implied an 88% chance of the November 3 RBA hike',
            'RBA hike is around 80% priced',
            'Fed ends balance sheet runoff', 'Japan confirms currency intervention to support yen',
            'US payrolls unexpectedly rise above estimates', 'UK CPI misses expectations',
            'OPEC announces production cuts', 'Hormuz closure disrupts oil supply',
            'Trump says further attacks on Iran unlikely',
            'US Treasury unexpectedly doubles long-term bond buybacks',
            'Banking crisis sparks flight to gold',
            'Hawkish BOJ policymaker Takata calls for swift hike in rates',
        ]
        routine = [
            'Fed to raise rates once more in December: Reuters poll',
            'Bank of England to wait until February to next raise rates, say economists',
            'RBA Raised Rates as Price Risks Remained to Upside, Minutes Show',
            'Minutes: RBA raised cash rate at previous meeting',
            'Fed urges banks to raise lending rates',
            'Fed Waller delivers hawkish remarks', 'Bank of Canada speech: Edmonton Chamber of Commerce',
            'RBA expected to cut interest rates', 'Fed may cut rates next month',
            'British Pound: Limited downside versus US Dollar', 'Gold steadies as hawkish Fed caps gains',
            'US Dollar momentum extends on Fed repricing',
            'Markets expect RBA hike', 'US payrolls preview ahead of Friday release',
            'Goldman forecasts oil supply cuts', 'Fed says 88% of households face higher prices',
            'Fed cuts rate expectations', 'Could Iran agree a ceasefire?',
            'Nvidia sinks 88% as Fed hike odds rise',
        ]
        for title in high:
            with self.subTest(title=title):
                result = decision(title, include=INCLUDE, enabled=True)
                self.assertEqual(result['tier'], 'priority', result)
                self.assertTrue(result['priority_reason'])
        for title in routine:
            with self.subTest(title=title):
                self.assertEqual(decision(title, include=INCLUDE, enabled=True)['tier'], 'included')
        for title in ['Mercuria Hires Ex-Shell Trading Veteran to Head Up Oil Products',
                      'When Nvidia Stumbled, Equal-Weight Funds Delivered', 'Best brokers for gold trading',
                      'Nvidia earnings preview']:
            self.assertEqual(decision(title, include=INCLUDE, enabled=True)['tier'], 'excluded')
        self.assertEqual(decision('Nvidia appoints new CEO amid crisis', include=INCLUDE, enabled=True)['tier'], 'included')
        self.assertEqual(decision('Microsoft appoints head of AI unit', include=INCLUDE, enabled=True)['tier'], 'excluded')
        self.assertEqual(decision('ECB cuts rates', include=INCLUDE, exclude='ECB', enabled=True, pinned=True)['tier'], 'excluded')
        self.assertEqual(decision('My research headline', include=INCLUDE, enabled=True, pinned=True)['tier'], 'priority')

    def test_included_contains_priority_in_reader_export_and_delivery(self):
        with TemporaryDirectory() as root:
            store = NewsStore(root); source = store.sources()[0]; now = int(time.time()*1000)
            store.success(source, [], '', '', now)
            sent = []; notifier = NewsNotifier(store, lambda setup, body: sent.append(body))
            notifier.configure(dict(include=INCLUDE, exclude='', hidden=[], market_relevance=True, preset_version=3), 'included')
            notifier.root.joinpath('setup.json').write_text(json.dumps({'topic': 'test'}), encoding='utf-8')
            titles = ['ECB cuts rates', 'Gold steadies', 'Football final', 'My research headline']
            entries = [dict(identity=str(i), title=title, url=f'https://example.com/{i}', publisher='Reuters', summary='', published_at=now) for i,title in enumerate(titles)]
            store.success(source, entries, '', '', now+1)
            overlap = store.save_source('Overlapping feed', 'https://other.example/rss')
            store.success(next(s for s in store.sources() if s['id'] == overlap), [entries[0]], '', '', now+2)
            store.pin(entries[-1]['url'], True)
            scopes = {mode: store.query(mode=mode, include=INCLUDE, market_relevance=True) for mode in ('priority','included','excluded')}
            self.assertEqual([scopes[mode]['total'] for mode in scopes], [2,3,1])
            urls = {mode: {r['url'] for r in page['items']} for mode,page in scopes.items()}
            self.assertLess(urls['priority'], urls['included'])
            self.assertFalse(urls['included'] & urls['excluded'])
            self.assertEqual(store.export_headlines(mode='priority', include=INCLUDE, market_relevance=True)['count'], 2)
            copied = store.export_headlines(mode='included', include=INCLUDE, market_relevance=True)
            self.assertEqual(copied['count'], 3)
            self.assertEqual({line for line in copied['text'].splitlines() if line.startswith('https://')}, urls['included'])
            self.assertEqual(copied['text'].count(entries[0]['title']), 1)
            self.assertEqual(store.query(mode='included', include=INCLUDE, market_relevance=True, limit=1)['total'], 3)
            notifier.tick()
            self.assertEqual(notifier.last_sent['count'], 3, 'Included delivery covers Priority and Included')
            self.assertEqual(sent[0]['title'], 'News Flow · 3 new headlines')
            self.assertNotIn('Football final', sent[0]['message'])
            store.pin(entries[-1]['url'], False)
            self.assertEqual(store.query(mode='priority', include=INCLUDE, market_relevance=True)['total'], 1)
            self.assertEqual(store.query(mode='included', include=INCLUDE, market_relevance=True)['total'], 2)
            self.assertEqual(store.query(mode='included', include=INCLUDE, exclude='ECB', market_relevance=True)['total'], 1)

    def test_collection_sort_is_stable_and_does_not_change_publication_date_scope(self):
        with TemporaryDirectory() as root:
            store = NewsStore(root); source = store.sources()[0]; at = int(time.time()*1000)
            def entry(identity, published):
                return dict(identity=identity, title='Gold '+identity, url='https://example.com/'+identity, publisher='Reuters', summary='', published_at=published)
            store.success(source, [entry('fresh-publication',at)], '', '', at)
            store.success(source, [entry('late-discovery',at-86400000)], '', '', at+1000)
            store.success(source, [entry('fresh-publication',at)], '', '', at+2000)
            self.assertEqual(store.query(sort_by='collected')['items'][0]['title'], 'Gold late-discovery')
            self.assertEqual(store.query(sort_by='collected',order='oldest')['items'][0]['title'], 'Gold fresh-publication')
            self.assertEqual(store.query(sort_by='published')['items'][0]['title'], 'Gold fresh-publication')
            self.assertEqual(store.query(sort_by='published',order='oldest')['items'][0]['title'], 'Gold late-discovery')
            self.assertEqual(store.query(start=at-100,end=at+100,sort_by='collected')['total'], 1)
            self.assertEqual(store.query(sort_by='collected')['items'][1]['first_seen'], at)
            second = store.save_source('Overlap','https://example.org/rss')
            other = next(s for s in store.sources() if s['id']==second)
            store.success(other,[entry('fresh-publication',at)],'','',at+3000)
            self.assertEqual(store.query(sort_by='collected')['total'], 2)
            self.assertEqual(store.query(sort_by='collected')['items'][0]['title'], 'Gold late-discovery', 'Duplicate collection does not promote a known URL')

    def test_notification_content_has_no_repeated_headline_or_raw_link(self):
        item = dict(title='A headline ' + '長'*200, url='https://news.google.com/rss/articles/very-long', publisher='Reuters', source_name='Reuters',
                    published_at=1794225600000,first_seen=1794830400000,received_at=1794830400000,
                    relevance={'tier':'priority'})
        reader='http://192.168.0.100:8005/news'
        single=payload([item],'test',reader)
        self.assertEqual(single['title'],item['title']); self.assertNotIn(item['title'],single['message'])
        self.assertNotIn('http',single['message']); self.assertIn('Nov 09',single['message']); self.assertIn('Nov 16',single['message'])
        self.assertIn('WIB',single['message']); self.assertIn('PM',single['message']); self.assertNotIn('UTC',single['message']); self.assertIn('Priority',single['message'])
        self.assertEqual(single['click'],item['url']); self.assertEqual([a['label'] for a in single['actions']],['Open article','Open News Flow'])
        batch=payload([{**item,'title':'Headline '+str(i)+'長'*1000} for i in range(25)],'test',reader)
        self.assertLess(len(batch['message'].encode()),4096); self.assertLessEqual(len(batch['title'].encode()),1024)
        self.assertNotIn('http',batch['message']); self.assertIn('+17 more',batch['message']); self.assertEqual(batch['click'],reader)
        unknown=payload([{**item,'published_at':None}],'test',reader)
        self.assertIn('Publication time unavailable',unknown['message'])
        future=payload([{**item,'published_at':item['first_seen']+86400000}],'test',reader)
        self.assertIn('Publication time unavailable',future['message'])

    def test_jakarta_batch_groups_provider_and_collection_once_without_losing_item_times(self):
        from storage.news_flow.notification_format import stamp
        from datetime import datetime, timezone
        at = int(datetime(2026,11,16,14,44,tzinfo=timezone.utc).timestamp()*1000)
        base = dict(url='https://example.com', publisher='FXStreet', source_name='FXStreet',first_seen=at,received_at=at,relevance={'tier':'included'})
        items = [{**base,'title':f'Story {i}','published_at':at-i*60000} for i in range(4)]
        batch = payload(items,'test','http://192.168.0.100:8005/news')
        self.assertEqual(stamp(at),'Nov 16, 9:44 PM WIB')
        self.assertEqual(stamp(at+12*3600000),'Nov 17, 9:44 AM WIB')
        self.assertEqual(batch['message'].count('Collected '),1)
        self.assertEqual(batch['message'].count('FXStreet'),1)
        self.assertEqual(batch['message'].count('Published '),4)
        self.assertEqual(batch['message'].count('Included'),1)
        mixed = payload([items[0],{**items[1],'publisher':'Reuters','received_at':at+60000},
                         {**items[2],'relevance':{'tier':'priority'}}],'test')
        self.assertEqual(mixed['message'].count('Collected '),1)
        self.assertEqual(mixed['message'].count('FXStreet'),1)
        self.assertEqual(mixed['message'].count('Reuters'),1)
        self.assertIn('Priority',mixed['message']); self.assertIn('Included',mixed['message'])
        self.assertIn('9:44 PM WIB',mixed['message']); self.assertIn('9:45 PM WIB',mixed['message'])

    def test_api_validates_sorting_and_exposes_new_mode(self):
        from storage.app import create_app
        from storage.news_flow.tests.test_notifications import request
        with TemporaryDirectory() as root:
            app=create_app(Path(root), run_collector=False)
            async def run():
                for query in ('mode=priority&sort_by=collected','mode=included&sort_by=published&order=oldest'):
                    self.assertEqual((await request(app,'GET','/api/v1/news-flow/items?'+query))[0],200)
                self.assertEqual((await request(app,'GET','/api/v1/news-flow/items?sort_by=bad'))[0],422)
            asyncio.run(run())
