"""Free starter feeds and their best-effort historical search scopes."""
from urllib.parse import urlencode

TREASURY_URL = 'https://home.treasury.gov/news/press-releases'
DEFAULT_URL = 'https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US'
PROVIDER_MIGRATION = 'starter-providers-v3'


def google_feed(query, window='7d'):
    return 'https://news.google.com/rss/search?' + urlencode({'q': f'when:{window} {query}', 'ceid': 'US:en', 'hl': 'en-US', 'gl': 'US'})


EUROSTAT_URL = 'https://ec.europa.eu/eurostat/en/search?' + urlencode({
    'p_p_id': 'estatsearchportlet_WAR_estatsearchportlet', 'p_p_lifecycle': '2',
    'p_p_state': 'maximized', 'p_p_mode': 'view', 'p_p_resource_id': 'atom',
    '_estatsearchportlet_WAR_estatsearchportlet_collection': 'CAT_PREREL',
})
# The final field scopes optional Google historical searches for direct feeds.
# Google-delivered sources identify the delivery method in their display names.
PROVIDERS = (
    ('reuters', 'Reuters', DEFAULT_URL, ''),
    ('reuters-previews', 'Reuters · Expectations', 'https://news.google.com/rss/search?' + urlencode({'q': 'when:7d site:reuters.com (Fed OR FOMC OR ECB OR RBA OR BoE OR BoJ OR RBNZ OR SNB OR inflation OR payrolls) ("priced in" OR "odds" OR "preview" OR "expected to" OR "markets price")', 'ceid': 'US:en', 'hl': 'en-US', 'gl': 'US'}), ''),
    ('fxstreet', 'FXStreet', 'https://www.fxstreet.com/rss', 'site:fxstreet.com/news'),
    ('fed-policy', 'Federal Reserve · Policy', 'https://www.federalreserve.gov/feeds/press_monetary.xml', 'site:federalreserve.gov/newsevents/pressreleases monetary'),
    ('fed-speeches', 'Federal Reserve · Speeches', 'https://www.federalreserve.gov/feeds/speeches.xml', 'site:federalreserve.gov/newsevents/speech'),
    ('ecb', 'ECB', 'https://www.ecb.europa.eu/rss/press.html', 'site:ecb.europa.eu/press'),
    ('boe-news', 'Bank of England · News', 'https://www.bankofengland.co.uk/rss/news', 'site:bankofengland.co.uk/news'),
    ('boe-speeches', 'Bank of England · Speeches', 'https://www.bankofengland.co.uk/rss/speeches', 'site:bankofengland.co.uk/speech'),
    ('boc-news', 'Bank of Canada · Releases', 'https://www.bankofcanada.ca/content_type/press-releases/feed/', 'site:bankofcanada.ca "press release"'),
    ('boc-speeches', 'Bank of Canada · Speeches', 'https://www.bankofcanada.ca/content_type/speeches/feed/', 'site:bankofcanada.ca speech'),
    ('rba-news', 'RBA · Releases', 'https://www.rba.gov.au/rss/rss-cb-media-releases.xml', 'site:rba.gov.au/media-releases'),
    ('rba-speeches', 'RBA · Speeches', 'https://www.rba.gov.au/rss/rss-cb-speeches.xml', 'site:rba.gov.au/speeches'),
    ('boj', 'Bank of Japan', 'https://www.boj.or.jp/en/rss/whatsnew.xml', 'site:boj.or.jp/en'),
    ('treasury', 'US Treasury', TREASURY_URL, ''),
    # Targeted searches supplement the broad feed's limited result window.
    ('reuters-fx', 'Reuters · FX (Google News)', google_feed('site:reuters.com (dollar OR euro OR yen OR sterling OR franc OR "Australian dollar" OR "New Zealand dollar" OR "Canadian dollar" OR forex)'), ''),
    ('reuters-oil', 'Reuters · Oil (Google News)', google_feed('site:reuters.com (oil OR crude OR OPEC OR Brent OR WTI OR "natural gas")'), ''),
    ('reuters-equities', 'Reuters · Equities (Google News)', google_feed('site:reuters.com (stocks OR equities OR Nasdaq OR "S&P 500" OR Nvidia OR earnings)'), ''),
    ('reuters-metals', 'Reuters · Metals (Google News)', google_feed('site:reuters.com (gold OR silver OR copper OR platinum OR palladium OR commodities)'), ''),
    ('kitco', 'Kitco · Metals (Google News)', google_feed('site:kitco.com/news (gold OR silver OR copper OR platinum OR palladium)'), ''),
    # Complete central-bank coverage for the terminal's eight currencies.
    ('rbnz', 'Reserve Bank of New Zealand', 'https://www.rbnz.govt.nz/feeds/news', 'site:rbnz.govt.nz (news OR speech OR monetary)'),
    ('snb', 'SNB · Policy & speeches (Google News)', google_feed('site:snb.ch ("monetary policy" OR speech OR speeches OR Schlegel OR "Antoine Martin")', '90d'), ''),
    # Official economic releases; Google scopes are explicit when direct feeds
    # are unavailable or blocked from the local Python collector.
    ('bea', 'BEA · US economic releases', 'https://apps.bea.gov/rss/rss.xml', 'site:bea.gov/news'),
    ('bls', 'BLS · US economic releases (Google News)', google_feed('site:bls.gov/news.release', '30d'), ''),
    ('eurostat', 'Eurostat · News releases', EUROSTAT_URL, 'site:ec.europa.eu/eurostat ("euro indicators" OR inflation OR GDP OR unemployment)'),
    ('ons', 'ONS · UK releases', 'https://www.ons.gov.uk/releasecalendar?rss&highlight=true&limit=50&page=1&release-type=type-published&sort=date-newest', 'site:ons.gov.uk (inflation OR GDP OR labour OR employment OR trade)'),
    ('statcan', 'Statistics Canada · The Daily', 'https://www150.statcan.gc.ca/n1/rss/dai-quo/0-eng.atom', 'site:statcan.gc.ca ("The Daily" OR "consumer price" OR "labour force" OR GDP)'),
    ('abs', 'ABS · Australian releases (Google News)', google_feed('site:abs.gov.au/media-centre/media-releases', '30d'), ''),
    ('stats-nz', 'Stats NZ · Releases (Google News)', google_feed('(site:stats.govt.nz/news OR site:stats.govt.nz/information-releases)', '30d'), ''),
    ('swiss-statistics', 'Swiss statistics · Releases (Google News)', google_feed('(site:statistik.admin.ch/en/news OR site:bfs.admin.ch) (inflation OR "consumer price" OR employment OR GDP OR retail OR trade)', '90d'), ''),
    ('japan-economy', 'Reuters · Japan economy (Google News)', google_feed('site:reuters.com (Japan OR Japanese) (inflation OR CPI OR GDP OR wages OR unemployment OR spending)', '30d'), ''),
    ('japan-mof', 'Japan MOF · Policy (Google News)', google_feed('site:mof.go.jp/english ("foreign exchange" OR intervention OR "Minister of Finance" OR statement)', '90d'), ''),
    # Oil and energy context, including a scoped weekly-inventories search.
    ('eia-releases', 'EIA · Press releases', 'https://www.eia.gov/rss/press_rss.xml', 'site:eia.gov/pressroom/releases'),
    ('eia-analysis', 'EIA · Today in Energy', 'https://www.eia.gov/rss/todayinenergy.xml', 'site:eia.gov/todayinenergy'),
    ('eia-petroleum', 'EIA · Petroleum reports (Google News)', google_feed('site:eia.gov ("Weekly Petroleum Status Report" OR "This Week in Petroleum")', '30d'), ''),
)


def historical_feed_url(url):
    query = next((scope for _, _, feed, scope in PROVIDERS if feed == url), '')
    return 'https://news.google.com/rss/search?' + urlencode({'q': query, 'ceid': 'US:en', 'hl': 'en-US', 'gl': 'US'}) if query else url
