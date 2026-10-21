"""Incremental, atomic source evidence records; no market-store mutations."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import urlsplit
from uuid import uuid4

from storage.data_lock import data_lock
from discovery_audit import instant, LOCAL_FAMILIES


def _save(path, receipt):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, suffix='.tmp', delete=False) as output:
            temporary = Path(output.name)
            json.dump(receipt, output, indent=2)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def record_source(path, source_id, status, url, evidence=None, tool_reference=None, retrieval_method=None,
                  note='', outcome='opened', checked_utc=None, root=None):
    path = Path(path).resolve()
    root = Path(root or Path(__file__).resolve().parents[2]).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Receipt must be inside Lite')
    if status not in ('partial', 'checked', 'unavailable') or outcome not in ('opened', 'failed'):
        raise ValueError('Choose partial/checked/unavailable coverage and opened/failed retrieval')
    route = urlsplit(url)
    if route.scheme not in ('http', 'https') or not route.netloc or route.username or route.password:
        raise ValueError('Record the direct publisher/reporting URL actually attempted')
    if not note.strip() or not (tool_reference or retrieval_method):
        raise ValueError('Record a specific coverage note and actual tool reference/retrieval method')
    if status == 'checked' and outcome != 'opened' or status == 'unavailable' and outcome != 'failed':
        raise ValueError('Checked coverage needs opened evidence; unavailable needs a failed retrieval')
    now = datetime.now(timezone.utc)
    checked = instant(checked_utc) if checked_utc else now
    if checked > now:
        raise ValueError('Retrieval clock cannot be in the future')
    body = None
    if outcome == 'opened':
        original = Path(evidence).resolve() if evidence else None
        if not original or not original.is_relative_to(root) or not original.is_file() or not original.stat().st_size:
            raise ValueError('Opened evidence needs a nonempty saved source body inside Lite')
        body = original.read_bytes()
    with data_lock(path.parent):
        receipt = json.loads(path.read_text(encoding='utf-8-sig'))
        if receipt.get('finished_utc'):
            raise ValueError('Receipt is finished; start a new invocation rather than rewriting its checks')
        if checked < instant(receipt['started_utc']):
            raise ValueError('Retrieval predates this invocation; preserve old evidence as dated context')
        source = next((s for s in receipt['sources'] if s['id'] == source_id), None)
        if source is None or source['family'] in LOCAL_FAMILIES:
            raise ValueError('Choose an existing web source ID; captured local pages are preserved')
        check = dict(outcome=outcome, url=url, checked_utc=checked.isoformat(), recorded_utc=now.isoformat(), note=note,
                     retrieval_clock_basis='supplied actual retrieval clock' if checked_utc else 'approximate: recorded after retrieval')
        if tool_reference:
            check['tool_reference'] = tool_reference
        if retrieval_method:
            check['retrieval_method'] = retrieval_method
        saved = None
        evidence_written = False
        try:
            if body is not None:
                folder = path.parent / 'evidence'
                folder.mkdir(exist_ok=True)
                saved = folder / (uuid4().hex + (original.suffix or '.txt'))
                with saved.open('xb') as output:
                    output.write(body)
                    output.flush()
                    os.fsync(output.fileno())
                evidence_written = True
                check['evidence_path'] = str(saved.relative_to(path.parent))
            source.setdefault('checks', []).append(check)
            source.update(status=status, checked_utc=checked.isoformat(), note=note)
            source['attempts'] = list(dict.fromkeys([*source.get('attempts', []), url]))
            if outcome == 'opened':
                source.update({k: v for k, v in check.items() if k not in ('outcome', 'note')})
            _save(path, receipt)
        except Exception:
            if evidence_written:
                saved.unlink(missing_ok=True)
            raise
    return dict(path=str(path), source_id=source_id, status=status, checks=len(source['checks']),
                evidence_path=check.get('evidence_path'), checked_utc=check['checked_utc'])


def finish(path, stop_reason, note=''):
    path = Path(path).resolve()
    now = datetime.now(timezone.utc)
    with data_lock(path.parent):
        receipt = json.loads(path.read_text(encoding='utf-8-sig'))
        if receipt.get('finished_utc'):
            raise ValueError('Receipt is already finished')
        if stop_reason not in ('complete', 'source_gaps', 'release_deadline'):
            raise ValueError('Choose complete, source_gaps or release_deadline')
        if stop_reason == 'release_deadline':
            if receipt.get('mode') != 'release' or not receipt.get('deadline_utc') or instant(receipt['deadline_utc']) > now:
                raise ValueError('Release deferral requires an elapsed declared release deadline')
            if not note.strip():
                raise ValueError('Explain the checks unfinished at the release deadline')
            for source in receipt['sources']:
                if source['status'] == 'pending':
                    source.update(status='deferred', note=note)
        unresolved = [s['id'] for s in receipt['sources'] if s['status'] != 'checked']
        pin_gaps = [e['key'] for e in receipt.get('events', []) if e.get('material') and e.get('pin', {}).get('status') == 'failed']
        if stop_reason == 'complete' and unresolved:
            raise ValueError('Required checks remain unresolved; do not claim complete coverage')
        if stop_reason == 'source_gaps' and any(s['status'] not in ('checked', 'unavailable') for s in receipt['sources']):
            raise ValueError('Unfinished checks are not retrieval failures; continue recording or use an elapsed release deadline')
        receipt.update(finished_utc=now.isoformat(), stop_reason=stop_reason, stop_note=note,
                       coverage='partial' if unresolved or pin_gaps or receipt.get('gaps') else 'complete')
        receipt['gaps'] = list(dict.fromkeys([*receipt.get('gaps', []), *unresolved, *pin_gaps]))
        if receipt.get('discovery_completed_utc') is None:
            receipt['discovery_completed_utc'] = now.isoformat()
        _save(path, receipt)
    return dict(path=str(path), coverage=receipt['coverage'], unresolved_checks=unresolved, finished_utc=receipt['finished_utc'])
