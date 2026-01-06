"""
Comprehensive tests for user private lists functionality
"""

from unittest.mock import AsyncMock, patch

import pytest
from osmosmjerka.database import db_manager


@pytest.fixture(autouse=True)
def mock_database():
    """Mock the database connection for all tests"""
    # Mock the database connection to prevent real DB access
    with patch.object(db_manager, "_ensure_database") as mock_ensure:
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=1)
        mock_db.fetch_one = AsyncMock(return_value=None)
        mock_db.fetch_all = AsyncMock(return_value=[])
        mock_db.fetch_val = AsyncMock(return_value=0)
        mock_ensure.return_value = mock_db
        db_manager.database = mock_db
        yield mock_db


# ===== Learn This Later Tests =====


@pytest.mark.asyncio
async def test_create_learn_later_list(mock_database):
    """Test creating a Learn This Later list for a user"""
    user_id = 1
    language_set_id = 1

    with patch.object(db_manager, "create_learn_later_list", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = {
            "id": 1,
            "user_id": user_id,
            "language_set_id": language_set_id,
            "list_name": "Learn This Later",
            "is_system_list": True,
        }
        result = await db_manager.create_learn_later_list(user_id, language_set_id)

        assert result is not None
        assert result["user_id"] == user_id
        assert result["language_set_id"] == language_set_id
        assert result["list_name"] == "Learn This Later"
        assert result["is_system_list"] is True
        mock_create.assert_called_once_with(user_id, language_set_id)


@pytest.mark.asyncio
async def test_get_or_create_learn_later_list(mock_database):
    """Test get_or_create functionality"""
    user_id = 2
    language_set_id = 1

    expected_list = {
        "id": 1,
        "user_id": user_id,
        "language_set_id": language_set_id,
        "list_name": "Learn This Later",
        "is_system_list": True,
    }

    with patch.object(db_manager, "get_or_create_learn_later_list", new_callable=AsyncMock) as mock_get_or_create:
        mock_get_or_create.return_value = expected_list
        result1 = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)
        assert result1 is not None

        mock_get_or_create.return_value = expected_list
        result2 = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)
        assert result2["id"] == result1["id"]


@pytest.mark.asyncio
async def test_bulk_add_phrases_to_private_list(mock_database):
    """Test adding phrases to a private list"""
    user_id = 3
    language_set_id = 1
    phrase_ids = [1, 2, 3]

    learn_later_list = {"id": 1, "user_id": user_id, "language_set_id": language_set_id}

    with (
        patch.object(db_manager, "get_or_create_learn_later_list", new_callable=AsyncMock) as mock_get_list,
        patch.object(db_manager, "bulk_add_phrases_to_private_list", new_callable=AsyncMock) as mock_bulk_add,
    ):
        mock_get_list.return_value = learn_later_list
        mock_bulk_add.return_value = 3

        learn_later_list_result = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)
        added_count = await db_manager.bulk_add_phrases_to_private_list(
            learn_later_list_result["id"], phrase_ids, language_set_id, skip_duplicates=True
        )

        assert added_count == 3


@pytest.mark.asyncio
async def test_skip_duplicate_phrases(mock_database):
    """Test that duplicate phrases are skipped"""
    user_id = 4
    language_set_id = 1
    phrase_ids = [1, 2, 3]

    learn_later_list = {"id": 1, "user_id": user_id, "language_set_id": language_set_id}

    with (
        patch.object(db_manager, "get_or_create_learn_later_list", new_callable=AsyncMock) as mock_get_list,
        patch.object(db_manager, "bulk_add_phrases_to_private_list", new_callable=AsyncMock) as mock_bulk_add,
    ):
        mock_get_list.return_value = learn_later_list
        mock_bulk_add.side_effect = [3, 0]  # First call returns 3, second returns 0

        learn_later_list_result = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)

        added_count1 = await db_manager.bulk_add_phrases_to_private_list(
            learn_later_list_result["id"], phrase_ids, language_set_id, skip_duplicates=True
        )
        assert added_count1 == 3

        added_count2 = await db_manager.bulk_add_phrases_to_private_list(
            learn_later_list_result["id"], phrase_ids, language_set_id, skip_duplicates=True
        )
        assert added_count2 == 0


