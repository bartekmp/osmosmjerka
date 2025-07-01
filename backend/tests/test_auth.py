from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException, Request
from jose import jwt

from osmosmjerka import auth


class DummyRequest:
    def __init__(self, token):
        self.headers = {"Authorization": token}


def test_create_access_token_and_verify(monkeypatch):
    # Patch env vars and reload module-level vars
    monkeypatch.setenv("ADMIN_SECRET_KEY", "testsecret")
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", "hash")
    # Reload module-level vars
    import importlib

    import osmosmjerka.auth as auth_mod

    importlib.reload(auth_mod)

    data = {"sub": "admin"}
    token = auth_mod.create_access_token(data)
    assert isinstance(token, str)
    # Should verify and return username
    assert auth_mod.verify_token(token) == "admin"


def test_create_access_token_missing_secret(monkeypatch):
    import osmosmjerka.auth as auth_mod

    monkeypatch.setattr(auth_mod, "SECRET_KEY", "")
    with pytest.raises(HTTPException) as exc:
        auth_mod.create_access_token({"sub": "admin"})
    assert exc.value.status_code == 500


def test_verify_token_invalid_token(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "testsecret")
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    import importlib

    import osmosmjerka.auth as auth_mod

    importlib.reload(auth_mod)
    with pytest.raises(HTTPException) as exc:
        auth_mod.verify_token("not.a.jwt")
    assert exc.value.status_code == 401


def test_verify_token_wrong_user(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "testsecret")
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    import importlib

    import osmosmjerka.auth as auth_mod

    importlib.reload(auth_mod)
    # Create token with wrong username
    token = jwt.encode(
        {"sub": "notadmin", "exp": datetime.utcnow() + timedelta(minutes=5)}, "testsecret", algorithm="HS256"
    )
    with pytest.raises(HTTPException) as exc:
        auth_mod.verify_token(token)
    assert exc.value.status_code == 401


def test_get_current_user_success(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "testsecret")
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    import importlib

    import osmosmjerka.auth as auth_mod

    importlib.reload(auth_mod)
    token = auth_mod.create_access_token({"sub": "admin"})
    req = DummyRequest(f"Bearer {token}")
    assert auth_mod.get_current_user(req) == "admin"


def test_get_current_user_missing_header(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "testsecret")
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    import importlib

    import osmosmjerka.auth as auth_mod

    importlib.reload(auth_mod)
    req = DummyRequest("")
    with pytest.raises(HTTPException) as exc:
        auth_mod.get_current_user(req)
    assert exc.value.status_code == 401


def test_get_current_user_invalid_prefix(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "testsecret")
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    import importlib

    import osmosmjerka.auth as auth_mod

    importlib.reload(auth_mod)
    token = auth_mod.create_access_token({"sub": "admin"})
    req = DummyRequest(f"Token {token}")
    with pytest.raises(HTTPException) as exc:
        auth_mod.get_current_user(req)
    assert exc.value.status_code == 401
