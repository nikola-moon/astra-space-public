"""Exercise the public web and API over HTTP on a private loopback port."""
import json
import os
import socket
import subprocess
import sys
from http.cookiejar import CookieJar
from time import monotonic, sleep
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener


def check(root):
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    env = {**os.environ, 'ASTRA_HOST': '127.0.0.1'}
    server = subprocess.Popen([sys.executable, str(root / 'start.py'), '--port', str(port)],
                              cwd=root, env=env)

    def web_client():
        client = build_opener(HTTPCookieProcessor(CookieJar()))

        def request(path, payload=None, expected=200, origin=None):
            headers = {'Content-Type': 'application/json'} if payload is not None else {}
            if origin:
                headers['Origin'] = origin
            body = json.dumps(payload).encode() if payload is not None else None
            req = Request(base + path, headers=headers, data=body)
            try:
                response = client.open(req, timeout=8)
            except HTTPError as error:
                response = error
            with response:
                data = response.read()
                if response.status != expected:
                    raise AssertionError(f'{path} -> {response.status}, attendu {expected}: {data[:200]!r}')
                return json.loads(data) if response.headers.get_content_type() == 'application/json' else data

        return request

    a, b = web_client(), web_client()
    try:
        deadline = monotonic() + 20
        while True:
            try:
                assert a('/healthz')['status'] == 'ok'
                break
            except URLError:
                if monotonic() >= deadline or server.poll() is not None:
                    raise RuntimeError('La station ne démarre pas.')
                sleep(.2)
        assert b'/_expo/' in a('/')
        assert b'login-form' in a('/station')
        assert b'A.S.T.R.A.' in a('/presentation')
        a('/api/me', expected=401)
        a('/v1/astronauts', expected=404)
        a('/api/family/care', {}, expected=404)
        a('/api/login', {'crew': 'ines'}, expected=403, origin='https://example.invalid')
        for browser in (a, b):
            browser('/api/login', {'crew': 'ines'}, origin=base)
            state = browser('/api/me')
            assert state['program']['power_w'] == 100 and state['companion']['age'] == 'Bébé'
        action = '/api/demo/action'
        assert a(action, {'action': 'import'})['state']['companion']['age'] == 'Jeune'
        assert len(a(action, {'action': 'import'})['state']['history']) == 3
        assert a(action, {'action': 'draft'})['state']['program']['power_w'] == 100
        a(action, {'action': 'approve'}, expected=409)
        a(action, {'action': 'specialist'})
        assert a(action, {'action': 'approve'})['state']['program']['power_w'] == 105
        assert a(action, {'action': 'rest'})['state']['companion']['reminder_allowed']
        message = a('/api/me/discussion', {'topic': 'plan'})
        assert '105' in message['answer'] and 'locale' in message['mode']
        a('/api/me/report', {'category': 'Appareil indisponible'})
        assert len(a('/api/demo/reports')['reports']) == 1
        isolated = b('/api/me')
        assert not isolated['reports'] and isolated['program']['power_w'] == 100
        a('/api/login', {'crew': 'malik'})
        assert a('/api/me')['program']['power_w'] == 80
        assert not a('/api/me')['reports']
        a('/api/logout', {})
        a('/api/me', expected=401)
        print('Vérifié · pages web, import sans doublon, double validation, 105 W, discussion locale, '
              'signalement et isolation de deux navigateurs.')
    finally:
        server.terminate()
        server.wait(timeout=10)
