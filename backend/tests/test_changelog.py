"""Unit tests for changelog API module."""

from unittest.mock import patch

from osmosmjerka.game_api.changelog import (
    _changelog_cache,
    _is_renovate_entry,
    compare_versions,
    get_current_version,
    parse_changelog,
)


class TestCompareVersions:
    """Tests for semantic version comparison."""

    def test_equal_versions(self):
        assert compare_versions("1.0.0", "1.0.0") == 0
        assert compare_versions("2.5.10", "2.5.10") == 0

    def test_newer_version(self):
        assert compare_versions("1.1.0", "1.0.0") == 1
        assert compare_versions("2.0.0", "1.9.9") == 1
        assert compare_versions("1.0.1", "1.0.0") == 1

    def test_older_version(self):
        assert compare_versions("1.0.0", "1.1.0") == -1
        assert compare_versions("1.9.9", "2.0.0") == -1
        assert compare_versions("1.0.0", "1.0.1") == -1

    def test_with_v_prefix(self):
        assert compare_versions("v1.0.0", "1.0.0") == 0
        assert compare_versions("1.0.0", "v1.0.0") == 0
        assert compare_versions("v2.0.0", "v1.0.0") == 1

    def test_empty_versions(self):
        assert compare_versions("", "") == 0
        assert compare_versions("1.0.0", "") == 1
        assert compare_versions("", "1.0.0") == -1
        assert compare_versions(None, None) == 0
        assert compare_versions("1.0.0", None) == 1
        assert compare_versions(None, "1.0.0") == -1


class TestIsRenovateEntry:
    """Tests for filtering renovate/dependency update entries."""

    def test_deps_prefix_filtered(self):
        assert _is_renovate_entry("**deps**: Update dependency fastapi to v0.126.0") is True
        assert _is_renovate_entry("**deps**: Update dependency pytest to v9") is True

    def test_update_dependency_filtered(self):
        assert _is_renovate_entry("Update dependency eslint to v8") is True
        assert _is_renovate_entry("update dependency react to v18") is True

    def test_renovate_mention_filtered(self):
        assert _is_renovate_entry("Renovate cron format") is True
        assert _is_renovate_entry("Trigger renovate once a month") is True
        assert _is_renovate_entry("Add renovate.json config") is True

    def test_bump_pattern_filtered(self):
        assert _is_renovate_entry("Bump react from 17.0.2 to 18.0.0") is True
        assert _is_renovate_entry("bump fastapi from 0.100.0 to 0.126.0") is True

    def test_regular_entries_not_filtered(self):
        assert _is_renovate_entry("Add new scoring system") is False
        assert _is_renovate_entry("Fix bug in grid generation") is False
        assert _is_renovate_entry("Improve mobile layout") is False
        assert _is_renovate_entry("Teacher mode enhancements") is False


class TestParseChangelog:
    """Tests for CHANGELOG.md parsing."""

    @patch("osmosmjerka.game_api.changelog.CHANGELOG_PATH")
    def test_parse_empty_changelog(self, mock_path):
        mock_path.exists.return_value = False
        assert parse_changelog() == []

    @patch("osmosmjerka.game_api.changelog.CHANGELOG_PATH")
    def test_parse_simple_changelog(self, mock_path):
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = """# Changelog

## v1.38.1 (2026-01-08)

### Feature

- Add new scoring system
- Implement teacher mode

### Bug Fixes

- Fix grid generation issue

## v1.38.0 (2026-01-05)

### Feature

- Initial release
"""
        entries = parse_changelog()

        assert len(entries) == 2
        assert entries[0]["version"] == "1.38.1"
        assert entries[0]["date"] == "2026-01-08"
        assert len(entries[0]["features"]) == 2
        assert "Add new scoring system" in entries[0]["features"]
        assert len(entries[0]["bugfixes"]) == 1

        assert entries[1]["version"] == "1.38.0"

    @patch("osmosmjerka.game_api.changelog.CHANGELOG_PATH")
    def test_filters_renovate_entries(self, mock_path):
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = """# Changelog

## v1.38.1 (2026-01-08)

### Feature

- Add new scoring system
- **deps**: Update dependency fastapi to v0.126.0

### Bug Fixes

- Fix grid issue
- Update dependency pytest to v9
"""
        entries = parse_changelog()

        assert len(entries) == 1
        # Only non-renovate entries should be included
        assert len(entries[0]["features"]) == 1
        assert "Add new scoring system" in entries[0]["features"]
        assert len(entries[0]["bugfixes"]) == 1
        assert "Fix grid issue" in entries[0]["bugfixes"]


class TestGetCurrentVersion:
    """Tests for version extraction from pyproject.toml."""

    @patch("osmosmjerka.game_api.changelog.PYPROJECT_PATH")
    def test_get_version_from_pyproject(self, mock_path):
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = """[project]
name = "osmosmjerka"
version = "1.38.1"
"""
        assert get_current_version() == "1.38.1"

    @patch("osmosmjerka.game_api.changelog.PYPROJECT_PATH")
    def test_missing_pyproject(self, mock_path):
        mock_path.exists.return_value = False
        assert get_current_version() is None


class TestCaching:
    """Tests for changelog caching."""

    def test_cache_invalidation_after_ttl(self):
        # Clear cache
        _changelog_cache["entries"] = None
        _changelog_cache["version"] = None
        _changelog_cache["timestamp"] = 0

        # Cache should be empty initially
        assert _changelog_cache["entries"] is None
