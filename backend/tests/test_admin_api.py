import pytest
import io
import csv
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from osmosmjerka.admin_api import router
from osmosmjerka.auth import require_admin_access, require_root_admin, get_current_user
from fastapi import FastAPI, UploadFile

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    # Clear any existing overrides before each test
    app.dependency_overrides = {}
    return TestClient(app)


@pytest.fixture
def mock_admin_user():
    return {
        "username": "admin",
        "role": "administrative", 
        "id": 1,
        "is_active": True
    }


@pytest.fixture
def mock_root_admin_user():
    return {
        "username": "root",
        "role": "root_admin",
        "id": 0,
        "is_active": True
    }


@pytest.fixture
def mock_regular_user():
    return {
        "username": "user",
        "role": "regular",
        "id": 2,
        "is_active": True
    }


def test_admin_api_router_structure():
    """Test that the admin API router is properly structured"""
    assert router is not None
    assert hasattr(router, 'prefix')
    assert router.prefix == "/admin"
    assert hasattr(router, 'routes')
    assert len(router.routes) > 0


def test_admin_api_status_endpoint_exists():
    """Test that status endpoint exists in router"""
    # Check that status endpoint is registered  
    route_paths = [getattr(route, 'path', '') for route in router.routes]
    assert "/admin/status" in route_paths


