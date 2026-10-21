from io import BytesIO
import json
from pathlib import Path
import socket
import sys
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'Market Analyst Workflow/tools'))
from external_runtime import preflight
from test_analyst_tools import analyst


class ExternalRuntimeTests(TestCase):
    def test_compatible_empty_runtime_same_directory_and_old_unreachable_runtime(self):
        directory = Path('isolated-external').resolve()
        payload = dict(external_source_schema=2, chart_icon_requests=True, directory=str(directory))
        opened = lambda *args, **kwargs: BytesIO(json.dumps(payload).encode())
        self.assertEqual(preflight(directory, opener=opened)['status'], 'compatible')
        payload['directory'] = str(directory.parent)
        self.assertFalse(preflight(directory, opener=opened)['can_write'])
        payload.pop('chart_icon_requests')
        self.assertFalse(preflight(directory, opener=opened)['can_write'])
        for error in [HTTPError('http://localhost', 404, 'old server', {}, None),
                      URLError(socket.timeout('timeout')), ValueError('invalid JSON')]:
            with patch('external_runtime.urlopen', side_effect=error):
                # Pass the patched opener explicitly; no external socket is used.
                self.assertFalse(preflight(directory, opener=__import__('external_runtime').urlopen)['can_write'])
        offline = lambda *args, **kwargs: (_ for _ in ()).throw(URLError(ConnectionRefusedError(10061, 'refused')))
        result = preflight(directory, opener=offline)
        self.assertTrue(result['can_write'])
        self.assertEqual(result['status'], 'offline')
        self.assertFalse(result['chart_requests'])
        with self.assertRaises(ValueError):
            preflight(directory, 'https://example.com')

    def test_all_external_cli_mutations_stop_before_writing_on_incompatible_runtime(self):
        with TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            request = root / 'request.json'
            request.write_text(json.dumps(dict(key='verified-event', title='Verified event', currencies=['USD'],
                kind='scheduled', status='confirmed', event_at='2026-10-22T12:00:00Z', facts='Known fact',
                time_note='Verified schedule', sources=[dict(kind='web', label='Publisher', locator='https://example.com')], show_on_chart=True)))
            with patch.object(analyst, 'ROOT', root), patch.object(analyst, 'require_external_writable', side_effect=ValueError('incompatible runtime')), \
                 patch.object(analyst, 'append_external') as append, patch.object(analyst, 'archive_external') as lifecycle, \
                 patch.object(analyst, 'request_external_chart_icon') as icon:
                for command in [ ['append', '--input', str(request)],
                                 *[[action, '--key', 'verified-event', '--expected-version', 'a'*32]
                                   for action in ('archive', 'restore', 'show-on-chart')]]:
                    with self.assertRaisesRegex(ValueError, 'incompatible runtime'):
                        analyst.run(analyst.parser().parse_args(['external', *command]))
                append.assert_not_called(); lifecycle.assert_not_called(); icon.assert_not_called()
