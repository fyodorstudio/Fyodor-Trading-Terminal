import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest

from storage.news_flow.relevance import classify, PRESET, migrate_include
from storage.news_flow.providers import RETIRED, PROVIDER_MIGRATION
from storage.news_flow.store import NewsStore
from storage.news_flow.notifications import NewsNotifier

INCLUDE = ', '.join(PRESET)
POSITIVE = [
    'Swiss economy grows 0.2% in third quarter of 2026',
    'Swiss economy grows 0.2% By Investing.com - Investing.com South Africa',
    'European shares hover near record highs; tech stocks lag By Reuters - Investing.com Nigeria',
    'Morgan Stanley is now maximum overweight global equities. Here is why',
    'Japan economy shrinks as household spending weakens',
    'Japanese Yen gains on intervention warnings', 'EURUSD breaks higher', 'AUD/JPY slides',
    'GBP/USD falls after UK wage growth slows', 'Canadian economy unexpectedly contracts',
    'New Zealand economy grows faster than expected', 'Australian economy loses momentum',
    'US jobs growth slows sharply', 'China domestic activity data disappoints',
    'China PMI slips as factories struggle', 'UK chancellor announces tax hikes',
    'ECB rate hike odds rise to 88%', 'FOMC minutes reveal split vote',
    'The Federal Reserve signals a pause', 'Bank of England raises its inflation forecast',
    "People's Bank of China lowers reserve requirement ratio", 'SNB says franc strength curbs inflation',
    'RBA holds rates, leaves door open to tightening', 'RBNZ cuts cash rate', 'Bank of Canada signals caution',
    'Fed Waller sees room for another hike', 'Trump says further Iran attacks unlikely',
    'Iran Targets Bahrain Base But Says Path to US Deal Is Open - Bloomberg.com',
    'Russia fuel crisis deepens as drones hit refineries', 'Taiwan blockade threatens chip supply',
    'US, allies team up to protect AI tech and infrastructure amid China rivalry - Reuters',
    'Democrats win House control after midterms', 'Congress approves spending bill',
    'Trump wins US presidency', 'Government shutdown threatens US GDP',
    'US Treasury unexpectedly doubles long-term bond buybacks',
    'JGB yields spike as auction demand weakens', 'Bund selloff deepens', 'UK gilts tumble',
    'Real yields fall as inflation expectations rise', 'Dollar funding stress rattles banks',
    'Bond Drought in Emerging Markets Lifts Prices as Sales Slump 41%',
    'Nasdaq-100 falls ahead of Nvidia earnings', 'SPX500 futures rally', 'S&P500 drops',
    'Dow Jones futures slip', 'TOPIX closes lower', 'Euro Stoxx futures rally', 'DAX40 sinks',
    'FTSE falls as energy stocks retreat', 'ASX200 slips', 'Hang Seng rallies',
    'Global Banks Back AI-Linked Asia Currencies to Lead Next Year',
    'IMF chief warns about global economy as AI circular financing hits $1 trillion',
    'AI is reshaping banking jobs but ability to drive profits remains unclear',
    'Nvidia CEO faces affair allegations', 'Alice Huang allegations deepen Nvidia governance concerns',
    'Jensen Huang resigns after misconduct allegations', 'SK Hynix warns on AI demand',
    'Apple cuts revenue guidance', 'UBS warns of funding stress', 'Toyota shuts factories after earthquake',
    'Brent rises as OPEC cuts supply', 'Diesel Falls Below $6 a Gallon, Easing Key Inflationary Pressure',
    'IEA lowers global oil demand forecast', 'EIA crude inventories show surprise draw',
    'Tankers avoid Hormuz after attacks', 'Gold ETFs record strong inflows',
    'Central bank gold demand rises', 'Silver lease rates surge on physical shortage',
    'COMEX raises margin requirements', 'Bullion rallies as Treasury yields fall',
    'India raises gold import duties', 'Russia oil sanctions disrupt supply',
    'Bitcoin falls alongside Nasdaq as Fed hikes rates',
    'Tether faces redemptions as stablecoin reserves come under scrutiny',
    'China trade curbs hit Australian iron ore exports',
    'Cantwell urges Lutnick to stop AI chip sales to China ahead of Xi meeting',
    'UN ready to support denuclearisation effort from US, China, Russia talks',
    'China says Xi-Putin-Trump meeting has groundbreaking significance',
    'Global banks set to enter next year on strong footing',
    'China Car Output Slows to Four-Year Low as Domestic Demand Drops',
    'China Home Price Slump Drags On Despite Latest Stimulus Push',
    "Japan's $12 bln chip deal courts needless strife",
    'Argentina sovereign default sparks contagion fears',
]
NEGATIVE = [
    'Grafton Group keeps profit guidance despite GB decline; shares down 2%',
    'Small Company raises earnings guidance', 'UnknownCo shares rise on investor update',
    'Trump golf course closure blocked by judge', 'Trump Administration Cannot Close D.C. Golf Course for Now',
    'The Problem With Applying the Great Man Theory to AI', 'AI tool writes funny birthday poems',
    'Japan football team wins tournament', 'Japanese skater wins gold medal',
    'China actor wins silver award at film premiere', 'Gold medals awarded at Olympics',
    'How to bake the perfect pound cake', 'Kiwi bird photographed in forest',
    'India Gold price today: Gold falls, according to local data',
    'Pakistan Silver price today: rates move lower', 'India GDP grows faster than expected',
    'Indian rupee rises ahead of RBI meeting', 'Nigeria central bank raises interest rates',
    'Earnings call transcript: ABB India misses EPS as stock slips',
    'Bitcoin Price Forecast: BTC/USD falls below support', 'XRP rallies as token buyers return',
    'Pi Network Price Forecast: PI under pressure', 'Ethereum ETF attracts crypto inflows',
    'New crypto token expected to surprise investors', 'Retail chair said Federer won',
    'An unexpected surprise for movie fans', 'Shareholder meeting at TinyCo postponed',
    'Local business announces jobs and financing', 'French actor joins a new movie',
    'Stocks of canned food arrive at local shop',
    'My brother inherited our house and faces a large tax bill',
]