@patch('osmosmjerka.admin_api.authenticate_user')
@patch('osmosmjerka.admin_api.create_access_token')
def test_login_success(mock_create_token, mock_auth_user, client):
    """Test successful login"""
    mock_auth_user.return_value = {
        "username": "admin",
        "role": "administrative",
        "id": 1
    }
    mock_create_token.return_value = "test_token"
    
    response = client.post("/admin/login", json={
        "username": "admin",
        "password": "password"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] == "test_token"
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "administrative"


@patch('osmosmjerka.admin_api.authenticate_user')
def test_login_failure(mock_auth_user, client):
    """Test failed login"""
    mock_auth_user.return_value = None
    
    response = client.post("/admin/login", json={
        "username": "admin",
        "password": "wrong_password"
    })
    
    assert response.status_code == 401
    data = response.json()
    assert "Invalid credentials" in data["error"]


def test_admin_api_imports():
    """Test that admin API imports work correctly"""
    # Test module structure
    import osmosmjerka.admin_api as admin_module
    
    # The refactoring moved functions from app.py to admin_api.py and auth.py
    # This test just confirms the module loads correctly
    assert admin_module.router.prefix == "/admin"


# Test phrase/row management endpoints
@patch('osmosmjerka.database.db_manager.get_phrases_for_admin')
@patch('osmosmjerka.database.db_manager.get_phrase_count_for_admin')
def test_get_all_rows(mock_get_count, mock_get_phrases, client, mock_admin_user):
    """Test getting all rows with pagination and filtering"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user
    
    mock_get_phrases.return_value = [
        {"id": 1, "phrase": "test", "categories": "A", "translation": "test1"},
        {"id": 2, "phrase": "example", "categories": "B", "translation": "test2"}
    ]
    mock_get_count.return_value = 2
    
    response = client.get("/admin/rows?offset=0&limit=10&category=A&search=test")
    
    assert response.status_code == 200
    data = response.json()
    assert "rows" in data
    assert "total" in data
    assert data["total"] == 2
    assert len(data["rows"]) == 2
    
    mock_get_phrases.assert_called_once_with(None, "A", 10, 0, "test")
    mock_get_count.assert_called_once_with(None, "A", "test")


@patch('osmosmjerka.database.db_manager.add_phrase')
def test_add_row(mock_add_phrase, client, mock_admin_user):
    """Test adding a new phrase/row"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user
    mock_add_phrase.return_value = None

    row_data = {
        "phrase": "nuevo",
        "categories": "Spanish",
        "translation": "new"
    }

    response = client.post("/admin/row?language_set_id=1", json=row_data)

    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Phrase added"
    mock_add_phrase.assert_called_once_with(1, "Spanish", "nuevo", "new")


@patch('osmosmjerka.database.db_manager.update_phrase')
def test_update_row(mock_update_phrase, client, mock_admin_user):
    """Test updating an existing phrase/row"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user
    mock_update_phrase.return_value = None

    row_data = {
        "phrase": "updated",
        "categories": "Updated Category",
        "translation": "updated translation"
    }

    response = client.put("/admin/row/1?language_set_id=1", json=row_data)

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Phrase updated"
    mock_update_phrase.assert_called_once_with(1, 1, "Updated Category", "updated", "updated translation")


@patch('osmosmjerka.database.db_manager.delete_phrase')
def test_delete_row(mock_delete_phrase, client, mock_admin_user):
    """Test deleting a phrase/row"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user
    mock_delete_phrase.return_value = None

    response = client.delete("/admin/row/1?language_set_id=1")

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Phrase deleted"
    mock_delete_phrase.assert_called_once_with(1, 1)


@patch('osmosmjerka.database.db_manager.clear_all_phrases')
def test_clear_db(mock_clear_all, client, mock_admin_user):
    """Test clearing all phrases from database"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user
    mock_clear_all.return_value = None

    response = client.delete("/admin/clear?language_set_id=1")

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Language set phrases cleared"
    mock_clear_all.assert_called_once_with(1)


# Test file upload functionality
@patch('osmosmjerka.database.db_manager.fast_bulk_insert_phrases')
@patch('osmosmjerka.admin_api.run_in_threadpool')
def test_upload_csv_file(mock_threadpool, mock_bulk_insert, client, mock_admin_user):
    """Test uploading CSV file with phrases"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user
    mock_threadpool.return_value = None
    mock_bulk_insert.return_value = None

    # Create test CSV content
    csv_content = "categories;phrase;translation\nSpanish;hola;hello\nFrench;bonjour;hello"

    response = client.post(
        "/admin/upload?language_set_id=1",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Uploaded 2 phrases"
    mock_threadpool.assert_called_once()


@patch('osmosmjerka.database.db_manager.fast_bulk_insert_phrases')
@patch('osmosmjerka.admin_api.run_in_threadpool')
def test_upload_csv_file_with_line_breaks(mock_threadpool, mock_bulk_insert, client, mock_admin_user):
    """Test uploading CSV file with translations containing line breaks"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user
    mock_threadpool.return_value = None
    mock_bulk_insert.return_value = None

    # Create test CSV content with line breaks
    csv_content = 'categories;phrase;translation\nSpanish;hola;"hello\\nhi"\nFrench;bonjour;"hello<br>hi"'

    response = client.post(
        "/admin/upload?language_set_id=1",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Uploaded 2 phrases"
    mock_threadpool.assert_called_once()


def test_upload_empty_file(client, mock_admin_user):
    """Test uploading empty file"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user

    response = client.post(
        "/admin/upload?language_set_id=1",
        files={"file": ("empty.csv", "", "text/csv")}
    )

    assert response.status_code == 400
    data = response.json()
    assert "Upload failed - no valid phrases found" in data["message"]


def test_upload_non_csv_file(client, mock_admin_user):
    """Test uploading non-CSV file"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user

    response = client.post(
        "/admin/upload?language_set_id=1",
        files={"file": ("test.txt", "not csv content", "text/plain")}
    )

    assert response.status_code == 400
    data = response.json()
    assert "Upload failed - no valid phrases found" in data["message"]


# Test export functionality
@patch('osmosmjerka.database.db_manager.get_phrases')
def test_export_data(mock_get_phrases, client, mock_admin_user):
    """Test exporting data as CSV"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user
    mock_get_phrases.return_value = [
        {"categories": "Spanish", "phrase": "hola", "translation": "hello"},
        {"categories": "French", "phrase": "bonjour", "translation": "hello\nhi"}
    ]

    response = client.get("/admin/export?category=Spanish")

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "attachment; filename=export_default_Spanish.csv" in response.headers["content-disposition"]
    
    # Check CSV content
    content = response.content.decode("utf-8")
    assert "categories;phrase;translation" in content
    assert "Spanish;hola;hello" in content
    mock_get_phrases.assert_called_once_with(None, "Spanish")


@patch('osmosmjerka.database.db_manager.get_phrases')
def test_export_data_all_categories(mock_get_phrases, client, mock_admin_user):
    """Test exporting all categories"""
    # Override the dependency
    app.dependency_overrides[require_admin_access] = lambda: mock_admin_user
    mock_get_phrases.return_value = [
        {"categories": "Spanish", "phrase": "hola", "translation": "hello"},
        {"categories": "French", "phrase": "bonjour", "translation": "hello"}
    ]

    response = client.get("/admin/export")

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "attachment; filename=export_default_all.csv" in response.headers["content-disposition"]
    mock_get_phrases.assert_called_once_with(None, None)


# Test user management endpoints (root admin only)
@patch('osmosmjerka.database.db_manager.get_accounts')
@patch('osmosmjerka.database.db_manager.get_account_count')
def test_get_users(mock_get_count, mock_get_accounts, client, mock_root_admin_user):
    """Test getting list of users (root admin only)"""
    # Override the dependency
    app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user
    mock_get_accounts.return_value = [
        {"id": 1, "username": "admin", "role": "administrative", "is_active": True},
        {"id": 2, "username": "user", "role": "regular", "is_active": True}
    ]
    mock_get_count.return_value = 2

    response = client.get("/admin/users?offset=0&limit=20")

    assert response.status_code == 200
    data = response.json()
    assert "users" in data
    assert "total" in data
    assert data["total"] == 2
    assert len(data["users"]) == 2
    
    mock_get_accounts.assert_called_once_with(0, 20)
    mock_get_count.assert_called_once()


@patch('osmosmjerka.database.db_manager.get_account_by_id')
def test_get_user_by_id(mock_get_account, client, mock_root_admin_user):
    """Test getting specific user by ID"""
    # Override the dependency
    app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user
    mock_get_account.return_value = {
        "id": 1,
        "username": "admin",
        "role": "administrative",
        "is_active": True
    }

    response = client.get("/admin/users/1")

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "admin"
    assert data["role"] == "administrative"
    mock_get_account.assert_called_once_with(1)


@patch('osmosmjerka.database.db_manager.get_account_by_id')
def test_get_user_not_found(mock_get_account, client, mock_root_admin_user):
    """Test getting non-existent user"""
    # Override the dependency
    app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user
    mock_get_account.return_value = None

    response = client.get("/admin/users/999")

    assert response.status_code == 404
    data = response.json()
    assert "User not found" in data["error"]
    mock_get_account.assert_called_once_with(999)


@patch('osmosmjerka.database.db_manager.get_account_by_username')
@patch('osmosmjerka.database.db_manager.create_account')
@patch('osmosmjerka.admin_api.bcrypt.hashpw')
@patch('osmosmjerka.admin_api.bcrypt.gensalt')
def test_create_user(mock_gensalt, mock_hashpw, mock_create_account, mock_get_by_username, client, mock_root_admin_user):
    """Test creating new user"""
    # Override the dependency
    app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user
    mock_get_by_username.return_value = None  # User doesn't exist
    mock_gensalt.return_value = b"salt"
    mock_hashpw.return_value = b"hashed_password"
    mock_create_account.return_value = 3

    response = client.post("/admin/users", json={
        "username": "newuser",
        "password": "password123",
        "role": "regular",
        "self_description": "New user"
    })

    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "User created"
    assert data["user_id"] == 3
    
    mock_get_by_username.assert_called_once_with("newuser")
    mock_create_account.assert_called_once()


@patch('osmosmjerka.database.db_manager.get_account_by_username')
def test_create_user_already_exists(mock_get_by_username, client, mock_root_admin_user):
    """Test creating user with existing username"""
    # Override the dependency
    app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user
    mock_get_by_username.return_value = {"username": "existing"}

    response = client.post("/admin/users", json={
        "username": "existing",
        "password": "password123",
        "role": "regular"
    })

    assert response.status_code == 400
    data = response.json()
    assert "already exists" in data["error"]
    mock_get_by_username.assert_called_once_with("existing")


def test_create_user_invalid_role(client, mock_root_admin_user):
    """Test creating user with invalid role"""
    # Override the dependency
    app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user

    response = client.post("/admin/users", json={
        "username": "newuser",
        "password": "password123",
        "role": "invalid_role"
    })

    assert response.status_code == 400
    data = response.json()
    assert "Invalid role" in data["error"]


# Test profile management endpoints
@patch('osmosmjerka.database.db_manager.get_account_by_id')
def test_get_profile_regular_user(mock_get_account, client, mock_regular_user):
    """Test getting profile for regular user"""
    # Override the dependency
    app.dependency_overrides[get_current_user] = lambda: mock_regular_user
    mock_get_account.return_value = {
        "id": 2,
        "username": "user",
        "role": "regular",
        "self_description": "Regular user"
    }

    response = client.get("/admin/profile")

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "user"
    assert data["role"] == "regular"
    assert data["self_description"] == "Regular user"
    mock_get_account.assert_called_once_with(2)


def test_get_profile_root_admin(client, mock_root_admin_user):
    """Test getting profile for root admin"""
    # Override the dependency
    app.dependency_overrides[get_current_user] = lambda: mock_root_admin_user

    response = client.get("/admin/profile")

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "root"
    assert data["role"] == "root_admin"
    assert data["self_description"] == "Root Administrator"


@patch('osmosmjerka.database.db_manager.update_account')
def test_update_profile(mock_update_account, client, mock_regular_user):
    """Test updating user profile"""
    # Override the dependency
    app.dependency_overrides[get_current_user] = lambda: mock_regular_user
    mock_update_account.return_value = None

    response = client.put("/admin/profile", json={
        "self_description": "Updated description"
    })

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Profile updated"
    mock_update_account.assert_called_once_with(2, self_description="Updated description")


def test_update_profile_root_admin_forbidden(client, mock_root_admin_user):
    """Test that root admin cannot update profile via API"""
    # Override the dependency
    app.dependency_overrides[get_current_user] = lambda: mock_root_admin_user

    response = client.put("/admin/profile", json={
        "self_description": "Updated description"
    })

    assert response.status_code == 400
    data = response.json()
    assert "Root admin profile cannot be updated" in data["error"]


def test_update_profile_empty_description(client, mock_regular_user):
    """Test updating profile with empty description"""
    # Override the dependency
    app.dependency_overrides[get_current_user] = lambda: mock_regular_user

    response = client.put("/admin/profile", json={
        "self_description": "   "
    })

    assert response.status_code == 400
    data = response.json()
    assert "Description cannot be empty" in data["error"]


# Test password change functionality
@patch('osmosmjerka.database.db_manager.get_account_by_username')
@patch('osmosmjerka.database.db_manager.update_account')
@patch('osmosmjerka.admin_api.bcrypt.checkpw')
@patch('osmosmjerka.admin_api.bcrypt.hashpw')
@patch('osmosmjerka.admin_api.bcrypt.gensalt')
def test_change_password(mock_gensalt, mock_hashpw, mock_checkpw, mock_update_account, mock_get_by_username, client, mock_regular_user):
    """Test changing password"""
    # Override the dependency
    app.dependency_overrides[get_current_user] = lambda: mock_regular_user
    mock_get_by_username.return_value = {
        "username": "user",
        "password_hash": "old_hash"
    }
    mock_checkpw.return_value = True  # Current password is correct
    mock_gensalt.return_value = b"salt"
    mock_hashpw.return_value = b"new_hashed_password"
    mock_update_account.return_value = None

    response = client.post("/admin/change-password", json={
        "current_password": "old_password",
        "new_password": "new_password"
    })

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Password changed successfully"
    
    mock_get_by_username.assert_called_once_with("user")
    mock_checkpw.assert_called_once()
    mock_update_account.assert_called_once()


@patch('osmosmjerka.database.db_manager.get_account_by_username')
@patch('osmosmjerka.admin_api.bcrypt.checkpw')
def test_change_password_wrong_current(mock_checkpw, mock_get_by_username, client, mock_regular_user):
    """Test changing password with wrong current password"""
    # Override the dependency
    app.dependency_overrides[get_current_user] = lambda: mock_regular_user
    mock_get_by_username.return_value = {
        "username": "user",
        "password_hash": "old_hash"
    }
    mock_checkpw.return_value = False  # Current password is wrong

    response = client.post("/admin/change-password", json={
        "current_password": "wrong_password",
        "new_password": "new_password"
    })

    assert response.status_code == 400
    data = response.json()
    assert "Current password is incorrect" in data["error"]
    mock_get_by_username.assert_called_once_with("user")
    mock_checkpw.assert_called_once()


def test_change_password_root_admin_forbidden(client, mock_root_admin_user):
    """Test that root admin cannot change password via API"""
    # Override the dependency
    app.dependency_overrides[get_current_user] = lambda: mock_root_admin_user

    response = client.post("/admin/change-password", json={
        "current_password": "old_password",
        "new_password": "new_password"
    })

    assert response.status_code == 400
    data = response.json()
    assert "Root admin password cannot be changed" in data["error"]


@patch('osmosmjerka.database.db_manager.update_account')
@patch('osmosmjerka.database.db_manager.get_account_by_username')
@patch('bcrypt.gensalt')
@patch('bcrypt.hashpw')  
@patch('bcrypt.checkpw')
def test_change_password_success(mock_checkpw, mock_hashpw, mock_gensalt, mock_get_by_username, mock_update_account, client, mock_regular_user):
    """Test successful password change"""
    # Override the dependency
    app.dependency_overrides[get_current_user] = lambda: mock_regular_user
    
    # Mock account exists
    mock_get_by_username.return_value = {
        "id": 1,
        "username": "user",
        "password_hash": "hashed_old_password"
    }
    
    # Mock password verification succeeds
    mock_checkpw.return_value = True
    
    # Mock password hashing
    mock_gensalt.return_value = b"salt"
    mock_hashpw.return_value = b"hashed_new_password"
    
    response = client.post("/admin/change-password", json={
        "current_password": "old_password",
        "new_password": "new_secure_password"
    })

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Password changed successfully"
