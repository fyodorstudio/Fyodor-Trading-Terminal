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

    def test_routine_data_and_unrelated_word_meanings_stay_below_priority_one(self):
        for title in [
            'US Treasury announces next week’s bond auction schedule',
            'US Treasury auctions $16B of 20 year bonds at a yield of 5.459%',
            'Treasury yields edge higher ahead of CPI data',
            'Treasury yields hold steady as investors await retail sales',
            'ECB reserve requirements remain unchanged',
            'PBOC sets USD/CNY reference rate at 6.7141 vs. 6.7152 previous',
            'PBOC sets USD/CNY reference rate at 6.7141 (vs. estimate at 6.7132)',
            'PBOC is expected to set USD/CNY reference rate at 6.6654 – Reuters estimate',
            'Toyota unveils 2027 Sienna with improved fuel economy By Investing.com - Investing.com UK',
            'Fed cuts pay raises for regional-bank staff',
            'Van Gogh painting sells at auction after strong demand',
            'Taiwan factory holds a staff meeting about short sales of equipment',
            'US 10-year treasury yield signals major bullish breakout toward 6.15%',
            'U.S. 10-Year Treasury Yield Expected to Fall to 4.9% by End-2027, BofA Survey Says',
            'KBRA Plans First Japan Rating in 2027, Expands Tokyo Team',
            'Romania’s central bank raises inflation forecast on fuel and energy prices',
        ]:
            with self.subTest(title=title):
                self.assertNotEqual(decision(title, include=INCLUDE, enabled=True)['tier'], 'priority')
        auction = decision('The US Treasury auctions $16B of 20 year bonds at a yield of 5.459%',
                           include=INCLUDE, enabled=True,
                           summary='Tail of 0.0 basis points. Bid to cover matched the average; demand was stable.')
        self.assertNotEqual(auction['tier'], 'priority', auction)

    def test_current_comparisons_and_fx_drivers_keep_both_risk_directions(self):
        for title in [
            'Treasury Two-Year Yields Sink Most Since 2025 as AI Worries Bite',
            'Treasury yields spike as inflation fears return',
            'Treasuries rise as risk-averse investors dump stocks, buy bonds',
            'Treasury yields move sharply lower as investors flee to safe havens',
            'Japan delays floating-rate JGB launch as demand weakens',
            'US 30-year bond auction tails as demand disappoints',
            'PBOC sets USD/CNY central rate at 6.7132 (vs. estimate at 6.6715)',
            'Japanese Yen retreats as intervention fears fade and risk appetite returns',
            'Japan inflation picks up less than forecast as core-core slows to 2.2%',
            'Germany corrects October inflation data, showing stronger pace',
            'Three ships struck by drones in Black Sea near Romanian shipping canal, PM says',
            'Taiwan bans short sales of stocks in new move to calm markets',
            'Moody’s rating agency downgrades US sovereign debt as fiscal risks worsen',
        ]:
            with self.subTest(title=title):
                self.assertEqual(decision(title, include=INCLUDE, enabled=True)['tier'], 'priority')
        controls = 'Taiwan bans short sales of stocks in new move to calm markets'
        for cross_market, tier in [(False, 'excluded'), (True, 'priority')]:
            policy = json.dumps(dict(other_market_terms='Taiwan', cross_market=cross_market))
            self.assertEqual(decision(controls, include=INCLUDE, enabled=True, filter_policy=policy)['tier'], tier)

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
