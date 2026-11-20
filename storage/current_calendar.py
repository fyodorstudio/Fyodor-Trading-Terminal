"""Current readings shared by the date lists and calendar reminders."""


def occurrence_key(event):
    return (event['event_id'], event['country_code'], event['currency'],
            event['release_at'] if event['release_at'] is not None else event['server_time_seconds'],
            event['time_mode'], event['period_seconds'], event['unit'], event['multiplier'])


def reading_rank(event):
    value_id = event['value_id']
    return (event['revision'], event['actual'] is not None, event.get('observed_at', 0),
            int(value_id) if value_id.isdigit() else -1, value_id)


def current_events(events):
    selected = {}
    for event in events:
        if event['availability'] != 'observed':
            continue
        key = occurrence_key(event)
        previous = selected.get(key)
        if previous is None or reading_rank(event) > reading_rank(previous):
            selected[key] = event
    return list(selected.values())
