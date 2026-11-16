"""Small RSS/Atom reader. Feed markup is converted to text, never executed."""
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from hashlib import sha256
from html.parser import HTMLParser
import re
import json
from urllib.error import HTTPError
from urllib.parse import urlsplit, urljoin
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET
from .providers import TREASURY_URL

MAX_FEED_BYTES = 4 * 1024 * 1024


class FeedResult(tuple):
    """Preserves the three-value parser contract while exposing HTTP diagnostics."""
    def __new__(cls, items, etag, modified, status=200, headers=None):
        result = super().__new__(cls, (items, etag, modified))
        headers = headers or {}
        try:
            age = max(0, min(604800, int(headers.get('Age', ''))))
        except (TypeError, ValueError):
            age = None
        result.diagnostics = {'http_status': status, 'cache_age': age,
                              'response_at': timestamp(headers.get('Date')),
                              'item_count': len(items) if items is not None else None}
        return result


def http_url(value):
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or any(c.isspace() for c in value):
        raise ValueError('Enter an HTTP or HTTPS URL')
    return value


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def text(value, limit):
    parser = PlainText()
    parser.feed(value or '')
    return ' '.join(' '.join(parser.parts).split())[:limit]


def timestamp(value):
    if not value:
        return None
    try:
        try:
            result = parsedate_to_datetime(value)
        except (ValueError, TypeError):
            result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        # A feed without a zone has no dependable publication timestamp.
        return int(result.timestamp() * 1000) if result.tzinfo is not None else None
    except (ValueError, TypeError, OverflowError, OSError):
        return None


class FeedTreeBuilder(ET.TreeBuilder):
    def doctype(self, name, pubid, system):
        raise ValueError('Feed document types are not supported')


def parse_feed(body, base_url=''):
    if len(body) > MAX_FEED_BYTES or re.search(br'<!\s*(?:DOCTYPE|ENTITY)', body, re.I):
        raise ValueError('Unsupported or oversized feed XML')
    root = ET.fromstring(body, parser=ET.XMLParser(target=FeedTreeBuilder()))
    # Ignore namespace spelling; RSS extensions and Atom use different namespaces.
    for node in root.iter():
        node.tag = node.tag.rsplit('}', 1)[-1]
    if root.tag not in ('rss', 'RDF', 'feed'):
        raise ValueError('The URL did not return an RSS or Atom feed')
    entries = root.findall('.//item') if root.tag != 'feed' else root.findall('entry')
    items = []
    def content(entry, name, limit):
        node = entry.find(name)
        if node is None:
            return ''
        # Atom text constructs can contain XHTML, not just escaped HTML text.
        value = ET.tostring(node, encoding='unicode') if len(node) else node.text
        return text(value, limit)

    for entry in entries[:2000]:
        title = content(entry, 'title', 2000)
        links = entry.findall('link')
        link = next((node.get('href') or node.text or '' for node in links if node.get('rel', 'alternate') == 'alternate'), '').strip()
        # Resolve publisher-relative article URLs only against the fetched feed.
        # Explicit unsafe schemes still fail the same HTTP(S) validation below.
        if link and base_url:
            link = urljoin(base_url, link)
        try:
            http_url(link)
        except ValueError:
            continue
        if not title:
            continue
        guid = entry.findtext('guid') or entry.findtext('id') or link
        items.append({'identity': sha256(guid.encode()).hexdigest(), 'title': title, 'url': link,
                      'summary': content(entry, 'description', 8000) or content(entry, 'summary', 8000) or content(entry, 'content', 8000),
                      'publisher': content(entry, 'source', 200),
                      'published_at': timestamp(entry.findtext('pubDate') or entry.findtext('published') or entry.findtext('date') or entry.findtext('updated'))})
    return items


def treasury_url(url):
    parsed = urlsplit(url)
    return parsed.hostname == 'home.treasury.gov' and parsed.path.rstrip('/') == '/news/press-releases' and not parsed.query


def treasury_data_url(year):
    return f'https://home.treasury.gov/news-data/press-releases/search/{year}.json'


def parse_treasury(body):
    data = json.loads(body)
    if not isinstance(data, dict) or not isinstance(data.get('items'), list):
        raise ValueError('Treasury announcement index format changed')
    items = []
    for row in data['items'][:10000]:
        if not isinstance(row, dict):
            continue
        link = urljoin(TREASURY_URL, str(row.get('url', '')))
        parsed = urlsplit(link)
        title = text(str(row.get('title', '')), 2000)
        if parsed.hostname != 'home.treasury.gov' or not re.fullmatch(r'/news/press-releases/[^/]+/?', parsed.path) or not title:
            continue
        items.append({'identity': sha256(link.rstrip('/').encode()).hexdigest(), 'title': title, 'url': link,
                      'summary': '', 'publisher': 'US Treasury', 'published_at': timestamp(row.get('datetime'))})
    return items


def fetch_feed(source):
    url = source['url']
    if treasury_url(url):
        url = treasury_data_url(datetime.now(timezone.utc).year)
    parsed = urlsplit(url)
    treasury = parsed.hostname == 'home.treasury.gov' and re.fullmatch(r'/news-data/press-releases/search/\d{4}\.json', parsed.path)
    headers = {'User-Agent': 'Fyodor-News-Flow/1.0', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'}
    if source['etag']:
        headers['If-None-Match'] = source['etag']
    if source['modified']:
        headers['If-Modified-Since'] = source['modified']
    try:
        with urlopen(Request(http_url(url), headers=headers), timeout=10) as response:
            http_url(response.url)
            body = response.read(MAX_FEED_BYTES + 1)
            if len(body) > MAX_FEED_BYTES:
                raise ValueError('Oversized provider response')
            return FeedResult(parse_treasury(body) if treasury else parse_feed(body, response.url), response.headers.get('ETag', ''), response.headers.get('Last-Modified', ''), headers=response.headers)
    except HTTPError as error:
        if error.code == 304:
            result = FeedResult(None, source['etag'], source['modified'], 304, error.headers)
            error.close()
            return result
        error.close()
        raise
