"""Small plain-text ntfy cards; destinations live in actions, never the body."""
from datetime import datetime, timezone, timedelta

JAKARTA = timezone(timedelta(hours=7), 'WIB')


def bounded(text, budget):
    return text if len(text.encode('utf-8')) <= budget else text.encode('utf-8')[:budget - 3].decode('utf-8', errors='ignore') + '…'


def stamp(at):
    local = datetime.fromtimestamp(at / 1000, timezone.utc).astimezone(JAKARTA)
    period = 'AM' if local.hour < 12 else 'PM'
    return f'{local:%b %d}, {local.hour % 12 or 12}:{local:%M} {period} WIB'


def provider(item):
    return bounded(' '.join((item['publisher'] or item['source_name']).split()), 100)


def label(item):
    tier = item.get('relevance', {}).get('tier', 'included')
    return {'priority': 'Priority', 'included': 'Included', 'excluded': 'Excluded · All headlines mode'}[tier]


def publication(item):
    published = item['published_at']
    valid = published is not None and published - item['first_seen'] < 60000
    return f'Published {stamp(published)}' if valid else 'Publication time unavailable'


def metadata(item):
    return (f'{provider(item)} · {label(item)}\n' + publication(item) +
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
    collected = sorted(item.get('received_at', item['first_seen']) for item in items)
    first, last = stamp(collected[0]), stamp(collected[-1])
    parts = ['Collected ' + (first if first == last else f'{first} – {last}')]
    groups = {}
    for index, item in enumerate(items[:8], 1):
        groups.setdefault(provider(item), []).append((index, item))
    for name, entries in groups.items():
        labels = {label(item) for _, item in entries}
        shared = next(iter(labels)) if len(labels) == 1 else ''
        lines = [name + (f' · {shared}' if shared else '')]
        for index, item in entries:
            detail = publication(item)
            if not shared:
                detail = label(item) + ' · ' + detail
            lines.append(f"{index}. {bounded(item['title'], 250)}\n{detail}")
        parts.append('\n\n'.join(lines))
    message = '\n\n'.join(parts)
    if len(items) > 8:
        message += f'\n\n+{len(items) - 8} more in News Flow.'
    return {'topic': topic, 'title': f'News Flow · {len(items)} new headlines',
            'message': bounded(message, 3800), 'actions': actions,
            'click': reader or items[0]['url'], 'priority': 4}
