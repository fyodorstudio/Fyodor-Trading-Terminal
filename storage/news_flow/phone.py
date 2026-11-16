"""LAN-only read-only news gateway and private ntfy child process."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
from contextlib import asynccontextmanager
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from .phone_setup import prepare


def phone_app(directory, assets, setup, executable=None, config=None):
    directory, assets = Path(directory).resolve(), Path(assets).resolve()
    security = HTTPBasic()

    def authenticate(credentials: HTTPBasicCredentials = Depends(security)):
        if not (secrets.compare_digest(credentials.username.encode(), b'reader') and
                secrets.compare_digest(credentials.password.encode(), setup['reader_password'].encode())):
            raise HTTPException(401, 'Use the reader login shown in the desktop News Flow bell.',
                                headers={'WWW-Authenticate': 'Basic realm="Fyodor News"'})

    @asynccontextmanager
    async def lifespan(app):
        process = None
        try:
            if executable is not None:
                process = subprocess.Popen([str(executable), 'serve', '--config', str(config)],
                                           env={key: value for key, value in os.environ.items() if not key.startswith('NTFY_')})
                for _ in range(40):
                    if process.poll() is not None:
                        raise RuntimeError('ntfy could not start; check port 8004 and the PHONE log')
                    try:
                        with urlopen('http://127.0.0.1:8004/v1/health', timeout=.25) as response:
                            if json.loads(response.read()).get('healthy'):
                                break
                    except (OSError, ValueError):
                        time.sleep(.1)
                else:
                    raise RuntimeError('ntfy did not become ready')
            yield
        finally:
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

    @app.get('/health')
    def health():
        return {'application': 'fyodor-news-phone', 'data_directory': str(directory)}

    @app.get('/news', dependencies=[Depends(authenticate)])
    @app.get('/', dependencies=[Depends(authenticate)])
    def reader():
        if not (assets / 'news.html').exists():
            raise HTTPException(503, 'Mobile reader not built. Run pnpm run dev:all.')
        return FileResponse(assets / 'news.html', headers={'Cache-Control': 'no-store',
                            'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff'})

    @app.get('/assets/{name:path}', dependencies=[Depends(authenticate)])
    def asset(name: str):
        candidate = (assets / 'assets' / name).resolve()
        if not candidate.is_relative_to(assets / 'assets') or not candidate.is_file():
            raise HTTPException(404)
        return FileResponse(candidate, headers={'X-Content-Type-Options': 'nosniff'})

    @app.get('/storage-api/news-flow/{action}', dependencies=[Depends(authenticate)])
    def news(action: str, request: Request):
        if action not in ('items', 'sources', 'export', 'phone-profile'):
            raise HTTPException(404)
        if len(request.url.query) > 40000:
            raise HTTPException(414)
        base = os.environ.get('FYODOR_STORAGE_API_URL', 'http://127.0.0.1:8002').rstrip('/')
        upstream = UrlRequest(f'{base}/api/v1/news-flow/{action}?{request.url.query}')
        try:
            # A newly edited relevance profile can classify the full local cache
            # on its first request; warm queries reuse bounded compiled/results caches.
            with urlopen(upstream, timeout=30) as response:
                return Response(response.read(16 * 1024 * 1024), media_type='application/json',
                                headers={'Cache-Control': 'no-store'})
        except HTTPError as error:
            try:
                return Response(error.read(32768), status_code=error.code, media_type='application/json')
            finally:
                error.close()
        except URLError as error:
            raise HTTPException(503, 'PC news storage unavailable; reconnecting.') from error

    return app


def main():
    import uvicorn
    from storage.app import data_directory
    root = data_directory() / 'news-flow' / 'phone'
    executable, config, setup = prepare(root)
    assets = Path(__file__).resolve().parents[2] / 'frontend' / 'dist-news'
    if not (assets / 'news.html').exists():
        raise RuntimeError('Build the mobile reader with pnpm --dir frontend build:news first')
    print('[phone] Reader and ntfy ready on your LAN. Open the desktop News Flow bell for connection details.', flush=True)
    uvicorn.run(phone_app(root, assets, setup, executable, config), host='0.0.0.0', port=8005, access_log=False)


if __name__ == '__main__':
    main()
