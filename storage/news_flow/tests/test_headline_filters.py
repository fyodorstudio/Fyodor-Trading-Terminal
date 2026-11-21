import json
from tempfile import TemporaryDirectory
import time
import unittest

from storage.news_flow.importance import decision
from storage.news_flow.notifications import NewsNotifier
from storage.news_flow.relevance import PRESET
from storage.news_flow.store import NewsStore

INCLUDE = ', '.join(PRESET)

# Reviewed examples from the supplied export, with boundary cases for each rule.
CATALYSTS = [
    "Japan's Katayama warns of one-sided yen moves near 160, will coordinate with US Treasury",
    'Japan Fires Off Verbal Warning on Yen as Weakness Stokes Intervention Alert',
    'Japan ready to take decisive action against excessive currency moves',
    'SNB warns of currency intervention to curb franc strength',
    'Japan conducts rate checks as yen slides',
    'Hawkish BOJ policymaker Takata calls for swift hike in rates',
    'BOJ Leading Hawk Calls for Nimble Approach to Raising Key Rate',
    'BOJ Ueda expects to keep raising rates, warning inflation could overshoot 2% target',
    'FOMC Minutes: A couple of participants noted a hike of more than 25 bps could warrant consideration in December',
    'Fed officials expect more rate hikes, worry about AI impact on inflation, minutes show',
    'Fed Waller: Fed should hike 50 bps now or signal faster rate increases',
    'Australia unemployment rate rises to 4.9% in October, vs. 4.7% expected',
    'Canada October CPI 3.1% vs +3.2% expected',
    'US payrolls -10K vs +100K expected',
    'UK CPI misses expectations',
    'US retail sales unexpectedly fall',
]
KEEP = [
    'Japanese Yen gains on intervention warnings',
    'Japanese Yen finds support as intervention risks linger near 160.00',
    'Oil shipped through Hormuz falls as Iranian strikes increase',
    'Oil pipeline sales increase as refinery investment expands',
    'OPEC announces production cuts',
    'Russia fuel crisis deepens as drones hit refineries',
    'Taiwan blockade threatens chip supply',
    'China widens tariff relief for Canadian pork and seafood but keeps autos off the table',
    'US tightens Iran blockade with curbs on oil transfers at sea',
    'Nvidia scandal fuels push to block AI chip exports to China',
    'Nvidia faces new export controls as US restricts China chip sales',
    'Nvidia CEO resigns amid misconduct allegations',
    'Apple cuts revenue guidance',
    'Salesforce issues earnings warning',
    'Societe Generale cuts jobs as bank earnings collapse',
    'UBS warns of funding stress',
    'JPMorgan stock falls after regulators reveal capital shortfall',
    'AI debt boom shows underwriting deteriorating',
    'Nasdaq plunges 5% as tech rout spreads',
    'Investors Dumping AI Stocks to Buy Into Anthropic Send Tech Shares Lower',
    'U.S. stocks mostly lower after Nvidia earnings fail to soothe nerves',
    'Forex Today: Japan confirms currency intervention to support yen',
    'USD/JPY Price Forecast: Japan warns of intervention over excessive yen moves',
    'Nvidia price target cut as global stocks plunge on funding crisis',
    'Nvidia earnings preview as Taiwan blockade threatens chip supply',
    'Stock Market News: Nasdaq plunges 5% as AI trade unravels',
    'Trump Calls Venezuela an Acquisition, Hails US Energy Supply',
    'Trump DOJ Willing to Clear More Merger Deals Without Asset Sales',
    'Japanese Yen gathers strength amid intervention risk, traders await US Retail Sales data',
    'GBP/USD falls after UK wage growth slows',
    'Gold slides after UK CPI misses expectations, traders await Fed minutes',
    'Nasdaq 100 Has Worst Week Since 2020 on AI Drama: Markets Wrap',
    'TSX futures edge lower ahead of Nvidia earnings',
    "Nvidia has lost $2 trillion in value. Here's what options traders expect from earnings",
]
KEEP += [
    'Silver Price Forecast: XAG/USD holds losses amid hawkish Fed tone',
    'Japanese Yen: BoJ tightening plans support against US Dollar – MUFG - FXStreet',
    'US Dollar: Fed tightening supports gains – UBS',
    'Australian Dollar hits ten-month low before RBA minutes and jobs data',
]
NOISE = [
    'USD/JPY Price Forecast: Fresh upside likely above 160.40',
    'EUR/USD technical analysis: RSI nears oversold territory',
    'Nasdaq tests the 50% retracement ahead of earnings',
    'Euro: Downside risk toward 1.1000 against US Dollar – UOB',
    'Forex Today: Gold extends slide despite US Dollar pullback',
    'investingLive European news wrap: Markets remain cautious',
    'EUR/USD Weekly Forecast: The bears are winning',
    'FX option expiries for 18 November',
    'Gold price today: Gold falls, according to FXStreet data',
    'Nvidia earnings preview',
    'Nvidia can rebound to $200, analyst says',
    'UBS raises Nvidia stock price target after earnings beat',
    'Nvidia gets two more price target cuts from analysts ahead of earnings',
    'Anthropic gets a buy rating ahead of IPO',
    'CSCO earnings beat estimates',
    'Palo Alto Networks reports quarterly profit growth',
    'Google unveils new AI chip variants as cloud demand surges',
    'CrowdStrike in talks to acquire Zscaler, sources say',
    'Amazon buys James Bond rights in a billion-dollar acquisition',
    'Nvidia CEO faces affair allegations',
    'Trump says Huang should return to Nvidia after big apology',
    'Why is Adobe stock sliding today?',
    'Wonder explores sale of Grubhub, Wall Street Journal reports - Reuters',
    'China Military Bans SF Express From Procurement Over Misconduct',
    'Gold holds steady near $3,850 ahead of FOMC Minutes',
    'Nvidia explores sale of subsidiary, Wall Street Journal reports',
]


