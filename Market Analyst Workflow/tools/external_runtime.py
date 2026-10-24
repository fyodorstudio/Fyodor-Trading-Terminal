"""Read-only compatibility probe before CLI writes shared External Source files."""
from datetime import datetime, timezone
import errno
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import urlopen


def alarm_reader(directory, opener):
    """A stopped worker is safe; an active old reader must not see new records."""
    port = int(os.environ.get('FYODOR_ALARM_PORT', '8003'))
    if not 1 <= port <= 65535:
        raise ValueError('Invalid local alarm port')
    try:
        with opener(f'http://127.0.0.1:{port}/alarms', timeout=3) as response:
            payload = json.load(response)
    except URLError as error:
        reason = error.reason
        if isinstance(reason, ConnectionRefusedError) or getattr(reason, 'errno', None) in (errno.ECONNREFUSED, 10061):
            return 'stopped'
        raise ValueError('Cannot verify alarm worker compatibility; no write was attempted') from error
    if (not isinstance(payload, dict) or payload.get('application') != 'fyodor-alarms'
            or payload.get('external_source_schema') != 3
            or not isinstance(payload.get('external_source_directory'), str)
            or Path(payload['external_source_directory']).resolve() != Path(directory).resolve()):
        raise ValueError('Running alarm worker lacks the required External Source schema/directory; restart the updated alarm worker before writing')
    return 'compatible'


def preflight(directory, base='http://127.0.0.1:8002', opener=None):
    opener = opener or urlopen
    url = urlsplit(base)
    if url.scheme != 'http' or url.hostname not in ('127.0.0.1', 'localhost', '::1') or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise ValueError('External Source runtime must be a loopback storage URL')
    result = dict(checked_utc=datetime.now(timezone.utc).isoformat(), storage=base,
                  can_write=False, chart_requests=False, status='blocked')
    try:
        result['alarm_reader'] = alarm_reader(directory, opener)
    except (OSError, ValueError) as error:
        return {**result, 'note': str(error)}
    try:
        with opener(base.rstrip('/') + '/api/v1/external-capabilities', timeout=3) as response:
            payload = json.load(response)
    except HTTPError as error:
        return {**result, 'note': f'Running storage returned HTTP {error.code}; load the updated backend before external writes. No restart was performed.'}
    except URLError as error:
        reason = error.reason
        if isinstance(reason, ConnectionRefusedError) or getattr(reason, 'errno', None) in (errno.ECONNREFUSED, 10061):
            return {**result, 'status': 'offline', 'can_write': True,
                    'note': 'Storage is stopped at this endpoint. Local writes are supported; live chart delivery is unverified. Start the updated backend before use.'}
        return {**result, 'note': f'Cannot verify storage compatibility: {reason}. No write was attempted.'}
    except (OSError, ValueError) as error:
        return {**result, 'note': f'Cannot verify storage compatibility: {error}. No write was attempted.'}
    if not isinstance(payload, dict) or payload.get('external_source_schema') != 3 or payload.get('chart_icon_requests') is not True or payload.get('commodity_scopes') is not True:
        return {**result, 'note': 'Storage does not advertise the required External Source schema/chart capability; load the updated backend before writing.'}
    if not isinstance(payload.get('directory'), str) or Path(payload['directory']).resolve() != Path(directory).resolve():
        return {**result, 'note': 'Storage uses a different External Source directory; select the matching runtime before writing.'}
    return {**result, 'status': 'compatible', 'can_write': True, 'chart_requests': True,
            'note': 'Running storage advertises the required schema and the same External Source directory. Read back each write before claiming delivery.'}


def require_writable(directory, base='http://127.0.0.1:8002'):
    result = preflight(directory, base)
    if not result['can_write']:
        raise ValueError('External Source write blocked before mutation: ' + result['note'])
    return result
