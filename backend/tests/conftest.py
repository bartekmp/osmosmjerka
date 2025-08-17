import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


@pytest.fixture
def mock_admin_user():
    return {"username": "admin", "role": "administrative", "id": 1, "is_active": True}


@pytest.fixture
def mock_root_admin_user():
    return {"username": "root", "role": "root_admin", "id": 0, "is_active": True}
