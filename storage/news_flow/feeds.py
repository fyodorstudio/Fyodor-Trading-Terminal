"""Small RSS/Atom reader. Feed markup is converted to text, never executed."""
from datetime import datetime
from email.utils import parsedate_to_datetime
from hashlib import sha256
from html.parser import HTMLParser
import re
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

MAX_FEED_BYTES = 4 * 1024 * 1024


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


def parse_feed(body):
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
    for entry in entries[:2000]:
        title = text(entry.findtext('title'), 2000)
        links = entry.findall('link')
        link = next((node.get('href') or node.text or '' for node in links if node.get('rel', 'alternate') == 'alternate'), '').strip()
        try:
            http_url(link)
        except ValueError:
            continue
        if not title:
            continue
        guid = entry.findtext('guid') or entry.findtext('id') or link
        items.append({'identity': sha256(guid.encode()).hexdigest(), 'title': title, 'url': link,
                      'summary': text(entry.findtext('description') or entry.findtext('summary') or entry.findtext('content'), 8000),
                      'publisher': text(entry.findtext('source'), 200),
                      'published_at': timestamp(entry.findtext('pubDate') or entry.findtext('published') or entry.findtext('date') or entry.findtext('updated'))})
    return items


def fetch_feed(source):
    headers = {'User-Agent': 'Fyodor-News-Flow/1.0', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'}
    if source['etag']:
        headers['If-None-Match'] = source['etag']
    if source['modified']:
        headers['If-Modified-Since'] = source['modified']
    try:
        with urlopen(Request(http_url(source['url']), headers=headers), timeout=10) as response:
            http_url(response.url)
            body = response.read(MAX_FEED_BYTES + 1)
            return parse_feed(body), response.headers.get('ETag', ''), response.headers.get('Last-Modified', '')
    except HTTPError as error:
        if error.code == 304:
            error.close()
            return None, source['etag'], source['modified']
        error.close()
        raise