class HeadlineFilterTests(unittest.TestCase):
    def classify(self, title, **overrides):
        return decision(title, **{'include': INCLUDE, 'enabled': True, **overrides})

    def test_unscheduled_catalysts_and_numerical_surprises_receive_priority(self):
        for title in CATALYSTS:
            with self.subTest(title=title):
                self.assertEqual(self.classify(title)['tier'], 'priority')

    def test_macro_channels_and_material_company_changes_stay_visible(self):
        for title in KEEP:
            with self.subTest(title=title):
                self.assertTrue(self.classify(title)['included'], self.classify(title))

    def test_routine_formats_and_incidental_keywords_do_not_notify(self):
        for title in NOISE:
            with self.subTest(title=title):
                result = self.classify(title)
                self.assertEqual(result['tier'], 'excluded', result)
                self.assertTrue(result['reason'])

    def test_no_surprise_or_unsupported_comparison_does_not_become_priority(self):
        titles = [
            'UK Inflation Print at Fastest in a Year Comes With Few Surprises',
            'UK CPI brings no surprise', 'UK CPI fails to surprise',
            'UK CPI does not surprise markets', 'US payrolls rise, not unexpectedly',
            'UK CPI does not beat estimates', 'US payrolls not above expectations',
            'Australia unemployment rate 4.9% vs 4.9% expected',
            'Australia unemployment 4.9% vs 4.7% previous',
            'US payrolls 1 million vs 100 thousand expected',
            'Australia unemployment expected to rise to 4.9% vs 4.7% expected',
            'Could Japan warn of currency intervention?',
            'Guinea miners stockpile gold after refinery rules halted exports',
        ]
        for title in titles:
            with self.subTest(title=title):
                self.assertNotEqual(self.classify(title)['tier'], 'priority')

    def test_controls_official_protections_stars_and_narrow_watchlists(self):
        for title in CATALYSTS + KEEP:
            self.assertFalse(self.classify(title, exclude=title, pinned=True)['included'])
        for title in NOISE:
            # Literal mode and the existing routine switch remain user overrides.
            self.assertTrue(self.classify(title, include=title, enabled=False)['included'])
        for title in [NOISE[0], 'Nvidia earnings preview', 'investingLive European news wrap: Markets remain cautious']:
            self.assertTrue(self.classify(title, include=INCLUDE + ', news wrap', filter_policy='{"routine":false}')['included'], title)
        self.assertFalse(self.classify(CATALYSTS[0], include='EUR, GBP')['included'])
        self.assertTrue(self.classify(NOISE[0], pinned=True)['included'])
        official = self.classify('Weekly economic outlook', include='', feed_url='https://www.boj.or.jp/en/rss/whatsnew.xml')
        self.assertTrue(official['included'])
        self.assertFalse(self.classify(NOISE[0], feed_url='https://www.fxstreet.com/rss')['included'])

    def test_reader_copy_desktop_arrivals_and_phone_share_filtered_selection(self):
        with TemporaryDirectory() as root:
            store = NewsStore(root)
            source = store.sources()[0]
            now = int(time.time() * 1000)
            store.success(source, [], '', '', now)
            cursor = store.arrivals()['cursor']
            titles = CATALYSTS + KEEP + NOISE
            entries = [dict(identity=str(i), title=title, summary='', publisher='Reuters',
                            url=f'https://example.com/filter/{i}', published_at=now)
                       for i, title in enumerate(titles)]
            store.success(source, entries, '', '', now + 1)
            scope = dict(include=INCLUDE, market_relevance=True)
            expected = set(CATALYSTS + KEEP)
            tiers = [store.query(mode=mode, **scope) for mode in ('priority', 'included')]
            self.assertFalse({r['title'] for r in tiers[0]['items']} & {r['title'] for r in tiers[1]['items']})
            self.assertEqual({r['title'] for tier in tiers for r in tier['items']}, expected)
            self.assertEqual(sum(store.export_headlines(mode=mode, **scope)['count'] for mode in ('priority', 'included')), len(expected))
            self.assertEqual({r['title'] for r in store.arrivals(cursor, now=now+2, **scope)['items']}, expected)
            self.assertEqual(store.query(mode='all', **scope)['total'], len(titles))
            sent = []
            notifier = NewsNotifier(store, lambda setup, body: sent.append(body))
            notifier.configure(dict(include=INCLUDE, exclude='', hidden=[], market_relevance=True,
                                    preset_version=4, filter_policy='{}', max_age_seconds=3600), 'included')
            notifier.root.joinpath('setup.json').write_text(json.dumps({'topic': 'test'}), encoding='utf-8')
            notifier.cursor = cursor
            notifier.tick()
            self.assertEqual(notifier.last_sent['count'], len(expected))
            notifier.configure({'filter_policy': '{"routine":false}'})
            notifier.tick()
            self.assertEqual(len(sent), 1, 'Changed rules must not replay old arrivals')
