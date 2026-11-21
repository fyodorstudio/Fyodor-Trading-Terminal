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
from storage.news_flow.importance import decision
from storage.news_flow.relevance import PRESET
from storage.news_flow.tests.test_notifications import request


class NewsDeliveryPolicyTests(unittest.TestCase):
    def test_remaining_obvious_noise_is_excluded_from_both_priorities(self):
        titles = [
            'Top Back Office Software Stocks for 2027, According to Citi',
            'Anthropic is a must-buy in an AI portfolio, says Bullpen Capital',
            'Fed Tells Regional Staff to Expect Lower Pay Increases in 2027',
            'Fed Cuts Pay Raises for Regional-Bank Staff',
            'These Charts Show Why Young People Across the World Are Fed Up With the Economy',
            'Meta faces sanctions bid over withheld evidence in teen mental health cases',
            'DJI Elliott Wave forecast: Decline continues',
        ]
        for title in titles:
            with self.subTest(title=title):
                self.assertEqual(decision(title, include=', '.join(PRESET), enabled=True)['tier'], 'excluded')

    def test_priority_one_keeps_catalysts_and_fundamental_context(self):
        high = [
            "Japan's Katayama warns of one-sided yen moves near 160, will coordinate with US Treasury",
            'Hawkish BOJ policymaker Takata calls for swift hike in rates',
            'FOMC Minutes: A couple of participants noted a hike of more than 25 bps could warrant consideration in December',
            'Australia unemployment rises to 4.9% vs 4.7% expected',
            'Oil shipped through Hormuz falls as Iranian strikes increase',
            'Iran Intensifies Hormuz Tanker Attacks Just as Oil Prices Slide',
            'EU expands Russia sanctions list by 145 names and entities',
            'US announces new tariffs on Chinese imports',
            'China and Canada Expand Tariff Relief as Xi Meets Carney',
            'Nasdaq plunges 5% as AI selloff spreads',
            'European stocks end a bruising week. German DAX falls 7.29%.',
            'Nasdaq sinks more than -5% as tech rout deepens',
            'VIX jumps 25% as global stocks slump',
            'UBS warns of funding crisis',
            'Fed launches emergency liquidity facility as banking crisis spreads',
            'Waller Says Fed Should Consider Half-Point Rate Hike',
            'Fed Waller says central bank may need to shock people with half-point rate hike',
            'Japan issues fresh FX intervention warnings',
        ]
        high += [
            'Trump weighs another strike on Iran as Hormuz shipping risks mount',
            'The Oil Market Is Brimming With Crude Despite Tanker Attacks',
            'Gulf attacks lift Crude Oil, but most of Monday drop stays',
            'Vujcic Says Bets on ECB Hike in 2027 Do Not Seem Unreasonable',
            'Kashkari says markets see more Fed hikes than officials do',
            'Gold Steadies Near 14-Month Low as Fed Signals More Rate Hikes',
            'Asian markets trade mixed as Nvidia earnings lift Kospi and Nikkei; Hong Kong slips on US chip curbs',
            'China says it will take countermeasures if US imposes new chip curbs',
            'Chinese firms turn to US AI models for training as export restrictions tighten',
            'Biggest risk for 2027 is Fed tightening too quickly, says Nuveen Saira Malik',
            'Bitcoin could slide into the $50,000s as Fed rate hike bets build, Wintermute says',
            'Canada retail sales 0.8% vs 0.7% expected',
        ]
        context = [
            'British Pound declines as UK CPI misses estimates',
            'Canadian home sales edge higher as BoC raises interest rates',
            'Fed has more work to do to bring down inflation',
            'RBA holds cash rate as expected', 'RBA hike is 80% priced',
            'Donald Trump seeks Ukraine peace deal before January',
            'Oil Futures Halt Slide Awaiting Clarity on Middle East Talks',
            'Applied Materials sinks 11% amid broad chip stock pullback (AMAT:NASDAQ)',
            'PDF Solutions sinks 12% as tech stocks retreat (PDFS:NASDAQ)',
            'UK Stocks, AI Adoption Drive FTSE 250 Gains as Oil Drops 20%',
            'Diamondback strikes $5bn deal to expand drilling in oil-rich Permian Basin',
            'European gas futures climb as recovering oil exports overshadow shipping attacks',
            'US Treasury confirms currency intervention in July',
            'Japan confirms currency intervention in July',
            'VIX jumps 5% as traders await Fed meeting',
            'Nasdaq falls 0.5% as traders await Fed meeting',
            'Japan could warn of currency intervention later today',
            'Japan expected to issue currency intervention warning',
            'Fed could signal faster rate increases next week',
            'BOJ Ueda Says Food Sales Tax Cut Likely to Help Spur Growth',
            'Bank of Canada Says April Scenario Analysis Telegraphed Hike',
        ]
        for title in high:
            with self.subTest(title=title):
                self.assertEqual(decision(title, include=', '.join(PRESET), enabled=True)['tier'], 'priority')
        for title in context:
            with self.subTest(title=title):
                self.assertNotEqual(decision(title, include=', '.join(PRESET), enabled=True)['tier'], 'priority')

    def test_priority_one_shared_trigger_persistence_and_no_replay(self):
        baseline = self.store.arrivals()['cursor']
        self.notifier.configure({'include': ', '.join(PRESET)})
        self.add('critical', self.now, 'Japan warns of currency intervention to support yen')
        self.add('context', self.now, 'Gold steadies')
        self.add('noise', self.now, 'Top software stocks to buy now')
        async def run():
            prefix = '/api/v1/news-flow'
            status, body = await request(self.app, 'PUT', prefix+'/notifications/settings', dict(mode='priority', max_age_seconds=3600))
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)['mode'], 'priority')
            self.assertEqual(NewsNotifier(self.store).settings()['mode'], 'priority')
            body = (await request(self.app, 'GET', prefix+f'/arrivals?configured=true&after={baseline}'))[1]
            desktop = json.loads(body)
            self.assertEqual([r['url'] for r in desktop['items']], ['https://example.com/critical'])
            self.notifier.cursor = baseline
            self.notifier.tick()
            self.assertEqual(self.notifier.last_sent['count'], 1)
            self.assertIn('Priority 1', self.sent[0]['message'])
            self.assertNotIn('Priority 2', self.sent[0]['message'])
            await request(self.app, 'PUT', prefix+'/notifications/rules', dict(include=', '.join(PRESET), exclude='', hidden=[], market_relevance=True, preset_version=4))
            self.assertEqual(self.notifier.settings()['mode'], 'priority')
            await request(self.app, 'PUT', prefix+'/notifications/settings', dict(mode='included', max_age_seconds=3600))
            self.assertEqual(json.loads((await request(self.app, 'GET', prefix+f'/arrivals?configured=true&after={desktop["cursor"]}'))[1])['items'], [])
            self.notifier.tick()
            self.assertEqual(len(self.sent), 1)
            self.assertEqual((await request(self.app, 'GET', prefix+f'/arrivals?mode=priority&include=yen&after={baseline}'))[0], 200)
        asyncio.run(run())

    def test_priority_one_republication_is_silent_across_batches_and_keeps_changed_figures(self):
        baseline = self.store.arrivals()['cursor']
        self.add('first', self.now, 'OPEC announces production cuts')
        first = self.store.arrivals(baseline, 'OPEC', now=self.now+2, mode='priority', market_relevance=True)
        self.assertEqual(len(first['items']), 1)
        self.add('copy', self.now, 'OPEC announces production cuts - Reuters')
        repeat = self.store.arrivals(first['cursor'], 'OPEC', now=self.now+2, mode='priority', market_relevance=True)
        self.assertEqual(repeat['items'], [])
        self.add('change', self.now, 'OPEC announces production cuts of 2 million barrels a day')
        update = self.store.arrivals(repeat['cursor'], 'OPEC', now=self.now+2, mode='priority', market_relevance=True)
        self.assertEqual([r['url'] for r in update['items']], ['https://example.com/change'])
        self.assertEqual(self.store.query()['total'], 3, 'Every source remains readable')

    def test_hidden_or_stale_prior_copy_cannot_suppress_a_priority_one_alert(self):
        other_id = self.store.save_source('Other', 'https://example.com/other-feed')
        other = next(s for s in self.store.sources() if s['id'] == other_id)
        self.store.success(other, [], '', '', self.now)
        baseline = self.store.arrivals()['cursor']
        title = 'OPEC announces production cuts'
        self.add('stale', self.now-7200000, title)
        self.store.success(other, [dict(identity='fresh', title=title+' - Reuters', summary='', publisher='Reuters',
                                       url='https://example.com/fresh-copy', published_at=self.now)], '', '', self.now+2)
        scope = dict(mode='priority', market_relevance=True, now=self.now+3, max_age_seconds=3600)
        self.assertEqual(len(self.store.arrivals(baseline, 'OPEC', **scope)['items']), 1)
        self.assertEqual(len(self.store.arrivals(baseline, 'OPEC', hidden=[self.source['id']], **scope)['items']), 1)
        unlimited = {**scope, 'max_age_seconds': None}
        self.assertEqual([r['url'] for r in self.store.arrivals(baseline, 'OPEC', **unlimited)['items']], ['https://example.com/stale'])
        self.assertEqual([r['url'] for r in self.store.arrivals(baseline, 'OPEC', hidden=[self.source['id']], **unlimited)['items']], ['https://example.com/fresh-copy'])

    def test_priority_one_republication_window_expires(self):
        baseline = self.store.arrivals()['cursor']
        self.add('early', self.now, 'OPEC announces production cuts')
        later = self.now + 7200002
        self.store.success(self.source, [dict(identity='late', title='OPEC announces production cuts - Reuters',
            url='https://example.com/later-copy', summary='', publisher='Reuters', published_at=later)], '', '', later)
        page = self.store.arrivals(baseline, 'OPEC', mode='priority', market_relevance=True, now=later+1)
        self.assertEqual([r['url'] for r in page['items']], ['https://example.com/later-copy'])

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
