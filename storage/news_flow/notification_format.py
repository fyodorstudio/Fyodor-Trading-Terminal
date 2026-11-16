"""Small plain-text ntfy cards; destinations live in actions, never the body."""
from datetime import datetime, timezone


def bounded(text, budget):
    return text if len(text.encode('utf-8')) <= budget else text.encode('utf-8')[:budget - 3].decode('utf-8', errors='ignore') + '…'


def stamp(at):
    return datetime.fromtimestamp(at / 1000, timezone.utc).strftime('%b %d, %H:%M UTC')


def metadata(item):
    tier = item.get('relevance', {}).get('tier', 'included')
    label = {'priority': 'Priority', 'included': 'Included', 'excluded': 'Excluded · All headlines mode'}[tier]
    published = item['published_at']
    valid = published is not None and published - item['first_seen'] < 60000
    return (f"{bounded(item['publisher'] or item['source_name'], 100)} · {label}\n" +
            (f'Published {stamp(published)}' if valid else 'Publication time unavailable') +
            f" · Collected {stamp(item.get('received_at', item['first_seen']))}")


def payload(items, topic, reader=''):
    # Reader comes from the existing LAN runtime address, without embedded login.
    actions = [{'action': 'view', 'label': 'Open News Flow', 'url': reader}] if reader else []
    if len(items) == 1:
        item = items[0]
        actions.insert(0, {'action': 'view', 'label': 'Open article', 'url': item['url']})
        return {'topic': topic, 'title': bounded(item['title'], 1000), 'message': metadata(item),
                'click': item['url'], 'actions': actions, 'priority': 4}
    # One sound per arrival batch, with every preview once and bounded UTF-8.
    previews = [f"{index + 1}. {bounded(item['title'], 250)}\n{metadata(item)}" for index, item in enumerate(items[:8])]
    message = '\n\n'.join(previews)
    if len(items) > 8:
        message += f'\n\n+{len(items) - 8} more in News Flow.'
    return {'topic': topic, 'title': f'News Flow · {len(items)} new headlines',
            'message': bounded(message, 3800), 'actions': actions,
            'click': reader or items[0]['url'], 'priority': 4}
