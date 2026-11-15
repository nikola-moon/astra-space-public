"""Temporary, independent SQLite workspaces for the public showcase."""

from contextlib import contextmanager
from hashlib import sha256
from secrets import token_urlsafe
from sqlite3 import connect
from threading import Lock
from time import monotonic
from uuid import uuid4
from weakref import finalize

COOKIE = 'astra_showcase'
LIFETIME = 30 * 60
MAX_WORKSPACES = 32


@contextmanager
def using(scope, uri):
    marker = scope.set(uri)
    try:
        yield
    finally:
        scope.reset(marker)


class Workspace:
    def __init__(self):
        self.uri = f'file:astra-{uuid4().hex}?mode=memory&cache=shared'
        self.database = connect(self.uri, uri=True, check_same_thread=False)
        finalize(self, self.database.close)
        self.expires = monotonic() + LIFETIME
        self.crew = None


class Workspaces:
    def __init__(self):
        self.lock = Lock()
        self.visitors = {}
        self.template = Workspace()

    @staticmethod
    def digest(token):
        return sha256(token.encode()).digest() if token and len(token) == 43 else None

    def get(self, token):
        with self.lock:
            now = monotonic()
            for key, workspace in list(self.visitors.items()):
                if workspace.expires <= now:
                    del self.visitors[key]
            workspace = self.visitors.get(self.digest(token))
            return workspace, workspace.crew if workspace else None

    def login(self, token, crew):
        with self.lock:
            workspace = self.visitors.get(self.digest(token))
            if workspace is None or workspace.expires <= monotonic():
                if len(self.visitors) >= MAX_WORKSPACES:
                    return None
                token = token_urlsafe(32)
                workspace = Workspace()
                self.template.database.backup(workspace.database)
                self.visitors[self.digest(token)] = workspace
            workspace.crew = crew
            return token

    def logout(self, workspace):
        with self.lock:
            if workspace is not None:
                workspace.crew = None

    def clear(self):
        with self.lock:
            self.visitors.clear()
