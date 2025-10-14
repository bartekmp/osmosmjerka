"""
Tests for user private lists (Learn This Later) functionality
"""

import pytest

from osmosmjerka.database import db_manager


@pytest.mark.asyncio
async def test_create_learn_later_list():
    """Test creating a Learn This Later list for a user"""
    user_id = 1
    language_set_id = 1

    # Create the list
    result = await db_manager.create_learn_later_list(user_id, language_set_id)

    assert result is not None
    assert result["user_id"] == user_id
    assert result["language_set_id"] == language_set_id
    assert result["list_name"] == "Learn This Later"
    assert result["is_system_list"] is True


@pytest.mark.asyncio
async def test_get_or_create_learn_later_list():
    """Test get_or_create functionality"""
    user_id = 2
    language_set_id = 1

    # First call should create
    result1 = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)
    assert result1 is not None

    # Second call should return existing
    result2 = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)
    assert result2["id"] == result1["id"]


@pytest.mark.asyncio
async def test_bulk_add_phrases_to_private_list():
    """Test adding phrases to a private list"""
    user_id = 3
    language_set_id = 1
    phrase_ids = [1, 2, 3]

    # Create list
    learn_later_list = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)

    # Add phrases
    added_count = await db_manager.bulk_add_phrases_to_private_list(
        learn_later_list["id"], phrase_ids, language_set_id, skip_duplicates=True
    )

    assert added_count == 3


@pytest.mark.asyncio
async def test_skip_duplicate_phrases():
    """Test that duplicate phrases are skipped"""
    user_id = 4
    language_set_id = 1
    phrase_ids = [1, 2, 3]

    # Create list
    learn_later_list = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)

    # Add phrases first time
    added_count1 = await db_manager.bulk_add_phrases_to_private_list(
        learn_later_list["id"], phrase_ids, language_set_id, skip_duplicates=True
    )
    assert added_count1 == 3

    # Try to add same phrases again
    added_count2 = await db_manager.bulk_add_phrases_to_private_list(
        learn_later_list["id"], phrase_ids, language_set_id, skip_duplicates=True
    )
    assert added_count2 == 0  # Should skip all duplicates


@pytest.mark.asyncio
async def test_get_phrase_ids_in_private_list():
    """Test checking which phrases are in a list"""
    user_id = 5
    language_set_id = 1
    phrase_ids = [1, 2, 3, 4, 5]

    # Create list and add some phrases
    learn_later_list = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)
    await db_manager.bulk_add_phrases_to_private_list(
        learn_later_list["id"], [1, 3, 5], language_set_id, skip_duplicates=True
    )

    # Check which phrases are in the list
    existing_ids = await db_manager.get_phrase_ids_in_private_list(learn_later_list["id"], phrase_ids)

    assert len(existing_ids) == 3
    assert 1 in existing_ids
    assert 3 in existing_ids
    assert 5 in existing_ids
    assert 2 not in existing_ids
    assert 4 not in existing_ids


@pytest.mark.asyncio
async def test_get_user_private_lists():
    """Test retrieving all private lists for a user"""
    user_id = 6
    language_set_id = 1

    # Create a Learn This Later list
    await db_manager.get_or_create_learn_later_list(user_id, language_set_id)

    # Get all lists for user
    lists = await db_manager.get_user_private_lists(user_id, language_set_id)

    assert len(lists) >= 1
    assert any(lst["is_system_list"] for lst in lists)
    assert any(lst["list_name"] == "Learn This Later" for lst in lists)


@pytest.mark.asyncio
async def test_delete_private_list():
    """Test deleting a non-system private list"""
    user_id = 7
    language_set_id = 1

    # Create Learn This Later list (system list)
    learn_later_list = await db_manager.get_or_create_learn_later_list(user_id, language_set_id)

    # Try to delete system list - should fail
    result = await db_manager.delete_private_list(learn_later_list["id"], user_id)
    assert result is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
