"""Free starter feeds and their best-effort historical search scopes."""
from urllib.parse import urlencode

TREASURY_URL = 'https://home.treasury.gov/news/press-releases'
DEFAULT_URL = 'https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US'
# The final field scopes optional Google historical searches; live reads use RSS.
PROVIDERS = (
    ('reuters', 'Reuters', DEFAULT_URL, ''),
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
)


def historical_feed_url(url):
    query = next((scope for _, _, feed, scope in PROVIDERS if feed == url), '')
    return 'https://news.google.com/rss/search?' + urlencode({'q': query, 'ceid': 'US:en', 'hl': 'en-US', 'gl': 'US'}) if query else url