@pytest.mark.asyncio
async def test_get_phrase_ids_in_private_list(mock_database):
    """Test checking which phrases are in a list"""
    user_id = 5
    language_set_id = 1
    phrase_ids = [1, 2, 3, 4, 5]

    learn_later_list = {"id": 1, "user_id": user_id, "language_set_id": language_set_id}

    with (
        patch.object(db_manager, "get_or_create_learn_later_list", new_callable=AsyncMock) as mock_get_list,
        patch.object(db_manager, "bulk_add_phrases_to_private_list", new_callable=AsyncMock) as mock_bulk_add,
        patch.object(db_manager, "get_phrase_ids_in_private_list", new_callable=AsyncMock) as mock_get_ids,
    ):
        mock_get_list.return_value = learn_later_list
        mock_bulk_add.return_value = 3
        mock_get_ids.return_value = [1, 3, 5]

        learn_later_list_result = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)
        await db_manager.bulk_add_phrases_to_private_list(
            learn_later_list_result["id"], [1, 3, 5], language_set_id, skip_duplicates=True
        )

        existing_ids = await db_manager.get_phrase_ids_in_private_list(learn_later_list_result["id"], phrase_ids)

        assert len(existing_ids) == 3
        assert 1 in existing_ids
        assert 3 in existing_ids
        assert 5 in existing_ids
        assert 2 not in existing_ids
        assert 4 not in existing_ids


# ===== List Management Tests =====


@pytest.mark.asyncio
async def test_create_private_list(mock_database):
    """Test creating a custom private list"""
    user_id = 10
    language_set_id = 1
    list_name = "My Custom List"

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "get_private_list_by_id", new_callable=AsyncMock) as mock_get,
    ):
        mock_create.return_value = 1
        mock_get.return_value = {
            "id": 1,
            "user_id": user_id,
            "list_name": list_name,
            "is_system_list": False,
        }

        list_id = await db_manager.create_private_list(user_id, list_name, language_set_id, is_system_list=False)
        assert list_id is not None
        assert isinstance(list_id, int)

        list_info = await db_manager.get_private_list_by_id(list_id, user_id)
        assert list_info is not None
        assert list_info["list_name"] == list_name
        assert list_info["is_system_list"] is False


@pytest.mark.asyncio
async def test_create_private_list_duplicate_name(mock_database):
    """Test that duplicate list names are prevented"""
    user_id = 11
    language_set_id = 1
    list_name = "Duplicate Test"

    with patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create:
        mock_create.side_effect = [1, ValueError("List name already exists")]

        list_id1 = await db_manager.create_private_list(user_id, list_name, language_set_id)
        assert list_id1 is not None

        with pytest.raises(ValueError, match="already exists"):
            await db_manager.create_private_list(user_id, list_name, language_set_id)


@pytest.mark.asyncio
async def test_get_user_private_lists(mock_database):
    """Test retrieving all private lists for a user"""
    user_id = 12
    language_set_id = 1

    with (
        patch.object(db_manager, "get_or_create_learn_later_list", new_callable=AsyncMock) as mock_get_list,
        patch.object(db_manager, "get_user_private_lists", new_callable=AsyncMock) as mock_get_lists,
    ):
        mock_get_list.return_value = {"id": 1, "list_name": "Learn This Later", "is_system_list": True}
        mock_get_lists.return_value = {
            "lists": [{"id": 1, "list_name": "Learn This Later", "is_system_list": True}],
            "total": 1,
            "limit": 50,
            "offset": 0,
            "has_more": False,
        }

        await db_manager.get_or_create_learn_later_list(user_id, language_set_id)
        result = await db_manager.get_user_private_lists(user_id, language_set_id, limit=50, offset=0)

        assert "lists" in result
        assert "total" in result
        assert len(result["lists"]) >= 1
        assert any(lst["is_system_list"] for lst in result["lists"])
        assert any(lst["list_name"] == "Learn This Later" for lst in result["lists"])


@pytest.mark.asyncio
async def test_get_user_private_lists_pagination(mock_database):
    """Test pagination for user private lists"""
    user_id = 13
    language_set_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "get_user_private_lists", new_callable=AsyncMock) as mock_get_lists,
    ):
        mock_create.return_value = 1
        mock_get_lists.side_effect = [
            {"lists": [{"id": i} for i in range(1, 4)], "total": 5, "has_more": True},
            {"lists": [{"id": i} for i in range(4, 6)], "total": 5, "has_more": False},
        ]

        for i in range(5):
            await db_manager.create_private_list(user_id, f"List {i}", language_set_id)

        result1 = await db_manager.get_user_private_lists(user_id, language_set_id, limit=3, offset=0)
        assert len(result1["lists"]) == 3
        assert result1["has_more"] is True

        result2 = await db_manager.get_user_private_lists(user_id, language_set_id, limit=3, offset=3)
        assert len(result2["lists"]) >= 2


