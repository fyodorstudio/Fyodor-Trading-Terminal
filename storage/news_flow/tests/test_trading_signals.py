import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest

from fastapi import FastAPI

from storage.news_flow.api import news_router
from storage.news_flow.collector import NewsCollector
from storage.news_flow.importance import decision
from storage.news_flow.notifications import NewsNotifier
from storage.news_flow.relevance import PRESET
from storage.news_flow.store import NewsStore
from storage.news_flow.tests.test_notifications import request

INCLUDE = ', '.join(PRESET)
CASES = json.loads(Path(__file__).with_name('trading_relevance_cases.json').read_text(encoding='utf-8'))


class TradingSignalTests(unittest.TestCase):
    def test_reviewed_fundamentals_survive_and_important_mechanisms_reach_priority_one(self):
        for case in CASES:
            with self.subTest(title=case['title']):
                result = decision(case['title'], url=case['url'], feed_url=case['feed_url'],
                                  include=INCLUDE, enabled=True, summary=case['summary'])
                value = {'excluded': 0, 'included': 1, 'priority': 2}[result['tier']]
                if case['minimum_level'] == 0:
                    self.assertEqual(value, 0, result)
                else:
                    self.assertGreaterEqual(value, case['minimum_level'], result)
                blocked = decision(case['title'], include=INCLUDE, enabled=True,
                                   summary=case['summary'], exclude=case['title'], pinned=True)
                self.assertEqual(blocked['tier'], 'excluded', blocked)

    def test_summary_can_rescue_a_technical_title_without_inventing_a_confirmed_event(self):
        title = 'USD/JPY Price Forecast: Fresh upside likely above 160.40'
        self.assertEqual(decision(title, include=INCLUDE, enabled=True)['tier'], 'excluded')
        summary = 'A deeper equity selloff could unwind carry trades and support the Yen as US yields fall.'
        result = decision(title, include=INCLUDE, enabled=True, summary=summary)
        self.assertEqual(result['tier'], 'priority')
        self.assertIn('context', result['priority_reason'])
        self.assertNotIn('confirmed', result['priority_reason'].lower())
        self.assertEqual(decision(title, include='EUR, GBP', enabled=True, summary=summary)['tier'], 'excluded')
        self.assertEqual(decision('A market update', include='JPY', enabled=False, summary='JPY risk-off flows')['tier'], 'excluded')
        crypto = decision('Bitcoin slides as risk-off mood pressures crypto', include=INCLUDE,
                          enabled=True, summary='Risk appetite among token buyers remains weak.')
        self.assertEqual(crypto['tier'], 'excluded', crypto)
        for headline in ['UBS hires a portfolio manager', 'Indonesia banks report quarterly results']:
            rescued = decision(headline, include=INCLUDE, enabled=True,
                               summary='US Dollar funding stress is spreading as global credit conditions tighten.')
            self.assertEqual(rescued['tier'], 'priority', rescued)

    def test_policy_punctuation_research_and_opposite_risk_directions_keep_the_mechanism(self):
        for title in [
            "Forget 25 Bps? Fed's Waller says 'shock people' with 50-bp December hike",
            'Fed’s Waller warns inflation is worsening, floats 50-basis-point December hike',
            'BoE’s Pill: Further rate rises needed to combat inflation',
            'Japanese Yen gains on safe-haven demand as risk aversion grows',
            'Japanese Yen weakens as risk appetite returns and haven flows unwind',
            'US Dollar: Hawkish Fed risks support gains – ING',
            'Gold Weekly Forecast: Dovish Fed repricing supports bullion',
            'Canada and Philippines sign trade deal',
            'EU governments authorise signature of trade deal agreement with Indonesia',
        ]:
            with self.subTest(title=title):
                self.assertEqual(decision(title, include=INCLUDE, enabled=True)['tier'], 'priority')
        for title in [
            'SpaceX’s Cursor weighs phasing out Chinese AI models over geopolitical risk, CNBC reports',
            'Japan football team wins tournament',
            'India GDP grows faster than expected',
            'Bitcoin Price Forecast: BTC/USD tests its moving average',
            'TAG: gold market selloff',
        ]:
            with self.subTest(title=title):
                self.assertEqual(decision(title, include=INCLUDE, enabled=True)['tier'], 'excluded')

    def test_summary_decisions_agree_across_reader_copy_desktop_phone_and_checker(self):
        with TemporaryDirectory() as root:
            store = NewsStore(root)
            source = store.sources()[0]
            now = int(time.time() * 1000)
            store.success(source, [], '', '', now)
            baseline = store.arrivals()['cursor']
            sent = []
            notifier = NewsNotifier(store, lambda setup, body: sent.append(body))
            notifier.configure(dict(include=INCLUDE, exclude='', market_relevance=True), 'priority')
            notifier.root.joinpath('setup.json').write_text(json.dumps({'topic': 'test'}), encoding='utf-8')
            entries = [
                dict(identity='signal', title='Euro: Downside risks grow – ING',
                     summary='Fed-ECB policy divergence widens real swap differentials.', publisher='FXStreet',
                     url='https://example.com/signal', published_at=now),
                dict(identity='context', title='Gold steadies', summary='', publisher='Reuters',
                     url='https://example.com/context', published_at=now),
                dict(identity='noise', title='Walmart names a director to the board', summary='', publisher='Reuters',
                     url='https://example.com/noise', published_at=now),
            ]
            store.success(source, entries, '', '', now + 1)
            for mode, expected in [('priority', {'signal'}), ('included', {'context'}), ('excluded', {'noise'})]:
                page = store.query(mode=mode, include=INCLUDE, market_relevance=True)
                self.assertEqual({row['identity'] for row in page['items']}, expected)
                self.assertEqual(page['total'], 1)
                copied = store.export_headlines(mode=mode, include=INCLUDE, market_relevance=True)
                self.assertEqual(copied['count'], 1)
                self.assertIn(next(row['url'] for row in entries if row['identity'] in expected), copied['text'])
            self.assertEqual(len(store.arrivals(baseline, INCLUDE, now=now+2, mode='priority', market_relevance=True)['items']), 1)
            self.assertEqual(len(store.arrivals(baseline, INCLUDE, now=now+2, mode='included', market_relevance=True)['items']), 2)
            notifier.cursor = baseline
            notifier.tick()
            self.assertEqual(notifier.last_sent['count'], 1)
            self.assertIn(entries[0]['title'], sent[0]['title'])
            notifier.tick()
            self.assertEqual(len(sent), 1, 'Reclassification must not replay consumed arrivals')
            app = FastAPI()
            app.include_router(news_router(store, NewsCollector(store), notifier))

            async def run():
                body = dict(title=entries[0]['title'], summary=entries[0]['summary'],
                            include=INCLUDE, market_relevance=True)
                status, data = await request(app, 'POST', '/api/v1/news-flow/classify', body)
                self.assertEqual(status, 200)
                self.assertEqual(json.loads(data)['relevance']['tier'], 'priority')
                status, data = await request(app, 'GET', f'/api/v1/news-flow/arrivals?configured=true&after={baseline}')
                self.assertEqual(status, 200)
                self.assertEqual([r['identity'] for r in json.loads(data)['items']], ['signal'])
                status, _ = await request(app, 'POST', '/api/v1/news-flow/classify', {**body, 'summary': 'x' * 8001})
                self.assertEqual(status, 422)

            asyncio.run(run())
