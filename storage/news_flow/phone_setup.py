"""Pinned official Windows ntfy installation and local private instance setup."""
import hashlib
import io
import json
from pathlib import Path
import secrets
import re
import socket
import subprocess
import zipfile
from urllib.request import Request, urlopen

VERSION = '2.38.0'
SHA256 = '3e8b0ee3cde66c37586e53f0dd192647c13c6f329226ac3f22b63445961e29fb'
DOWNLOAD = f'https://github.com/binwiederhier/ntfy/releases/download/v{VERSION}/ntfy_{VERSION}_windows_amd64.zip'


def lan_ip():
    # UDP connect chooses the routed interface without sending a packet.
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
        try:
            connection.connect(('1.1.1.1', 80))
            return connection.getsockname()[0]
        except OSError:
            return socket.gethostbyname(socket.gethostname())


def prepare(root):
    root = Path(root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    executable = root / f'ntfy-{VERSION}' / 'ntfy.exe'
    if not executable.exists():
        print(f'[phone] Downloading official ntfy {VERSION} (SHA-256 verified)…', flush=True)
        with urlopen(Request(DOWNLOAD, headers={'User-Agent': 'Fyodor-News-Setup/1.0'}), timeout=30) as response:
            body = response.read(80 * 1024 * 1024)
        if hashlib.sha256(body).hexdigest() != SHA256:
            raise ValueError('Official ntfy download checksum mismatch; nothing executed')
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            names = [name for name in archive.namelist() if name == 'ntfy.exe' or name.endswith('/ntfy.exe')]
            if len(names) != 1:
                raise ValueError('Unexpected ntfy archive')
            executable.parent.mkdir(parents=True, exist_ok=True)
            executable.write_bytes(archive.read(names[0]))
    setup_file = root / 'setup.json'
    if not setup_file.exists():
        setup = {'topic': 'fyodor-news-' + secrets.token_hex(8),
                 'reader_password': secrets.token_urlsafe(18), 'publisher_password': secrets.token_urlsafe(24)}
        temporary = root / 'setup.json.tmp'
        temporary.write_text(json.dumps(setup), encoding='utf-8')
        temporary.replace(setup_file)
    setup = json.loads(setup_file.read_text())
    for user in ('publisher', 'reader'):
        if user + '_hash' not in setup or setup.get('hash_format') != 'lf-v1':
            password = setup[user + '_password']
            result = subprocess.run([str(executable), 'user', 'hash'],
                                    # Binary stdin prevents Windows CRLF conversion
                                    # becoming part of the actual bcrypt password.
                                    input=(password + '\n' + password + '\n').encode(),
                                    capture_output=True, check=True, timeout=10)
            match = re.search(r'\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}', result.stdout.decode())
            if not match:
                raise ValueError('ntfy did not produce a valid password hash')
            setup[user + '_hash'] = match[0]
    setup['hash_format'] = 'lf-v1'
    temporary = root / 'setup.json.tmp'
    temporary.write_text(json.dumps(setup), encoding='utf-8')
    temporary.replace(setup_file)
    address = lan_ip()
    (root / 'address.json').write_text(json.dumps({'server': f'http://{address}:8004',
                                                  'reader': f'http://{address}:8005/news'}))
    config = root / 'server.yml'
    # JSON quoted paths are valid YAML strings, including Windows backslashes.
    config.write_text('\n'.join([
        'listen-http: "0.0.0.0:8004"', f'base-url: "http://{address}:8004"',
        f'auth-file: {json.dumps(str(root / "auth.db"))}', 'auth-default-access: "deny-all"',
        f'cache-file: {json.dumps(str(root / "cache.db"))}', 'cache-duration: "1h"',
        'attachment-expiry-duration: "1h"',
        'enable-signup: false', 'enable-login: true', 'enable-reservations: false',
        'web-root: "disable"', 'log-level: "WARN"',
        'auth-users:', f'  - "publisher:{setup["publisher_hash"]}:user"',
        f'  - "reader:{setup["reader_hash"]}:user"', 'auth-access:',
        f'  - "publisher:{setup["topic"]}:write-only"', f'  - "reader:{setup["topic"]}:read-only"',
    ]) + '\n', encoding='utf-8')
    return executable, config, setup