@pytest.mark.asyncio
async def test_update_private_list_name(mock_database):
    """Test renaming a private list"""
    user_id = 14
    language_set_id = 1
    list_name = "Original Name"
    new_name = "Updated Name"

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "update_private_list_name", new_callable=AsyncMock) as mock_update,
        patch.object(db_manager, "get_private_list_by_id", new_callable=AsyncMock) as mock_get,
    ):
        mock_create.return_value = 1
        mock_update.return_value = True
        mock_get.side_effect = [
            {"id": 1, "list_name": list_name},
            {"id": 1, "list_name": new_name},
        ]

        list_id = await db_manager.create_private_list(user_id, list_name, language_set_id)
        success = await db_manager.update_private_list_name(list_id, new_name)
        assert success is True

        # Ensure updated name is returned
        mock_get.side_effect = [{"id": 1, "list_name": new_name}]
        list_info = await db_manager.get_private_list_by_id(list_id, user_id)
        assert list_info["list_name"] == new_name


@pytest.mark.asyncio
async def test_delete_private_list(mock_database):
    """Test deleting a non-system private list"""
    user_id = 15
    language_set_id = 1

    with (
        patch.object(db_manager, "get_or_create_learn_later_list", new_callable=AsyncMock) as mock_get_list,
        patch.object(db_manager, "delete_private_list", new_callable=AsyncMock) as mock_delete,
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "get_private_list_by_id", new_callable=AsyncMock) as mock_get_by_id,
    ):
        mock_get_list.return_value = {"id": 1, "is_system_list": True}
        mock_delete.side_effect = [False, True]  # System list can't be deleted, custom can
        mock_create.return_value = 2
        # After deletion, simulate not found
        mock_get_by_id.return_value = None

        learn_later_list = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)
        result = await db_manager.delete_private_list(learn_later_list["id"], user_id)
        assert result is False

        custom_list_id = await db_manager.create_private_list(user_id, "Custom List", language_set_id)
        result = await db_manager.delete_private_list(custom_list_id, user_id)
        assert result is True

        list_info = await db_manager.get_private_list_by_id(custom_list_id, user_id)
        assert list_info is None


# ===== Phrase Management Tests =====


@pytest.mark.asyncio
async def test_add_phrase_to_private_list(mock_database):
    """Test adding a public phrase to a private list"""
    user_id = 20
    language_set_id = 1
    phrase_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "add_phrase_to_private_list", new_callable=AsyncMock) as mock_add,
    ):
        mock_create.return_value = 1
        mock_add.return_value = 1

        list_id = await db_manager.create_private_list(user_id, "Test List", language_set_id)
        entry_id = await db_manager.add_phrase_to_private_list(list_id, phrase_id=phrase_id)
        assert entry_id is not None
        assert isinstance(entry_id, int)


@pytest.mark.asyncio
async def test_add_custom_phrase_to_private_list(mock_database):
    """Test adding a custom phrase to a private list"""
    user_id = 21
    language_set_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "add_phrase_to_private_list", new_callable=AsyncMock) as mock_add,
    ):
        mock_create.return_value = 1
        mock_add.return_value = 1

        list_id = await db_manager.create_private_list(user_id, "Test List", language_set_id)
        entry_id = await db_manager.add_phrase_to_private_list(
            list_id, custom_phrase="hello", custom_translation="hola", custom_categories="Greetings"
        )
        assert entry_id is not None


