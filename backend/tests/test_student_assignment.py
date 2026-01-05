from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.admin_api import router
from osmosmjerka.auth import require_teacher_access

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    app.dependency_overrides = {}
    return TestClient(app)


@pytest.fixture
def mock_teacher_user():
    return {"username": "teacher", "role": "regular", "id": 1, "is_active": True}


@patch("osmosmjerka.database.db_manager.create_teacher_phrase_set")
@patch("osmosmjerka.database.db_manager.get_users_in_teacher_groups")
def test_create_phrase_set_with_usernames(mock_get_group_users, mock_create_set, client, mock_teacher_user):
    # Override auth
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    # Mock group user resolution
    # Should resolve valid students who are in groups
    mock_get_group_users.return_value = [101]  # student1 found

    # Mock creation
    mock_create_set.return_value = {
        "id": 1,
        "name": "Test Set",
        "access_user_ids": [101],
    }

    payload = {
        "name": "Test Set",
        "language_set_id": 1,
        "phrase_ids": [1, 2],
        "access_type": "private",
        "access_usernames": [
            "student1",
            "nonexistent",
        ],  # "nonexistent" should be filtered out
    }

    response = client.post("/admin/teacher/phrase-sets", json=payload)

    assert response.status_code == 201

    # Verify filtering called correctly
    mock_get_group_users.assert_called_once()
    call_args = mock_get_group_users.call_args
    assert call_args.kwargs["teacher_id"] == 1
    assert "student1" in call_args.kwargs["usernames"]
    assert "nonexistent" in call_args.kwargs["usernames"]

    # Verify create_teacher_phrase_set called with resolved ID
    mock_create_set.assert_called_once()
    call_kwargs = mock_create_set.call_args.kwargs
    assert call_kwargs["access_user_ids"] == [101]
    assert call_kwargs["access_type"] == "private"


@patch("osmosmjerka.database.db_manager.update_teacher_phrase_set")
@patch("osmosmjerka.database.db_manager.get_users_in_teacher_groups")
def test_update_phrase_set_with_usernames(mock_get_group_users, mock_update_set, client, mock_teacher_user):
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    mock_get_group_users.return_value = [102]  # student2 found
    mock_update_set.return_value = {"id": 1, "updated": True}

    payload = {
        "access_usernames": ["student2"],
        "access_user_ids": [],
    }

    response = client.put("/admin/teacher/phrase-sets/1", json=payload)

    assert response.status_code == 200

    mock_get_group_users.assert_called_once()
    mock_update_set.assert_called_once()
    call_kwargs = mock_update_set.call_args.kwargs
    assert call_kwargs["access_user_ids"] == [102]


@patch("osmosmjerka.database.db_manager.update_teacher_phrase_set")
@patch("osmosmjerka.database.db_manager.get_users_in_teacher_groups")
def test_update_phrase_set_merges_usernames(mock_get_group_users, mock_update_set, client, mock_teacher_user):
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    mock_get_group_users.return_value = [103]  # student3 found
    mock_update_set.return_value = {"id": 1}

    payload = {
        "access_usernames": ["student3"],
        "access_user_ids": [99],
    }  # Existing ID 99

    response = client.put("/admin/teacher/phrase-sets/1", json=payload)

    assert response.status_code == 200

    call_kwargs = mock_update_set.call_args.kwargs
    assert 99 in call_kwargs["access_user_ids"]
    assert 103 in call_kwargs["access_user_ids"]
