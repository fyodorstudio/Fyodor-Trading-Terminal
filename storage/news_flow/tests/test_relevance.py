import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest

from storage.news_flow.relevance import classify, PRESET, PROFILE, migrate_include
from storage.news_flow.filter_policy import migrate_policy, parse_policy, DEFAULTS
from storage.news_flow.providers import RETIRED, PROVIDER_MIGRATION
from storage.news_flow.store import NewsStore
from storage.news_flow.notifications import NewsNotifier

INCLUDE = ', '.join(PRESET)
POSITIVE = [
    "US to curb China's access to AI chips as Trump heads to Asia - Reuters",
    'US Reportedly Eyeing Tougher Curbs on China Chip Access',
    'Banks, investors grow wary of AI debt, spooked by market selloff - Kitco',
    'AI selloff has investors scrambling to measure their true exposure',
    'European Stock Indexes Higher as Investors Rotate Away From AI - WSJ',
    'Emerging-Market Stocks, Currencies Fall as AI Concerns Persist - Bloomberg',
    'Stocks end higher as CoreWeave results ease AI spending worries - Reuters',
    'Malaysia probing whether chips linked to Megaspeed unit were re-exported - Reuters',
    "Japan manufacturers' mood hits more than 5-year high on chip demand - Reuters",
    'US labor market resilient; existing home sales hit more than 16-year low in October - Reuters',
    'Well, that did not last long: Chips collapse, 10-year hits 5.15%',
    'Opinion | Rational Investing and Stock-Market Bubbles',
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
    'Alice Huang allegations deepen Nvidia governance concerns',
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
    'We could, conceivably, get a burst bubble if Nvida earnings fail to impress',
    'Google unveils new AI chip variants as cloud demand surges - Reuters',
    'Applied Materials forecasts quarterly revenue above estimates on strong AI chip demand - Reuters',
    'Nvidia CEO faces affair allegations',
    'Singapore Dollar: Bearish bias capped against US Dollar - UOB',
    'New awards show celebrates AI music and its creators - Reuters',
    'Top scorer on South Korean tax exam confesses to cheating with AI - Reuters',
    'Global broker Elev8 introduces AI access to help clients see more of their trading data',
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
    def test_fx_cross_asset_audit_recall_and_attribution_boundaries(self):
        cases = json.loads(Path(__file__).with_name('relevance_audit_fx_cross_asset.json').read_text(encoding='utf-8'))
        for case in cases:
            with self.subTest(title=case['title']):
                result = classify(case['title'], url=case['url'], feed_url=case['feed_url'], include=INCLUDE, enabled=True)
                self.assertEqual(result['included'], case['included'], result)
                excluded = classify(case['title'], url=case['url'], feed_url=case['feed_url'], include=INCLUDE, exclude=case['title'], enabled=True)
                self.assertFalse(excluded['included'], 'Explicit user Exclude still wins')

    def test_november_18_archive_recall_and_noise(self):
        cases = json.loads(Path(__file__).with_name('relevance_audit_20261118.json').read_text(encoding='utf-8'))
        for case in cases:
            with self.subTest(title=case['title']):
                result = classify(case['title'], url=case['url'], feed_url=case['feed_url'], include=INCLUDE, enabled=True)
                self.assertEqual(result['included'], case['included'], result)

    def test_watchlist_and_ambiguous_words_without_article_body_inference(self):
        positive = [
            'ADBE shares slide after guidance cut',
            'CRM shares tumble after export curbs',
            'Adobe Photoshop tutorial becomes revenue driver as shares surge',
            'Salesforce stock underperforms market after earnings warning',
            'Adobe stock falls Tuesday, underperforms market as Nasdaq slumps',
            'ServiceNow stock falls on the day after regulator opens investigation',
            'Dell shares fall on weak enterprise demand', 'HPE raises earnings forecast',
            'Palo Alto Networks faces outage across enterprise customers',
            'Nvidia advisor Pattinson criticizes board oversight',
            'CoreWeave financing constraints threaten AI capacity expansion',
            'Apollo CEO warns neocloud financing access could disappear',
            'Europe Gas Edges Higher', 'Drilling rig count slips in Baker Hughes survey',
            'US factory output rises', 'U.S. import prices beat forecasts',
            'German investor morale rises as ZEW outlook improves',
            'UK job vacancies slide as pay growth slows',
            'UK energy bills rise sharply',
            'US and Thailand conclude trade deal',
            "Germany's net payment to EU budget rises as Poland receives more",
            'Hungary targets euro adoption by 2030',
            'Ukraine brings down Crimean Bridge after missile strikes',
            'Taiwan flags incursions by Russian aircraft',
            'Widespread outages hit banks and air travel',
            'Nationwide FAA ground stop disrupts US flights',
            'Oil pipeline sales increase as refinery investment expands',
            'Capstone outlines data center pipeline to support AI power demand',
        ]
        negative = [
            'Why is Adobe stock sliding today?', 'Why is Salesforce stock sliding today?',
            'Why is ServiceNow stock sliding today?', 'CSCO earnings beat estimates',
            'FX option expiries for 18 November',
            'Why is UnknownCo stock sliding today?',
            'BTIG cuts Ispire Technology stock price target on business pivot',
            'This defense tech stock rises on record backlog',
            'Adobe Inc. stock falls Tuesday, underperforms market',
            'Adobe Inc. stock falls Tuesday, underperforms market (NASDAQ:ADBE)',
            'Salesforce stock outperforms competitors on strong trading day',
            'Dollar Tree shares may move on earnings release',
            'Dollar General stock receives a new Buy rating',
            'Research Solutions signals pipeline well over $5M in ARR as AI reads top 33M',
            'TinyCo sales pipeline expands with new customers',
            "I'm a psychologist: signs you have fallen into a common rut",
            "IPC indice su tutte le basi dell'indice", 'Buy now stock photography for your blog',
            'Cost shares among friends with this new tool',
            'Deezer launches AI music filter as user demand grows',
            'Anadyr Horizon CEO on using AI simulation in risk analysis',
            'Why China AI generation is going back home to build',
            'Amazon Bezos says he helped pick Pattinson as Bond',
            'Federal Reserve - Barron\'s', 'Market Data Center - Barron\'s',
            'ADBE | Adobe Inc. Stock Overview (U.S.: Nasdaq)',
            'Exness launches Anthropic CFD following market debut',
            'Before Nvidia reports: discounted stocks with 55% off InvestingPro',
            'Romania inflation accelerates as domestic prices rise',
            'Bulgaria retail sales rise', 'Albania trade deficit widens',
            'Indian Rupee rises ahead of local GDP figures',
            'Singapore Dollar: Bearish bias capped against US Dollar - UOB',
        ]
        for expected, titles in [(True, positive), (False, negative)]:
            for title in titles:
                with self.subTest(title=title):
                    self.assertEqual(classify(title, include=INCLUDE, enabled=True)['included'], expected)
        from storage.news_flow.importance import decision
        adobe = decision('Why is Adobe stock sliding today?', include=INCLUDE, enabled=True)
        self.assertEqual(adobe['tier'], 'excluded', 'A single-stock explainer without a stated catalyst is routine noise')
        self.assertFalse(classify(positive[0], include=INCLUDE, exclude='Adobe', enabled=True)['included'])
        self.assertFalse(classify(positive[0], include='USD, EUR', enabled=True)['included'], 'Custom narrow watchlists are respected')
        self.assertTrue(classify('Dollar Tree shares rise', include=INCLUDE, enabled=True, filter_policy='{"subject_context":false}')['included'])
        self.assertTrue(classify('Adobe Inc. stock falls Tuesday, underperforms market', include=INCLUDE, enabled=True, filter_policy='{"routine":false}')['included'])

    def test_incremental_preset_upgrade_preserves_user_decisions_and_limits(self):
        additions = PROFILE['preset_additions']
        old = [term for term in PRESET if term not in additions and term != 'gold']
        previous = ', '.join([*old, 'MY CUSTOM WORD'])
        upgraded = migrate_include(previous, 3)
        self.assertIn('Adobe', upgraded)
        self.assertIn('MY CUSTOM WORD', upgraded)
        self.assertNotIn('gold', [term.strip() for term in upgraded.split(',')])
        self.assertEqual(migrate_include(upgraded, 4), upgraded)
        self.assertEqual(migrate_include('oil, MY CUSTOM WORD', 3), 'oil, MY CUSTOM WORD')
        self.assertEqual(migrate_include('', 3), '')
        full = ', '.join([*old, *('custom'+str(i) for i in range(500-len(old)))])
        self.assertEqual(migrate_include(full, 3), full, 'A full custom list is preserved without truncation')
        self.assertEqual(len(PRESET), len(set(PRESET)))
        self.assertLessEqual(len(PRESET), 500)
        legacy = json.dumps({'other_market_terms': PROFILE['filter_previous_other_market_terms'], 'routine': False, 'exceptions': 'MY EXCEPTION'})
        policy = parse_policy(migrate_policy(legacy, 3))
        self.assertEqual(policy.other_market_terms, DEFAULTS['other_market_terms'])
        self.assertFalse(policy.routine)
        self.assertEqual(policy.exceptions, 'MY EXCEPTION')
        custom = '{"other_market_terms":"MY COUNTRY"}'
        self.assertEqual(parse_policy(migrate_policy(custom, 3)).other_market_terms, 'MY COUNTRY')
        with TemporaryDirectory() as root:
            store = NewsStore(root)
            store.sources()
            notifier = NewsNotifier(store, lambda setup, payload: self.fail('Migration must not send a notification'))
            notifier.root.mkdir(parents=True, exist_ok=True)
            saved = {'include': previous, 'exclude': 'PERSONAL EXCLUDE', 'hidden': ['one'], 'mode': 'all',
                     'market_relevance': False, 'preset_version': 3, 'max_age_seconds': 3600, 'unified_alerts': True,
                     'filter_policy': legacy}
            notifier.root.joinpath('notifications.json').write_text(json.dumps(saved), encoding='utf-8')
            result = notifier.settings()
            for key in ['exclude', 'hidden', 'mode', 'market_relevance', 'max_age_seconds', 'unified_alerts']:
                self.assertEqual(result[key], saved[key], key)
            self.assertEqual(result['preset_version'], 4)
            self.assertEqual(result['include'], upgraded)
            self.assertEqual(json.loads(notifier.root.joinpath('notifications.before-relevance-v4.json').read_text(encoding='utf-8')), saved)
            self.assertEqual(notifier.settings(), result, 'The upgrade is idempotent')

    def test_official_cash_rate_and_economic_shorthand(self):
        from storage.news_flow.importance import decision
        for title in ['OCR held at 2.75%', 'OCR increased by 25 basis points to 2.75%', 'OCR on hold at 2.25%']:
            with self.subTest(title=title):
                result = decision(title, feed_url='https://www.rbnz.govt.nz/rss', include=INCLUDE, enabled=True)
                self.assertEqual(result['tier'], 'priority' if 'increased' in title else 'included', result)
                self.assertFalse(decision(title, feed_url='https://www.rbnz.govt.nz/rss', include=INCLUDE, exclude='OCR', enabled=True)['included'])
        self.assertFalse(classify('New OCR software reads banknotes', include=INCLUDE, enabled=True)['included'])
        for title in ['Energy supply and demand, 2025', 'Monthly credit aggregates, August 2026', 'New motor vehicle sales, September 2026']:
            self.assertTrue(classify(title, feed_url='https://www.statcan.gc.ca/rss', enabled=True)['included'], title)
            self.assertFalse(classify(title, feed_url='https://untrusted.example/rss', enabled=True)['included'], title)

    def test_new_watchlist_shared_reader_export_and_alert_selection(self):
        with TemporaryDirectory() as root:
            store = NewsStore(root); source = store.sources()[0]; now = int(time.time() * 1000)
            store.success(source, [], '', '', now)
            cursor = store.arrivals()['cursor']
            titles = ['ADBE shares slide after guidance cut', 'Salesforce falls 10% on sector jitters',
                      'US factory output rises', 'Dollar Tree shares rise on earnings',
                      'UnknownCo shares rally', 'ServiceNow shares slide after funding shortfall']
            for i, title in enumerate(titles):
                store.success(source, [dict(identity=str(i), title=title, summary='', publisher='Test',
                                            url=f'https://example.com/nov18/{i}', published_at=now if i != 5 else now - 6*86400000)], '', '', now+1)
            scope = dict(include=INCLUDE, exclude='', market_relevance=True)
            expected = set(titles[:3] + [titles[5]])
            tiers = ('included', 'priority')
            self.assertEqual(sum(store.query(mode=mode, limit=1, **scope)['total'] for mode in tiers), 4)
            self.assertEqual({r['title'] for mode in tiers for r in store.query(mode=mode, **scope)['items']}, expected)
            exports = [store.export_headlines(mode=mode, **scope) for mode in tiers]
            self.assertEqual(sum(exported['count'] for exported in exports), 4)
            for title in expected:
                self.assertTrue(any(title in exported['text'] for exported in exports))
            arrival = store.arrivals(cursor, max_age_seconds=3600, **scope)
            self.assertEqual({r['title'] for r in arrival['items']}, set(titles[:3]), 'Old relevant articles remain research-only under the age limit')
            sent = []; notifier = NewsNotifier(store, lambda setup, message: sent.append(message))
            notifier.configure({**scope, 'hidden': [], 'preset_version': 4, 'max_age_seconds': 3600}, 'included')
            notifier.root.joinpath('setup.json').write_text(json.dumps({'topic': 'test'}), encoding='utf-8')
            notifier.cursor = cursor
            notifier.tick()
            self.assertEqual(notifier.last_sent['count'], 3)
            self.assertEqual(len(sent), 1)
            notifier.configure({'exclude': 'Adobe'})
            notifier.tick()
            self.assertEqual(len(sent), 1, 'Rule edits never replay consumed headlines')

    def test_archive_audit_recall_and_noise_regressions(self):
        cases = json.loads(Path(__file__).with_name('relevance_audit_cases.json').read_text(encoding='utf-8'))
        for case in cases:
            with self.subTest(title=case['title']):
                result = classify(case['title'], url=case['url'], feed_url=case['feed_url'], include=INCLUDE, enabled=True)
                self.assertEqual(result['included'], case['included'], result)

    def test_subject_context_does_not_hide_actual_company_or_cross_market_news(self):
        relevant = [
            'Amazon shares slump as Black Friday sales disappoint',
            'Apple cuts revenue forecast after Watch sales miss estimates',
            'Microsoft faces new fraud allegations after shares tumble',
            'Nvidia CEO resigns amid misconduct allegations',
            'Wells Fargo raises S&P 500 target on easing inflation',
            'UBS warns of liquidity crisis and depositor withdrawals',
            'JPMorgan stock falls after regulators reveal capital shortfall',
            'Nasdaq falls after small-company earnings disappoint',
            'Gold rises as USD weakens',
            'EUR/USD slides below 1.10',
            'AI retreat fuels India stock comeback in global rotation',
            'Serbian bank run sparks global contagion fears',
            'FDA rejects Novo Nordisk drug after safety concerns',
            'Apache North Sea workers strike, production halted',
            'The market is seeing a reset, not a bubble (QQQ:NASDAQ)',
            'Iran warns US bases are targets and vows response',
            'Trump administration targets further limits on skilled foreign workers',
            'Fed governor to present at upcoming investor conference',
            'Dell and HPE Stocks Are Getting Hammered. Why the Selloff May Be Overdone.',
            'Nebius Stock Plummets After Earnings as CEO Warns of Revenue Delay',
            'GlobalFoundries announces groundbreaking for first Malta fab under US-Japan initiative',
            'Constellation Energy jumps 10% after earnings beat, guidance hike',
        ]
        noise = [
            'Amazon buys James Bond rights in a billion-dollar acquisition',
            'UBS raises Nvidia stock price target after earnings beat',
            'Nvidia gets two more price target cuts from analysts ahead of earnings',
            'TinyCo jumps after earnings beat (TINY:NASDAQ)',
            'TinyCo jumps after earnings beat (TINY:NYSE)',
            'TinyCo stock reaches 14.25 USD',
            'TinyCo shares hit 18.50 EUR',
            'CPI Card Group announces new product',
            'Dianthus at UBS biopharma conference: pipeline update',
            'China firm targets higher revenue after product launch',
            'Serbian central bank raises key interest rate to 6%',
            'Job openings at Swiss Federal Statistical Office',
            'India small business increases spending on AI projects',
            'US FDA rejects Summit\'s China-originated lung cancer drug',
            'GlobalFoundries promotes a chip-themed colouring contest',
        ]
        for expected, titles in [(True, relevant), (False, noise)]:
            for title in titles:
                with self.subTest(title=title):
                    result = classify(title, include=INCLUDE, enabled=True)
                    self.assertEqual(result['included'], expected, result)
        self.assertTrue(classify('TinyCo jumps after earnings beat (TINY:NASDAQ)', include='NASDAQ', enabled=False)['included'])
        self.assertTrue(classify('TinyCo stock reaches 14.25 USD', include='USD', enabled=False)['included'])
        self.assertFalse(classify('UBS warns of liquidity crisis and depositor withdrawals', include=INCLUDE, exclude='UBS', enabled=True)['included'])
        self.assertFalse(classify('Swiss GDP grows - Investing.com South Africa', include=INCLUDE, exclude='South Africa', enabled=True)['included'])

    def test_verified_official_macro_wording_without_literal_hits(self):
        cases = [
            ('Consumer prices increased by 0.2% in October', 'https://bfs.admin.ch/news/release', ''),
            ('Household spending rises 0.6%', '', 'https://news.google.com/rss/search?q=site:abs.gov.au'),
            ('Total dwelling approvals rise 5.1%', '', 'https://news.google.com/rss/search?q=site:abs.gov.au'),
            ('Index of Services, UK: September', 'https://www.ons.gov.uk/releases/services', ''),
            ('Canada international investment position', 'https://statcan.gc.ca/daily/report', ''),
            ('Foreign Exchange Intervention Operations', '', 'https://news.google.com/rss/search?q=site:mof.go.jp/english'),
            ('Report on Foreign Holdings of US Securities', 'https://home.treasury.gov/news/report', ''),
            ('Operation Targets Iran\'s Shadow Fleet Networks', 'https://home.treasury.gov/news/release', ''),
            ('Operation Disrupts Iranian Shadow Banking Networks', 'https://home.treasury.gov/news/release', ''),
            ('Governor to present at upcoming investor conference', 'https://www.federalreserve.gov/newsevents/speech/test.htm', ''),
        ]
        for title, url, feed in cases:
            with self.subTest(title=title):
                self.assertTrue(classify(title, url=url, feed_url=feed, enabled=True)['included'])
                self.assertFalse(classify(title, url=url, feed_url=feed, exclude=title, enabled=True)['included'])
                self.assertFalse(classify(title, url='https://example.com/report', feed_url='https://example.com/rss', enabled=True)['included'])
        self.assertFalse(classify('Household spending rises', feed_url='https://news.google.com/rss/search?q=site:abs.gov.au+OR+site:example.com', enabled=True)['included'])
        self.assertFalse(classify('New Guidance Unlocks Economic Opportunity for Communities', url='https://home.treasury.gov/news/release', enabled=True)['included'])

    def test_audited_cases_agree_across_reader_export_arrivals_and_notifier(self):
        cases = json.loads(Path(__file__).with_name('relevance_audit_cases.json').read_text(encoding='utf-8'))
        with TemporaryDirectory() as root:
            store = NewsStore(root); now = int(time.time() * 1000)
            sources = {s['url']: s for s in store.sources()}
            feeds = {case['feed_url'] for case in cases}
            for feed in feeds:
                if feed not in sources:
                    identity = store.save_source('Audit fixture', feed)
                    sources[feed] = next(s for s in store.sources() if s['id'] == identity)
                store.success(sources[feed], [], '', '', now)
            cursor = store.arrivals(mode='all')['cursor']
            expected = set()
            for index, case in enumerate(cases):
                # Keep the original host where official-article verification matters.
                url = case['url'].split('?')[0] + '/audit-' + str(index)
                item = dict(identity=str(index), title=case['title'], url=url,
                            publisher='Audit fixture', summary='', published_at=now)
                store.success(sources[case['feed_url']], [item], '', '', now+1)
                if case['included']:
                    expected.add(url)
            page = store.query(include=INCLUDE, market_relevance=True, limit=200)
            self.assertEqual({i['url'] for i in page['items'] if i['relevance']['included']}, expected)
            copies = [store.export_headlines(include=INCLUDE, mode=mode, market_relevance=True) for mode in ('priority', 'included')]
            export = {'count': sum(copy['count'] for copy in copies), 'text': '\n\n'.join(copy['text'] for copy in copies)}
            self.assertEqual(export['count'], len(expected))
            self.assertEqual({line for line in export['text'].splitlines() if line.startswith('https://')}, expected)
            arrivals = store.arrivals(cursor, INCLUDE, market_relevance=True, max_age_seconds=86400)
            self.assertEqual({i['url'] for i in arrivals['items']}, expected)
            sent = []
            notifier = NewsNotifier(store, lambda setup, body: sent.append(body))
            notifier.configure(dict(include=INCLUDE, exclude='', hidden=[], market_relevance=True, preset_version=3), 'included')
            notifier.root.joinpath('setup.json').write_text(json.dumps({'topic':'test'}), encoding='utf-8')
            notifier.cursor = cursor
            notifier.tick()
            self.assertEqual(notifier.last_sent['count'], len(expected))
            self.assertEqual(len(sent), 1)
            notifier.tick()
            self.assertEqual(len(sent), 1, 'Reclassification cannot replay already consumed arrivals')

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

    def test_official_speech_paths_and_central_bank_statistics_are_protected(self):
        cases = [
            ('Philip R. Lane: AI adoption in Europe','https://www.ecb.europa.eu//press/key/date/2026/html/speech.html','https://www.ecb.europa.eu/rss/press.html'),
            ('Integrated, open and resilient','https://www.ecb.europa.eu/press/key/date/2026/speech.html','https://www.ecb.europa.eu/rss/press.html'),
            ('Money Stock (Oct.)','https://www.boj.or.jp/en/statistics/money/ms/release.pdf','https://www.boj.or.jp/en/rss/whatsnew.xml'),
            ('Corporate Goods Price Index (Oct.)','https://www.boj.or.jp/en/statistics/pi/release.pdf','https://www.boj.or.jp/en/rss/whatsnew.xml'),
        ]
        for title,url,feed in cases:
            with self.subTest(title=title):
                self.assertTrue(classify(title,'custom',url,feed,'','',True)['included'])
                self.assertFalse(classify(title,'custom',url,feed,'',title,True)['included'])
                self.assertFalse(classify(title,'custom',url.replace('ecb.europa.eu','example.com').replace('boj.or.jp','example.com'),'https://example.com/feed','','',True)['included'])

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
            important = store.query(include=INCLUDE, mode='priority', market_relevance=True)
            rejected = store.query(include=INCLUDE, mode='excluded', market_relevance=True)
            self.assertEqual(relevant['total'] + important['total'], 12); self.assertEqual(rejected['total'], 12)
            expected = {item['url'] for page in (relevant, important) for item in page['items']}
            arrivals = store.arrivals(baseline, INCLUDE, now=now+2, market_relevance=True)
            self.assertEqual({item['url'] for item in arrivals['items']}, expected)
            copied = store.export_headlines(include=INCLUDE, mode='included', market_relevance=True)
            priority_copy = store.export_headlines(include=INCLUDE, mode='priority', market_relevance=True)
            self.assertEqual(copied['count'] + priority_copy['count'], 12)
            self.assertEqual({url for text in (copied['text'], priority_copy['text']) for url in text.splitlines() if url.startswith('https://')}, expected)
            page = store.query(include=INCLUDE, market_relevance=True)['items']
            self.assertTrue(all(item['relevance']['included'] == (item['url'] in expected) for item in page))
            notifier.tick()
            self.assertEqual(notifier.last_sent['count'], len(expected))
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
