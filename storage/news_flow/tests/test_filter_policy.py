import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest
from urllib.parse import urlencode

from fastapi import FastAPI
from storage.news_flow.api import news_router
from storage.news_flow.collector import NewsCollector
from storage.news_flow.filter_policy import DEFAULTS, FilterPolicy, canonical_policy
from storage.news_flow.importance import decision
from storage.news_flow.notifications import NewsNotifier
from storage.news_flow.relevance import classify, PRESET
from storage.news_flow.store import NewsStore
from storage.news_flow.tests.test_diagnostics import request

INCLUDE = ', '.join(PRESET)
HEADLINE = 'Indonesian Rupiah gains as US Dollar weakens amid Treasury sell-off'


class NewsFilterPolicyTests(unittest.TestCase):
    def test_traded_drivers_override_other_market_without_whitelisting_every_dollar_mention(self):
        keep = [HEADLINE, 'Indonesian Rupiah steadies amid Treasury sell-off',
                'Indonesian Rupiah gains as Dollar weakens', 'Singapore Dollar gains after US CPI slows',
                'Indian rupee rises as US Dollar weakens', 'Singapore Dollar gains as US Dollar falls',
                'Vietnam markets slide as yen surges on intervention', 'India oil imports fall as Brent rallies']
        keep += ['Treasury sanctions Iranian oil smuggling network linked to Mexican cartels',
                 'Treasury sanctions criminal network linked to Nvidia',
                 'Readout from Secretary of the Treasury meeting with Canadian Finance Minister',
                 'Readout from Secretary of the Treasury meeting with Japanese Finance Minister',
                 'Readout from Secretary of the Treasury meeting with UK Chancellor',
                 'Readout from Secretary of the Treasury meeting with European Commissioner for Trade',
                 "Readout from Secretary of the Treasury Scott Bessent’s Meeting with Mexican Secretary of Finance Edgar Amador Zamora"]
        reject = ['Indonesian Rupiah rises before local GDP release',
                  'Singapore Dollar gains before local GDP release',
                  'Singapore Dollar: Bearish bias capped against US Dollar - UOB',
                  'India inflation falls as domestic demand slows', 'Indian shares rise as fiscal deficit narrows']
        reject += ['Treasury Sanctions Guatemalan Drug Trafficking Organizations Supporting Mexican Narco-Terrorist Cartels']
        for expected, titles in [(True, keep), (False, reject)]:
            for title in titles:
                with self.subTest(title=title):
                    result = classify(title, include=INCLUDE, enabled=True)
                    self.assertEqual(result['included'], expected, result)
        result = classify(HEADLINE, include=INCLUDE, enabled=True)
        self.assertIn('Treasury', result['reason'])
        self.assertFalse(decision(HEADLINE, include=INCLUDE, exclude='Treasury', enabled=True, pinned=True)['included'])

    def test_each_visible_switch_changes_its_own_behaviour(self):
        blocked = [
            ('other_markets', 'Indonesian Rupiah rises before local GDP release'),
            ('crypto_only', 'Bitcoin Price Forecast: BTC/USD falls below support'),
            ('retail_quotes', 'Saudi Arabia Gold price today: Gold falls'),
            ('non_market', 'Japanese skater wins gold medal'),
            ('routine', 'Best brokers for gold trading'),
            ('routine', 'Treasury sanctions Mexican drug cartels'),
            ('metadata', 'TAG: gold'),
            ('subject_context', 'TinyCo stock hits 52-week low at 14.25 USD'),
            ('broad_context', 'AI tool writes funny birthday poems'),
        ]
        for switch, title in blocked:
            with self.subTest(switch=switch):
                self.assertFalse(classify(title, include=INCLUDE, enabled=True)['included'])
                self.assertTrue(classify(title, include=INCLUDE, enabled=True, filter_policy=json.dumps({switch: False}))['included'])
        self.assertTrue(classify(HEADLINE, include=INCLUDE, enabled=True)['included'])
        self.assertFalse(classify(HEADLINE, include=INCLUDE, enabled=True, filter_policy='{"cross_market":false}')['included'])
        for flag, title, feed in [
            ('protect_official', 'Speech: Edmonton Chamber of Commerce', 'https://www.bankofcanada.ca/content_type/speeches/feed/'),
            ('protect_remarks', "UK's Bailey: US developments warrant monitoring", 'https://www.fxstreet.com/rss'),
        ]:
            self.assertTrue(classify(title, feed_url=feed, enabled=True)['included'])
            self.assertFalse(classify(title, feed_url=feed, enabled=True, filter_policy=json.dumps({flag: False}))['included'])
        self.assertTrue(classify(HEADLINE, include='dollar', enabled=False, filter_policy='{"cross_market":false}')['included'])

    def test_editable_lists_and_strict_schema(self):
        local = 'Indonesian Rupiah gains before local inflation release'
        self.assertFalse(classify(local, include=INCLUDE, enabled=True)['included'])
        for options in [dict(other_market_terms=''), dict(exceptions='rupiah')]:
            self.assertTrue(classify(local, include=INCLUDE, enabled=True, filter_policy=json.dumps(options))['included'])
        treasury = 'Indonesian Rupiah steadies amid Treasury sell-off'
        self.assertFalse(classify(treasury, include=INCLUDE, enabled=True, filter_policy='{"exceptions":""}')['included'])
        self.assertFalse(classify(treasury, include=INCLUDE, enabled=True, filter_policy='{"exceptions":"Treasuries"}')['included'], 'Editable policy lists use literal terms, not hidden aliases')
        self.assertEqual(FilterPolicy().model_dump(), DEFAULTS)
        self.assertEqual(canonical_policy(json.dumps(DEFAULTS)), '{}')
        self.assertEqual(canonical_policy('{"crypto_only":true,"other_markets":false}'), '{"other_markets":false}')
        for invalid in ['not JSON', '[]', '{"other_markets":"false"}', '{"unknown":true}', '{"exceptions":false}', json.dumps({'exceptions': ','.join('word'+str(i) for i in range(501))})]:
            with self.subTest(invalid=invalid[:60]), self.assertRaises(ValueError):
                canonical_policy(invalid)

    def test_policy_reaches_reader_export_arrivals_api_and_phone_without_replays(self):
        with TemporaryDirectory() as root:
            store = NewsStore(root); source = store.sources()[0]; now = int(time.time()*1000)
            store.success(source, [], '', '', now)
            baseline = store.arrivals()['cursor']
            local = 'Indonesian Rupiah gains before local inflation release'
            for index, title in enumerate([HEADLINE, local]):
                store.success(source, [dict(identity=str(index), title=title, url=f'https://example.com/{index}',
                                            summary='', publisher='FXStreet', published_at=now)], '', '', now+1)
            filters = '{"other_markets":false}'
            for scope, expected in [('', 1), (filters, 2)]:
                self.assertEqual(store.query(include=INCLUDE, mode='included', market_relevance=True, filter_policy=scope, limit=1)['total'], expected)
                self.assertEqual(store.export_headlines(include=INCLUDE, mode='included', market_relevance=True, filter_policy=scope)['count'], expected)
                self.assertEqual(len(store.arrivals(baseline, INCLUDE, market_relevance=True, filter_policy=scope)['items']), expected)
            sent = []; notifier = NewsNotifier(store, lambda setup, message: sent.append(message))
            notifier.configure(dict(include=INCLUDE, exclude='', hidden=[], market_relevance=True, preset_version=3), 'included')
            notifier.root.joinpath('setup.json').write_text(json.dumps({'topic':'test'}), encoding='utf-8')
            notifier.cursor = baseline
            notifier.tick(); self.assertEqual(notifier.last_sent['count'], 1)
            notifier.configure({'filter_policy':filters}); notifier.tick()
            self.assertEqual(len(sent), 1, 'Editing filters cannot replay already consumed arrivals')
            app = FastAPI(); app.include_router(news_router(store, NewsCollector(store), notifier))
            async def run():
                prefix = '/api/v1/news-flow'
                policy = dict(include=INCLUDE, exclude='', market_relevance=True, filter_policy=filters)
                status, body = await request(app, 'POST', prefix+'/classify', {**policy, 'title':HEADLINE})
                checked = json.loads(body); self.assertEqual(status, 200)
                self.assertTrue(checked['relevance']['included']); self.assertIn('dollar', checked['matched_include']); self.assertIn('Treasury', checked['matched_include'])
                for route in ('items', 'export'):
                    params = dict(policy, mode='included'); params['market_relevance']='true'
                    status, body = await request(app, 'GET', prefix+'/'+route+'?'+urlencode(params))
                    page = json.loads(body); self.assertEqual(status, 200); self.assertEqual(page.get('total',page.get('count')), 2)
                status, body = await request(app, 'GET', prefix+f'/arrivals?configured=true&after={baseline}')
                self.assertEqual(status, 200); self.assertEqual(len(json.loads(body)['items']), 2)
                status, body = await request(app, 'GET', prefix+'/phone-profile')
                self.assertEqual(json.loads(body)['filter_policy'], filters)
                await request(app, 'PUT', prefix+'/notifications/rules', dict(include=INCLUDE, exclude='', hidden=[], market_relevance=True, preset_version=3))
                self.assertEqual(notifier.settings()['filter_policy'], filters, 'Legacy clients cannot erase a custom policy by omitting it')
                for route in ('items', 'export', 'arrivals'):
                    self.assertEqual((await request(app, 'GET', prefix+'/'+route+'?filter_policy='+urlencode({'v':'{"unknown":true}'})[2:]))[0],422)
                self.assertEqual((await request(app, 'PUT', prefix+'/notifications/rules', {**policy,'filter_policy':'{"crypto_only":"false"}'}))[0],422)
                status, body = await request(app, 'PUT', prefix+'/notifications/rules', {**policy,'filter_policy':'{"cross_market":false}'})
                self.assertEqual(status,200); self.assertEqual(notifier.settings()['filter_policy'],'{"cross_market":false}')
                self.assertEqual(len(sent),1,'Headline checks and rule updates do not send test notifications')
            asyncio.run(run())
