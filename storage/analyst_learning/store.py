"""Small atomic stores, separate from the authoritative Thesis ledger."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
from datetime import datetime, timezone


def stamp(value=None):
    return (value or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def instant(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Learning clocks require an explicit timezone')
    return parsed.astimezone(timezone.utc)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def read(path, default):
    path = Path(path)
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, suffix='.tmp', delete=False) as output:
            temporary = Path(output.name)
            json.dump(value, output, ensure_ascii=False, indent=2, allow_nan=False)
            output.flush()
            os.fsync(output.fileno())
        for attempt in range(5):
            try:
                os.replace(temporary, path)
                break
            except PermissionError as error:
                # Windows readers/antivirus can briefly hold a handle without
                # delete-sharing. Keep atomic replacement, with a bounded retry.
                if getattr(error, 'winerror', None) not in (5, 32, 33) or attempt == 4:
                    raise
                time.sleep(.01 * 2 ** attempt)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def directory(journal_path):
    parent = Path(journal_path).parent
    return (parent.parent if parent.name == 'thesis' else parent) / 'learning'


PROTOCOL = {
    'version': 1,
    'name': 'delivered-assessment-common-M1-close',
    'baseline': 'First synchronized completed M1 close at/after saved delivery, within 120 seconds.',
    'primary_end': 'Earliest explicit evaluation end, precise checkpoint or superseding delivered assessment.',
    'legacy_window': 'Without an explicit evaluation end, checkpoint/supersession windows are diagnostic proxies.',
    'basket': 'Geometric equal-weight return against the other seven currencies, triangulated from seven USD legs.',
    'path': 'Synchronized minute closes only; excursions are sampled, not intraminute extrema or executable profit.',
    'coverage': 'Exact completed endpoints; no filling gaps. Incomplete paths excluded from complete-path statistics.',
    'independence': 'Declarations, currencies and crosses are correlated; report currency-day aggregates separately.',
    'flat': 'Zero terminal return is flat, not a correct direction.',
    'eligibility': 'Live standalone complete/provisional calls only; exclude reconstruction, obsolete corrections and missing horizons.',
    'secondary_minutes': [120, 1440],
    'limitations': 'No spreads, fills, financing, trading profits, flow attribution or causal proof. Basket is a relative FX proxy.',
}
PROTOCOL_ID = digest(PROTOCOL)
