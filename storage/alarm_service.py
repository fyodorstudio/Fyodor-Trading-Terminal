"""Independent loopback alarm worker, reusing the installed bridge Python runtime."""
import asyncio
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

from fastapi import FastAPI, HTTPException, Request

from .alarms import AlarmEngine
from .alert_subscriptions import calendar_subscription, load_selected_schedule
from .calendar_store import CalendarStore
from .data_lock import data_lock

ROOT = Path(__file__).resolve().parents[1]
ALARM_DIRECTORY = ROOT / 'storage' / 'data' / 'alarms'


class DesktopDelivery:
    def __init__(self, directory, port):
        self.directory, self.port, self.children = Path(directory), port, []

    def __call__(self, jobs):
        if os.name != 'nt':
            raise RuntimeError('Native alarms require Windows')
        path = self.directory / f"notification-{uuid.uuid4().hex}.json"
        path.write_text(json.dumps({'jobs': jobs, 'api': f'http://127.0.0.1:{self.port}',
            'terminal': 'http://localhost:5173/?events=alarms'}, ensure_ascii=False), encoding='utf-8')
        child = subprocess.Popen(['powershell.exe', '-NoProfile', '-STA', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
            '-File', str(ROOT / 'storage' / 'alarm_notification.ps1'), '-PayloadPath', str(path)],
            creationflags=subprocess.CREATE_NO_WINDOW, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.children.append((child, path, [job['id'] for job in jobs]))

    def reap(self, engine):
        for child, path, ids in list(self.children):
            if child.poll() is None:
                continue
            with engine.lock:
                changed = False
                for identity in ids:
                    job = engine.state['jobs'].get(identity)
                    if job and job['status'] == 'ringing':
                        job.update(status='failed', error='Desktop alarm closed before acknowledgement; use Test alarm to check delivery')
                        changed = True
                if changed:
                    engine.save()
            path.unlink(missing_ok=True)
            self.children.remove((child, path, ids))


def create_alarm_app(directory=ALARM_DIRECTORY, loader=None, notify=None, clock=None, port=8003):
    directory = Path(directory)
    database = Path(os.environ.get('FYODOR_STORAGE_DATA_DIR', ROOT / 'storage' / 'data')) / 'calendar.sqlite3'
    delivery = notify or DesktopDelivery(directory, port)

    @asynccontextmanager
    async def lifespan(app):
        with data_lock(directory):
            engine = AlarmEngine(directory / 'state.json', delivery, **({'clock': clock} if clock else {}))
            app.state.engine = engine
            load = loader or (lambda: load_selected_schedule(database, engine))
            async def worker():
                count = 0
                while True:
                    if count % 5 == 0:
                        try:
                            def refresh_schedule():
                                with engine.lock:
                                    engine.reconcile(load())
                            await asyncio.to_thread(refresh_schedule)
                        except Exception as error:
                            with engine.lock:
                                engine.error = str(error)
                    try:
                        engine.tick()
                        if isinstance(delivery, DesktopDelivery):
                            delivery.reap(engine)
                    except Exception as error:
                        with engine.lock:
                            engine.error = str(error)
                    count += 1
                    await asyncio.sleep(1)
            task = asyncio.create_task(worker())
            try:
                yield
            finally:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
    app = FastAPI(title='Fyodor Events & Alarms', lifespan=lifespan)

    @app.middleware('http')
    async def loopback_only(request: Request, call_next):
        from fastapi.responses import JSONResponse
        if request.url.hostname not in ('127.0.0.1', 'localhost') or request.headers.get('origin') not in (None,
            'http://localhost:5173', 'http://127.0.0.1:5173', f'http://127.0.0.1:{port}', f'http://localhost:{port}'):
            return JSONResponse(status_code=403, content={'detail': 'Loopback terminal access only'})
        return await call_next(request)

    @app.get('/alarms')
    def snapshot():
        return app.state.engine.snapshot()

    @app.post('/alarms')
    async def update(request: Request):
        if request.headers.get('content-type', '').split(';')[0] != 'application/json':
            raise HTTPException(415, 'JSON required')
        raw = await request.body()
        if len(raw) > 65536:
            raise HTTPException(413, 'Alarm request too large')
        try:
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise ValueError('Invalid alarm request')
            if data.get('action') == 'test':
                # Explicit test only; no historical or fake calendar occurrence is created.
                import time
                now = clock() if clock else time.time()
                app.state.engine.notify([{'id': 'test', 'title': 'Test alarm — Fyodor Events & Alarms', 'stage': 'test',
                    'at': (now + 3600) * 1000, 'prompt': 'Sound and desktop window test. No agent has been invoked.'}])
                return {'accepted': True}
            if data.get('action') == 'subscribe':
                store = CalendarStore(database, readonly=True)
                try:
                    key, subscription = calendar_subscription(store, data.get('broker'), data.get('value_ids'), data.get('title'), data.get('enabled'))
                    rows = store.values(subscription['broker'], subscription['value_ids'])
                    if rows[0]['release_at'] <= app.state.engine.clock() * 1000:
                        raise ValueError('Elapsed releases cannot receive a new reminder')
                    data = {'action': 'subscribe', 'expected_revision': data.get('expected_revision'), 'key': key, 'subscription': subscription,
                        'event': {'key': key, 'reference': key, 'source': 'calendar', 'broker': subscription['broker'], 'value_ids': subscription['value_ids'],
                            'title': subscription['title'], 'currencies': [rows[0]['currency']], 'at': rows[0]['release_at'], 'date': None, 'eligible': True,
                            'default_enabled': subscription['enabled'], 'note': 'Verified broker publication.'}}
                finally:
                    store.close()
            return app.state.engine.mutate(data)
        except (ValueError, TypeError, KeyError) as error:
            raise HTTPException(409, str(error)) from error
        except (OSError, RuntimeError) as error:
            raise HTTPException(503, 'Alarm persistence or desktop delivery unavailable') from error

    return app


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(create_alarm_app(), host='127.0.0.1', port=8003, access_log=False)