class NewsRelevanceTests(unittest.TestCase):
    def test_labeled_cross_asset_recall_and_noise_cases(self):
        for title in POSITIVE:
            with self.subTest(expected='include', title=title):
                self.assertTrue(classify(title, include=INCLUDE, enabled=True)['included'], classify(title, include=INCLUDE, enabled=True))
        for title in NEGATIVE:
            with self.subTest(expected='exclude', title=title):
                self.assertFalse(classify(title, include=INCLUDE, enabled=True)['included'], classify(title, include=INCLUDE, enabled=True))

    def test_official_policy_protection_is_verified_and_exclude_wins(self):
        for title, feed in [
            ('Speech: Edmonton Chamber of Commerce', 'https://www.bankofcanada.ca/content_type/speeches/feed/'),
            ('Huw Pill: Institute remarks', 'https://www.bankofengland.co.uk/rss/speeches'),
            ('Highlights of the Outlook for Economic Activity and Prices', 'https://www.boj.or.jp/en/rss/whatsnew.xml'),
            ('Statement', 'https://www.federalreserve.gov/feeds/press_monetary.xml'),
            ('Speech by Governor', 'https://news.google.com/rss/search?q=site:snb.ch'),
        ]:
            with self.subTest(title=title):
                self.assertTrue(classify(title, 'custom', 'https://example.com/a', feed, '', '', True)['included'])
                self.assertFalse(classify(title, 'custom', 'https://example.com/a', feed, '', title, True)['included'])
        self.assertFalse(classify('Speech: Edmonton Chamber of Commerce', 'boc-speeches', 'https://example.com/a', 'https://example.com/feed', INCLUDE, '', True)['included'])
        self.assertFalse(classify('Banknote museum opens', 'boc-speeches', '', 'https://www.bankofcanada.ca/content_type/speeches/feed/', INCLUDE, '', True)['included'])
        self.assertFalse(classify('Statement', '', '', 'https://news.google.com/rss/search?q=site:snb.ch+OR+site:evil.example', '', '', True)['included'])
        self.assertTrue(classify('National Economy was Generally Stable', '', '', 'https://news.google.com/rss/search?q=site:stats.gov.cn/english/PressRelease/', '', '', True)['included'])
        self.assertTrue(classify("Japan's Kiuchi: Monitoring Middle East situation", '', 'https://www.fxstreet.com/news/remarks', '', INCLUDE, '', True)['included'])
        self.assertTrue(classify("UK's Bailey: US developments warrant monitoring", '', 'https://www.fxstreet.com/news/remarks', '', '', '', True)['included'])
        self.assertTrue(classify('Waller says more hikes needed', '', '', 'https://news.google.com/rss/search?q=site:reuters.com', '', '', True)['included'])
        self.assertFalse(classify('Waller wins football match', '', '', 'https://news.google.com/rss/search?q=site:reuters.com', '', '', True)['included'])
        self.assertFalse(classify('India gold demand rises', include=INCLUDE, exclude='India', enabled=True)['included'])
        self.assertFalse(classify('Swiss GDP grows - Investing.com South Africa', include=INCLUDE, exclude='South Africa', enabled=True)['included'], 'Explicit Exclude examines the complete original title')
        self.assertTrue(classify('Trump visits golf course', include='Trump', enabled=False)['included'], 'Literal mode remains available')

    def test_reader_export_arrivals_and_phone_share_one_decision(self):
        with TemporaryDirectory() as root:
            store = NewsStore(root); source = store.sources()[0]; now = int(time.time()*1000)
            store.success(source, [], '', '', now)
            sent = []
            notifier = NewsNotifier(store, lambda setup, body: sent.append(body))
            notifier.configure({'include': INCLUDE, 'exclude': '', 'hidden': [], 'market_relevance': True, 'preset_version': 3}, 'included')
            baseline = store.arrivals(mode='all')['cursor']
            titles = POSITIVE[:12] + NEGATIVE[:12]
            entries = [dict(identity=str(i), title=title, url=f'https://example.com/{i}', publisher='Reuters',
                            summary='', published_at=now) for i,title in enumerate(titles)]
            store.success(source, entries, '', '', now+1)
            (notifier.root / 'setup.json').write_text(json.dumps({'topic': 'local-test'}), encoding='utf-8')
            relevant = store.query(include=INCLUDE, mode='included', market_relevance=True)
            rejected = store.query(include=INCLUDE, mode='excluded', market_relevance=True)
            self.assertEqual(relevant['total'], 12); self.assertEqual(rejected['total'], 12)
            expected = {item['url'] for item in relevant['items']}
            arrivals = store.arrivals(baseline, INCLUDE, now=now+2, market_relevance=True)
            self.assertEqual({item['url'] for item in arrivals['items']}, expected)
            copied = store.export_headlines(include=INCLUDE, mode='included', market_relevance=True)
            self.assertEqual(copied['count'], 12)
            self.assertEqual({url for url in copied['text'].splitlines() if url.startswith('https://')}, expected)
            page = store.query(include=INCLUDE, market_relevance=True)['items']
            self.assertTrue(all(item['relevance']['included'] == (item['url'] in expected) for item in page))
            notifier.tick()
            self.assertEqual(notifier.last_sent['count'], relevant['total'])
            self.assertEqual(len(sent), 1, 'The backend phone notifier uses the same relevance selection')

    def test_migration_preserves_custom_excludes_and_pauses_only_known_retired_feed(self):
        migrated = migrate_include('Nvidia, surprise, MY CUSTOM PHRASE', 1)
        self.assertIn('MY CUSTOM PHRASE', migrated); self.assertIn('Swiss economy', migrated)
        self.assertLessEqual(len(migrated.split(',')), 500)
        self.assertEqual(migrate_include('', 1), '')
        long_custom = ', '.join(str(i) + 'x' * 130 for i in range(100))
        self.assertEqual(migrate_include(long_custom, 1), long_custom, 'Upgrade cannot overflow the rule character limit')
        with TemporaryDirectory() as root:
            store = NewsStore(root); store.sources()
            identity = store.save_source('Legacy Investing', RETIRED['investing-news'])
            with store.database() as db:
                db.execute('UPDATE sources SET id=? WHERE id=?', ('investing-news', identity))
                db.execute('DELETE FROM migrations WHERE name=?', (PROVIDER_MIGRATION,))
            migrated_store = NewsStore(root)
            self.assertEqual(next(source for source in migrated_store.sources() if source['id']=='investing-news')['collect_enabled'], 0)
            migrated_store.save_source('Legacy Investing', RETIRED['investing-news'], 'investing-news', collect_enabled=True)
            self.assertEqual(next(source for source in NewsStore(root).sources() if source['id']=='investing-news')['collect_enabled'], 1)

    def test_phone_profile_migration_is_once_and_preserves_excludes_and_off(self):
        for mode in ('off', 'all'):
            with self.subTest(mode=mode), TemporaryDirectory() as root:
                store = NewsStore(root); notifier = NewsNotifier(store)
                notifier.root.mkdir(parents=True)
                old = {'mode': mode, 'include': 'Nvidia, MY CUSTOM PHRASE', 'exclude': 'personal blacklist', 'hidden': ['sports']}
                (notifier.root/'notifications.json').write_text(json.dumps(old), encoding='utf-8')
                upgraded = notifier.settings()
                self.assertEqual(upgraded['mode'], 'off' if mode == 'off' else 'included')
                self.assertEqual(upgraded['exclude'], old['exclude']); self.assertEqual(upgraded['hidden'], old['hidden'])
                self.assertIn('MY CUSTOM PHRASE', upgraded['include']); self.assertTrue(upgraded['market_relevance'])
                self.assertEqual(json.loads((notifier.root/'notifications.before-relevance-v2.json').read_text()), old)
                self.assertEqual(notifier.settings(), upgraded)
