"""Changelog API module for What's New feature."""

import logging
import re
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query, Request
from osmosmjerka.cache import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(tags=["changelog"])

# Path to CHANGELOG.md - in production it's in the repo root
CHANGELOG_PATH = Path(__file__).parent.parent.parent.parent / "CHANGELOG.md"

# Path to pyproject.toml for version
PYPROJECT_PATH = Path(__file__).parent.parent.parent.parent / "pyproject.toml"

# Cache for parsed changelog (15 minute TTL)
CACHE_TTL_SECONDS = 15 * 60  # 15 minutes
_changelog_cache: dict = {"entries": None, "version": None, "timestamp": 0}


def get_current_version() -> Optional[str]:
    """Get the current app version from pyproject.toml."""
    try:
        if PYPROJECT_PATH.exists():
            content = PYPROJECT_PATH.read_text()
            match = re.search(r'version\s*=\s*"([^"]+)"', content)
            if match:
                return match.group(1)
    except Exception:
        logger.debug("Could not read version from pyproject.toml", exc_info=True)
    return None


def _get_cached_changelog() -> tuple[list[dict], str | None]:
    """Get changelog entries from cache or parse if expired."""
    now = time.time()

    # Check if cache is valid (within TTL)
    if _changelog_cache["entries"] is not None and now - _changelog_cache["timestamp"] < CACHE_TTL_SECONDS:
        return _changelog_cache["entries"], _changelog_cache["version"]

    # Parse and cache
    entries = parse_changelog()
    version = get_current_version()

    _changelog_cache["entries"] = entries
    _changelog_cache["version"] = version
    _changelog_cache["timestamp"] = now

    return entries, version


# Patterns that indicate renovate/dependency update entries (skip these)
RENOVATE_PATTERNS = [
    r"\*\*deps\*\*:",  # **deps**: prefix from renovate
    r"update\s+dependency",  # "Update dependency X"
    r"renovate",  # Direct renovate mentions
    r"bump\s+\w+\s+from",  # "Bump X from Y to Z"
]


def _is_renovate_entry(text: str) -> bool:
    """Check if a changelog entry is a renovate/dependency update (not useful for users)."""
    text_lower = text.lower()
    for pattern in RENOVATE_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return True
    return False


def parse_changelog() -> list[dict]:
    """Parse CHANGELOG.md into structured version entries."""
    if not CHANGELOG_PATH.exists():
        return []

    try:
        content = CHANGELOG_PATH.read_text(encoding="utf-8")
    except Exception:
        logger.debug("Could not read CHANGELOG.md", exc_info=True)
        return []

    entries = []
    current_entry = None
    current_section = None

    for line in content.split("\n"):
        line = line.strip()

        # Match version headers like "## v1.38.1 (2026-01-08)"
        version_match = re.match(r"^##\s+v?(\d+\.\d+\.\d+)\s*\(([^)]+)\)?", line)
        if version_match:
            if current_entry:
                entries.append(current_entry)
            current_entry = {
                "version": version_match.group(1),
                "date": version_match.group(2) if version_match.group(2) else None,
                "features": [],
                "bugfixes": [],
                "improvements": [],
            }
            current_section = None
            continue

        if not current_entry:
            continue

        # Match section headers
        if re.match(r"^###?\s*(Feature|New Feature)", line, re.IGNORECASE):
            current_section = "features"
        elif re.match(r"^###?\s*(Bug\s*Fix|Fix|Bugfix|Bug)", line, re.IGNORECASE):
            current_section = "bugfixes"
        elif re.match(r"^###?\s*(Improvement|Enhancement|Chore|Refactor)", line, re.IGNORECASE):
            current_section = "improvements"
        elif re.match(r"^###?\s", line):
            # Other section, ignore
            current_section = None
        elif current_section and re.match(r"^[-*]\s+", line):
            # List item - extract text
            text = re.sub(r"^[-*]\s+", "", line)

            # Skip renovate/dependency updates - not useful for end users
            if _is_renovate_entry(text):
                continue

            # Remove markdown links but keep text: [text](url) -> text
            text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
            # Remove commit hashes
            text = re.sub(r"`[a-f0-9]{7,40}`", "", text, flags=re.IGNORECASE)
            # Clean up
            text = re.sub(r",\s*$", "", text).strip()

            if text:
                current_entry[current_section].append(text)

    # Don't forget the last entry
    if current_entry:
        entries.append(current_entry)

    return entries


def compare_versions(v1: str, v2: str) -> int:
    """
    Compare two semantic version strings.
    Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
    """
    if not v1 and not v2:
        return 0
    if not v1:
        return -1
    if not v2:
        return 1

    parts1 = [int(x) for x in v1.replace("v", "").split(".")]
    parts2 = [int(x) for x in v2.replace("v", "").split(".")]

    max_length = max(len(parts1), len(parts2))

    for i in range(max_length):
        num1 = parts1[i] if i < len(parts1) else 0
        num2 = parts2[i] if i < len(parts2) else 0

        if num1 > num2:
            return 1
        if num1 < num2:
            return -1

    return 0


@router.get("/version")
@rate_limit(max_requests=5, window_seconds=60)  # 5 requests per minute
async def get_version(request: Request):
    """Get the current application version."""
    _, version = _get_cached_changelog()
    return {"version": version}


@router.get("/whats-new")
@rate_limit(max_requests=5, window_seconds=60)  # 5 requests per minute
async def get_whats_new(
    request: Request,
    since: Optional[str] = Query(None, description="Only return entries newer than this version"),
    limit: int = Query(5, ge=1, le=20, description="Maximum number of entries"),
):
    """
    Get changelog entries for the What's New feature.

    Rate limited to 5 requests per minute.
    Cached for 15 minutes.

    Args:
        since: Optional version to filter entries (only return newer versions)
        limit: Maximum number of entries to return (default 5)

    Returns:
        List of changelog entries with features, bugfixes, and improvements
    """
    all_entries, current_version = _get_cached_changelog()

    # Filter entries newer than 'since' version
    if since:
        filtered = []
        for entry in all_entries:
            if compare_versions(entry["version"], since) > 0:
                filtered.append(entry)
            else:
                # Stop when we reach the 'since' version
                break
        entries = filtered
    else:
        entries = all_entries

    # Filter to only entries with actual content
    entries = [e for e in entries if e["features"] or e["bugfixes"] or e["improvements"]]

    # Apply limit
    return {"entries": entries[:limit], "current_version": current_version}