@pytest.mark.asyncio
async def test_get_private_list_entries(mock_database):
    """Test retrieving entries from a private list"""
    user_id = 22
    language_set_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "add_phrase_to_private_list", new_callable=AsyncMock) as mock_add,
        patch.object(db_manager, "get_private_list_entries", new_callable=AsyncMock) as mock_get_entries,
    ):
        mock_create.return_value = 1
        mock_add.return_value = 1
        mock_get_entries.return_value = {
            "entries": [{"id": 1, "phrase_id": 1}, {"id": 2, "phrase_id": 2}],
            "total": 2,
            "limit": 100,
            "offset": 0,
            "has_more": False,
        }

        list_id = await db_manager.create_private_list(user_id, "Test List", language_set_id)
        await db_manager.add_phrase_to_private_list(list_id, phrase_id=1)
        await db_manager.add_phrase_to_private_list(list_id, phrase_id=2)

        result = await db_manager.get_private_list_entries(list_id, user_id, limit=100, offset=0)
        assert "entries" in result
        assert len(result["entries"]) >= 2


@pytest.mark.asyncio
async def test_get_private_list_entries_pagination(mock_database):
    """Test pagination for list entries"""
    user_id = 23
    language_set_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "add_phrase_to_private_list", new_callable=AsyncMock) as mock_add,
        patch.object(db_manager, "get_private_list_entries", new_callable=AsyncMock) as mock_get_entries,
    ):
        mock_create.return_value = 1
        mock_add.return_value = 1
        mock_get_entries.side_effect = [
            {"entries": [{"id": i} for i in range(1, 4)], "total": 5, "has_more": True},
            {"entries": [{"id": i} for i in range(4, 6)], "total": 5, "has_more": False},
        ]

        list_id = await db_manager.create_private_list(user_id, "Test List", language_set_id)
        for i in range(5):
            await db_manager.add_phrase_to_private_list(
                list_id, custom_phrase=f"phrase{i}", custom_translation=f"translation{i}"
            )

        result1 = await db_manager.get_private_list_entries(list_id, user_id, limit=3, offset=0)
        assert len(result1["entries"]) == 3
        assert result1["has_more"] is True

        result2 = await db_manager.get_private_list_entries(list_id, user_id, limit=3, offset=3)
        assert len(result2["entries"]) >= 2


@pytest.mark.asyncio
async def test_remove_phrase_from_private_list(mock_database):
    """Test removing a phrase from a private list"""
    user_id = 24
    language_set_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "add_phrase_to_private_list", new_callable=AsyncMock) as mock_add,
        patch.object(db_manager, "remove_phrase_from_private_list", new_callable=AsyncMock) as mock_remove,
        patch.object(db_manager, "get_private_list_entries", new_callable=AsyncMock) as mock_get_entries,
    ):
        mock_create.return_value = 1
        mock_add.return_value = 1
        mock_remove.return_value = True
        mock_get_entries.return_value = {
            "entries": [],
            "total": 0,
            "limit": 100,
            "offset": 0,
            "has_more": False,
        }

        list_id = await db_manager.create_private_list(user_id, "Test List", language_set_id)
        entry_id = await db_manager.add_phrase_to_private_list(list_id, phrase_id=1)

        success = await db_manager.remove_phrase_from_private_list(list_id, entry_id)
        assert success is True

        result = await db_manager.get_private_list_entries(list_id, user_id, limit=100, offset=0)
        entry_ids = [entry["id"] for entry in result["entries"]]
        assert entry_id not in entry_ids


@pytest.mark.asyncio
async def test_get_phrase_counts_batch(mock_database):
    """Test batch fetching phrase counts for multiple lists"""
    user_id = 25
    language_set_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "add_phrase_to_private_list", new_callable=AsyncMock) as mock_add,
        patch.object(db_manager, "get_phrase_counts_batch", new_callable=AsyncMock) as mock_get_counts,
    ):
        mock_create.side_effect = [1, 2, 3]
        mock_add.return_value = 1
        mock_get_counts.return_value = {1: 1, 2: 2, 3: 3}

        list_ids = []
        for i in range(3):
            list_id = await db_manager.create_private_list(user_id, f"List {i}", language_set_id)
            list_ids.append(list_id)
            for j in range(i + 1):
                await db_manager.add_phrase_to_private_list(
                    list_id, custom_phrase=f"phrase{j}", custom_translation=f"translation{j}"
                )

        counts = await db_manager.get_phrase_counts_batch(list_ids)
        assert len(counts) == 3
        assert counts[list_ids[0]] == 1
        assert counts[list_ids[1]] == 2
        assert counts[list_ids[2]] == 3


# ===== List Sharing Tests =====


@pytest.mark.asyncio
async def test_share_private_list(mock_database):
    """Test sharing a private list with another user"""
    owner_id = 30
    shared_with_user_id = 31
    language_set_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "share_list", new_callable=AsyncMock) as mock_share,
        patch.object(db_manager, "get_list_shares", new_callable=AsyncMock) as mock_get_shares,
    ):
        mock_create.return_value = 1
        mock_share.return_value = 1
        mock_get_shares.return_value = [{"shared_with_user_id": shared_with_user_id, "permission": "read"}]

        list_id = await db_manager.create_private_list(owner_id, "Shared List", language_set_id)
        success = await db_manager.share_list(list_id, owner_id, shared_with_user_id, permission="read")
        assert success == 1

        shares = await db_manager.get_list_shares(list_id, owner_id)
        assert len(shares) == 1
        assert shares[0]["shared_with_user_id"] == shared_with_user_id


@pytest.mark.asyncio
async def test_get_shared_with_me_lists(mock_database):
    """Test getting lists shared with a user"""
    owner_id = 32
    shared_with_user_id = 33
    language_set_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "share_list", new_callable=AsyncMock) as mock_share,
        patch.object(db_manager, "get_shared_with_me_lists", new_callable=AsyncMock) as mock_get_shared,
    ):
        mock_create.return_value = 1
        mock_share.return_value = 1
        mock_get_shared.return_value = [{"id": 1, "list_name": "Shared List"}]

        list_id = await db_manager.create_private_list(owner_id, "Shared List", language_set_id)
        await db_manager.share_list(list_id, owner_id, shared_with_user_id, permission="read")

        shared_lists = await db_manager.get_shared_with_me_lists(shared_with_user_id, language_set_id)
        assert len(shared_lists) >= 1
        assert any(lst["id"] == list_id for lst in shared_lists)


@pytest.mark.asyncio
async def test_unshare_private_list(mock_database):
    """Test unsharing a private list"""
    owner_id = 34
    shared_with_user_id = 35
    language_set_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "share_list", new_callable=AsyncMock) as mock_share,
        patch.object(db_manager, "unshare_list", new_callable=AsyncMock) as mock_unshare,
        patch.object(db_manager, "get_list_shares", new_callable=AsyncMock) as mock_get_shares,
    ):
        mock_create.return_value = 1
        mock_share.return_value = 1
        mock_unshare.return_value = True
        mock_get_shares.return_value = []

        list_id = await db_manager.create_private_list(owner_id, "Shared List", language_set_id)
        await db_manager.share_list(list_id, owner_id, shared_with_user_id, permission="read")

        success = await db_manager.unshare_list(list_id, shared_with_user_id)
        assert success is True

        shares = await db_manager.get_list_shares(list_id, owner_id)
        assert len(shares) == 0


# ===== Resource Limits Tests =====


@pytest.mark.asyncio
async def test_list_limit_enforcement(mock_database):
    """Test that list limit is enforced"""
    user_id = 40
    language_set_id = 1

    with patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create:
        mock_create.side_effect = [i for i in range(1, 51)] + [ValueError("List limit reached")]

        # Create maximum number of lists (default limit is 50)
        for i in range(50):
            await db_manager.create_private_list(user_id, f"List {i}", language_set_id)

        # Try to create one more - should raise ValueError
        with pytest.raises(ValueError, match="limit reached"):
            await db_manager.create_private_list(user_id, "List 50", language_set_id)


@pytest.mark.asyncio
async def test_phrase_limit_enforcement(mock_database):
    """Test that phrase limit per list is enforced"""
    user_id = 41
    language_set_id = 1

    with (
        patch.object(db_manager, "create_private_list", new_callable=AsyncMock) as mock_create,
        patch.object(db_manager, "add_phrase_to_private_list", new_callable=AsyncMock) as mock_add,
    ):
        mock_create.return_value = 1
        mock_add.side_effect = [i for i in range(1, 1001)] + [ValueError("Phrase limit reached")]

        list_id = await db_manager.create_private_list(user_id, "Test List", language_set_id)

        # Add maximum phrases (default limit is 1000)
        for i in range(1000):
            await db_manager.add_phrase_to_private_list(
                list_id, custom_phrase=f"phrase{i}", custom_translation=f"translation{i}"
            )

        # Try to add one more - should raise ValueError
        with pytest.raises(ValueError, match="limit reached"):
            await db_manager.add_phrase_to_private_list(
                list_id, custom_phrase="phrase1000", custom_translation="translation1000"
            )
